const jwt = require('jsonwebtoken');
const Session = require('../models/Session.model');
const CallLog = require('../models/CallLog.model');
const User = require('../models/User.model');
const logger = require('../utils/logger');

// Generate secure JWT for joining call
const generateCallToken = async (req, res) => {
    try {
        const { sessionId, userId, role } = req.body;
        const requesterId = req.user.userId;
        const requesterRole = req.user.role;

        // Validate input
        if (!sessionId || !userId || !role) {
            return res.status(400).json({
                success: false,
                message: 'sessionId, userId, and role are required'
            });
        }

        // Verify session exists and user has access
        const session = await Session.findById(sessionId)
            .populate('userId')
            .populate('therapistId');

        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Session not found'
            });
        }

        // Check if requester is authorized to generate token
        const isTherapist = session.therapistId && session.therapistId._id.toString() === requesterId;
        const isAdmin = requesterRole === 'admin';
        const isUser = session.userId && session.userId._id.toString() === requesterId;

        if (!isTherapist && !isAdmin && !isUser) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized to generate call token'
            });
        }

        // Check if target user is part of the session
        const targetUser = await User.findById(userId);
        if (!targetUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const isTargetUser = session.userId && session.userId._id.toString() === userId;
        const isTargetTherapist = session.therapistId && session.therapistId._id.toString() === userId;

        if (!isTargetUser && !isTargetTherapist) {
            return res.status(403).json({
                success: false,
                message: 'User is not part of this session'
            });
        }

        // Generate JWT token (expires in 5 minutes)
        const tokenPayload = {
            sessionId,
            userId,
            role,
            exp: Math.floor(Date.now() / 1000) + (5 * 60) // 5 minutes
        };

        const token = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'fallback_secret');

        logger.info(`Call token generated for user ${userId} in session ${sessionId}`);

        res.status(200).json({
            success: true,
            token,
            expiresAt: new Date(Date.now() + 5 * 60 * 1000)
        });
    } catch (error) {
        logger.error('Error generating call token:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate call token'
        });
    }
};

// Verify call token
const verifyCallToken = async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Token is required'
            });
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');

        // Verify session still exists
        const session = await Session.findById(decoded.sessionId);
        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Session not found or expired'
            });
        }

        // Verify user still exists
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            valid: true,
            sessionId: decoded.sessionId,
            userId: decoded.userId,
            role: decoded.role
        });
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expired'
            });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        }
        logger.error('Error verifying call token:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify call token'
        });
    }
};

// Get call details for a session
const getCallDetails = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const userId = req.user.userId;
        const userRole = req.user.role;

        // Verify session exists and user has access
        const session = await Session.findById(sessionId)
            .populate('userId', 'name email')
            .populate('therapistId', 'name email');

        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Session not found'
            });
        }

        // Check if user has access to this session
        const isTherapist = session.therapistId && session.therapistId._id.toString() === userId;
        const isAdmin = userRole === 'admin';
        const isUser = session.userId && session.userId._id.toString() === userId;

        if (!isTherapist && !isAdmin && !isUser) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized to access call details'
            });
        }

        // Get call logs for this session
        const callLogs = await CallLog.find({ sessionId })
            .populate('participants.userId', 'name email')
            .sort({ callStartedAt: -1 })
            .limit(10);

        res.status(200).json({
            success: true,
            session: {
                id: session._id,
                date: session.date,
                time: session.time,
                status: session.status,
                user: session.userId,
                therapist: session.therapistId
            },
            callLogs
        });
    } catch (error) {
        logger.error('Error getting call details:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get call details'
        });
    }
};

// Get user's call history
const getCallHistory = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        // Get call logs where user is a participant
        const callLogs = await CallLog.find({
            'participants.userId': userId
        })
            .populate('sessionId', 'date time status')
            .populate('participants.userId', 'name email')
            .sort({ callStartedAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await CallLog.countDocuments({
            'participants.userId': userId
        });

        res.status(200).json({
            success: true,
            callLogs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        logger.error('Error getting call history:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get call history'
        });
    }
};

// Report call issue
const reportCallIssue = async (req, res) => {
    try {
        const { sessionId, issue, description } = req.body;
        const userId = req.user.userId;

        if (!sessionId || !issue) {
            return res.status(400).json({
                success: false,
                message: 'sessionId and issue are required'
            });
        }

        // Verify session exists and user participated
        const session = await Session.findById(sessionId);
        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Session not found'
            });
        }

        // Create issue report
        const issueReport = {
            sessionId,
            userId,
            issue,
            description: description || '',
            reportedAt: new Date(),
            status: 'reported'
        };

        // In a real implementation, you'd save this to a database
        logger.warn(`Call issue reported: ${issue} for session ${sessionId} by user ${userId}`);

        res.status(200).json({
            success: true,
            message: 'Issue reported successfully',
            reportId: `report_${Date.now()}` // Placeholder ID
        });
    } catch (error) {
        logger.error('Error reporting call issue:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to report issue'
        });
    }
};

// Admin: Get all call logs with filters
const getCallLogs = async (req, res) => {
    try {
        const { dateRange, therapistId, userId, page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        // Build filter
        const filter = {};
        if (therapistId) filter.therapistId = therapistId;
        if (userId) filter['participants.userId'] = userId;
        if (dateRange) {
            const [startDate, endDate] = dateRange.split(',');
            filter.callStartedAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const callLogs = await CallLog.find(filter)
            .populate('sessionId', 'date time status')
            .populate('participants.userId', 'name email')
            .sort({ callStartedAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await CallLog.countDocuments(filter);

        res.status(200).json({
            success: true,
            callLogs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        logger.error('Error getting call logs:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get call logs'
        });
    }
};

// Admin: Get call quality metrics
const getCallQualityMetrics = async (req, res) => {
    try {
        const { sessionId } = req.params;

        // Get call logs for session
        const callLogs = await CallLog.find({ sessionId });

        // Calculate metrics (placeholder - in real implementation, collect from WebRTC stats)
        const totalCalls = callLogs.length;
        const completedCalls = callLogs.filter(log => log.status === 'completed').length;
        const avgDuration = callLogs.length > 0
            ? callLogs.reduce((sum, log) => sum + (log.duration || 0), 0) / callLogs.length
            : 0;

        res.status(200).json({
            success: true,
            metrics: {
                totalCalls,
                completedCalls,
                successRate: totalCalls > 0 ? (completedCalls / totalCalls) * 100 : 0,
                avgDuration: Math.round(avgDuration),
                issuesReported: 0 // Placeholder
            }
        });
    } catch (error) {
        logger.error('Error getting call quality metrics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get call quality metrics'
        });
    }
};

// Admin: Get currently active calls
const getActiveCalls = async (req, res) => {
    try {
        const activeCalls = await CallLog.find({ status: 'active' })
            .populate('sessionId', 'date time')
            .populate('participants.userId', 'name email')
            .sort({ callStartedAt: -1 });

        res.status(200).json({
            success: true,
            activeCalls: activeCalls.map(call => ({
                id: call._id,
                sessionId: call.sessionId,
                participants: call.participants,
                startedAt: call.callStartedAt,
                type: call.type
            }))
        });
    } catch (error) {
        logger.error('Error getting active calls:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get active calls'
        });
    }
};

// Admin: Force end a call
const forceEndCall = async (req, res) => {
    try {
        const { sessionId, reason } = req.body;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: 'sessionId is required'
            });
        }

        // Update call log status
        const result = await CallLog.updateMany(
            {
                sessionId,
                status: 'active'
            },
            {
                status: 'force-ended',
                callEndedAt: new Date(),
                duration: (new Date() - new Date()) / 1000 // Placeholder
            }
        );

        logger.warn(`Call force-ended for session ${sessionId}. Reason: ${reason || 'Not specified'}`);

        res.status(200).json({
            success: true,
            message: 'Call ended successfully',
            affectedCalls: result.modifiedCount
        });
    } catch (error) {
        logger.error('Error force-ending call:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to end call'
        });
    }
};

// Admin: Mute participant
const muteParticipant = async (req, res) => {
    try {
        const { sessionId, userId } = req.body;

        if (!sessionId || !userId) {
            return res.status(400).json({
                success: false,
                message: 'sessionId and userId are required'
            });
        }

        // In a real implementation, this would send a signal to the client
        logger.info(`Participant ${userId} muted in session ${sessionId}`);

        res.status(200).json({
            success: true,
            message: 'Participant muted successfully'
        });
    } catch (error) {
        logger.error('Error muting participant:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mute participant'
        });
    }
};

module.exports = {
    generateCallToken,
    verifyCallToken,
    getCallDetails,
    getCallHistory,
    reportCallIssue,
    getCallLogs,
    getCallQualityMetrics,
    getActiveCalls,
    forceEndCall,
    muteParticipant
};
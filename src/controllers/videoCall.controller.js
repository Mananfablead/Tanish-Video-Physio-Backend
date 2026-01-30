const CallLog = require('../models/CallLog.model');
const Session = require('../models/Session.model');
const GroupSession = require('../models/GroupSession.model');
const logger = require('../utils/logger');

// Create a new call log
const createCallLog = async (req, res) => {
    try {
        const { sessionId, groupSessionId, type, participants } = req.body;
        const userId = req.user.userId;

        // Validate input
        if (!sessionId && !groupSessionId) {
            return res.status(400).json({ message: 'Either sessionId or groupSessionId is required' });
        }

        if (!type) {
            return res.status(400).json({ message: 'Call type is required' });
        }

        // Verify session exists and user has access
        if (sessionId) {
            const session = await Session.findById(sessionId);
            if (!session) {
                return res.status(404).json({ message: 'Session not found' });
            }
        } else if (groupSessionId) {
            const groupSession = await GroupSession.findById(groupSessionId);
            if (!groupSession) {
                return res.status(404).json({ message: 'Group session not found' });
            }
        }

        // Create call log
        const callLog = new CallLog({
            sessionId: sessionId || undefined,
            groupSessionId: groupSessionId || undefined,
            type,
            callStartedAt: new Date(),
            status: 'active',
            participants: participants || []
        });

        await callLog.save();
        await callLog.populate('participants.userId', 'name email');

        logger.info(`Call log created by user ${userId} for session ${sessionId || groupSessionId}`);
        res.status(201).json({ callLog });
    } catch (error) {
        logger.error('Error creating call log:', error);
        res.status(500).json({ message: 'Failed to create call log' });
    }
};

// Get all call logs (admin only)
const getCallLogs = async (req, res) => {
    try {
        const { page = 1, limit = 10, userId, status, type } = req.query;
        const skip = (page - 1) * limit;

        // Build filter
        const filter = {};
        if (userId) filter['participants.userId'] = userId;
        if (status) filter.status = status;
        if (type) filter.type = type;

        const callLogs = await CallLog.find(filter)
            .populate('sessionId', 'date time')
            .populate('groupSessionId', 'title')
            .populate('participants.userId', 'name email')
            .sort({ callStartedAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await CallLog.countDocuments(filter);

        res.json({
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
        res.status(500).json({ message: 'Failed to get call logs' });
    }
};

// Get call log by ID
const getCallLogById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        const callLog = await CallLog.findById(id)
            .populate('sessionId', 'date time')
            .populate('groupSessionId', 'title')
            .populate('participants.userId', 'name email');

        if (!callLog) {
            return res.status(404).json({ message: 'Call log not found' });
        }

        // Check if user has access to this call log
        const isAdmin = req.user.role === 'admin';
        const isParticipant = callLog.participants.some(p => p.userId.toString() === userId);

        if (!isAdmin && !isParticipant) {
            return res.status(403).json({ message: 'Access denied' });
        }

        res.json({ callLog });
    } catch (error) {
        logger.error('Error getting call log:', error);
        res.status(500).json({ message: 'Failed to get call log' });
    }
};

// Update call log
const updateCallLog = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, callEndedAt, duration } = req.body;
        const userId = req.user.userId;

        const callLog = await CallLog.findById(id);
        if (!callLog) {
            return res.status(404).json({ message: 'Call log not found' });
        }

        // Check if user has access to update this call log
        const isAdmin = req.user.role === 'admin';
        const isParticipant = callLog.participants.some(p => p.userId.toString() === userId);

        if (!isAdmin && !isParticipant) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Update fields
        if (status) callLog.status = status;
        if (callEndedAt) callLog.callEndedAt = callEndedAt;
        if (duration) callLog.duration = duration;

        await callLog.save();
        await callLog.populate('participants.userId', 'name email');

        logger.info(`Call log ${id} updated by user ${userId}`);
        res.json({ callLog });
    } catch (error) {
        logger.error('Error updating call log:', error);
        res.status(500).json({ message: 'Failed to update call log' });
    }
};

// Delete call log (admin only)
const deleteCallLog = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        // Only admin can delete call logs
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }

        const callLog = await CallLog.findByIdAndDelete(id);
        if (!callLog) {
            return res.status(404).json({ message: 'Call log not found' });
        }

        logger.info(`Call log ${id} deleted by admin ${userId}`);
        res.json({ message: 'Call log deleted successfully' });
    } catch (error) {
        logger.error('Error deleting call log:', error);
        res.status(500).json({ message: 'Failed to delete call log' });
    }
};

// Get participant details for a session
const getSessionParticipants = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const userId = req.user.userId;

        // Verify session exists and user has access
        const session = await Session.findById(sessionId)
            .populate('userId', 'name email firstName lastName')
            .populate('therapistId', 'name email firstName lastName');

        if (!session) {
            return res.status(404).json({ message: 'Session not found' });
        }

        // Check if user has access to this session
        const isAdmin = req.user.role === 'admin';
        const isTherapist = req.user.role === 'therapist' && session.therapistId._id.toString() === userId;
        const isUser = session.userId._id.toString() === userId;

        if (!isAdmin && !isTherapist && !isUser) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Prepare participant details
        const participants = [];

        // Add user (patient) as participant
        if (session.userId) {
            participants.push({
                userId: session.userId._id,
                name: session.userId.name || `${session.userId.firstName} ${session.userId.lastName}`,
                email: session.userId.email,
                role: 'patient',
                isSelf: session.userId._id.toString() === userId
            });
        }

        // Add therapist as participant
        if (session.therapistId) {
            participants.push({
                userId: session.therapistId._id,
                name: session.therapistId.name || `${session.therapistId.firstName} ${session.therapistId.lastName}`,
                email: session.therapistId.email,
                role: 'therapist',
                isTherapist: true,
                isSelf: session.therapistId._id.toString() === userId
            });
        }

        res.json({
            success: true,
            data: {
                sessionId: session._id,
                sessionDate: session.date,
                sessionTime: session.time,
                participants
            }
        });
    } catch (error) {
        logger.error('Error getting session participants:', error);
        res.status(500).json({ message: 'Failed to get session participants' });
    }
};

module.exports = {
    createCallLog,
    getCallLogs,
    getCallLogById,
    updateCallLog,
    deleteCallLog,
    getSessionParticipants
};
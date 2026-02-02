const CallLog = require('../models/CallLog.model');
const Session = require('../models/Session.model');
const GroupSession = require('../models/GroupSession.model');
const User = require('../models/User.model');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

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

// Recording-related functions

// Start recording for a call
const startRecording = async (req, res) => {
    try {
        const { callLogId } = req.body;
        const userId = req.user.userId;

        // Find the call log
        const callLog = await CallLog.findById(callLogId);
        if (!callLog) {
            return res.status(404).json({ message: 'Call log not found' });
        }

        // Check if user has access to start recording for this call
        const isAdmin = req.user.role === 'admin';
        const isTherapist = req.user.role === 'therapist';

        // Check if user is a participant in the call
        const isParticipant = callLog.participants.some(p => p.userId.toString() === userId);

        if (!isAdmin && !isTherapist && !isParticipant) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Update recording status
        callLog.recordingStatus = 'recording';
        callLog.recordingStartTime = new Date();

        await callLog.save();

        // Populate the updated call log
        await callLog.populate('participants.userId', 'name email');

        res.json({
            message: 'Recording started successfully',
            callLog
        });
    } catch (error) {
        logger.error('Error starting recording:', error);
        res.status(500).json({ message: 'Failed to start recording' });
    }
};

// Stop recording for a call
const stopRecording = async (req, res) => {
    try {
        const { callLogId } = req.body;
        const userId = req.user.userId;

        // Find the call log
        const callLog = await CallLog.findById(callLogId);
        if (!callLog) {
            return res.status(404).json({ message: 'Call log not found' });
        }

        // Check if user has access to stop recording for this call
        const isAdmin = req.user.role === 'admin';
        const isTherapist = req.user.role === 'therapist';

        // Check if user is a participant in the call
        const isParticipant = callLog.participants.some(p => p.userId.toString() === userId);

        if (!isAdmin && !isTherapist && !isParticipant) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Update recording status
        callLog.recordingStatus = 'completed';
        callLog.recordingEndTime = new Date();

        // Calculate duration
        if (callLog.recordingStartTime) {
            callLog.recordingDuration = (callLog.recordingEndTime - callLog.recordingStartTime) / 1000; // in seconds
        }

        await callLog.save();

        // Populate the updated call log
        await callLog.populate('participants.userId', 'name email');

        res.json({
            message: 'Recording stopped successfully',
            callLog
        });
    } catch (error) {
        logger.error('Error stopping recording:', error);
        res.status(500).json({ message: 'Failed to stop recording' });
    }
};

// Upload recorded video
const uploadRecording = async (req, res) => {
    try {
        const { callLogId } = req.body;

        if (!req.file) {
            return res.status(400).json({ message: 'Recording file is required' });
        }

        const userId = req.user.userId;

        // Find the call log
        const callLog = await CallLog.findById(callLogId);
        if (!callLog) {
            return res.status(404).json({ message: 'Call log not found' });
        }

        // Check if user has access to upload recording for this call
        const isAdmin = req.user.role === 'admin';
        const isTherapist = req.user.role === 'therapist';

        // Check if user is a participant in the call
        const isParticipant = callLog.participants.some(p => p.userId.toString() === userId);

        if (!isAdmin && !isTherapist && !isParticipant) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Create uploads directory if it doesn't exist
        const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'recordings');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Generate unique filename
        const fileName = `recording_${callLogId}_${Date.now()}_${uuidv4()}.webm`;
        const filePath = path.join(uploadDir, fileName);

        // Move uploaded file to our destination
        const tempPath = req.file.path;
        fs.renameSync(tempPath, filePath);

        // Update call log with recording info
        callLog.recordingUrl = `/uploads/recordings/${fileName}`;
        callLog.recordingStatus = 'completed';
        callLog.recordingEndTime = new Date();

        // Calculate duration if not already calculated
        if (callLog.recordingStartTime && !callLog.recordingDuration) {
            callLog.recordingDuration = (callLog.recordingEndTime - callLog.recordingStartTime) / 1000; // in seconds
        }

        // Get file size
        const stats = fs.statSync(filePath);
        callLog.recordingSize = stats.size;
        callLog.recordingFormat = path.extname(fileName).substring(1);

        await callLog.save();

        // Populate the updated call log
        await callLog.populate('participants.userId', 'name email');

        res.json({
            message: 'Recording uploaded successfully',
            callLog
        });
    } catch (error) {
        logger.error('Error uploading recording:', error);
        res.status(500).json({ message: 'Failed to upload recording' });
    }
};

// Get recordings for a user
const getUserRecordings = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const userId = req.user.userId;
        const skip = (page - 1) * limit;

        // Find call logs where user is a participant and has a recording
        const callLogs = await CallLog.find({
            'participants.userId': userId,
            recordingUrl: { $exists: true, $ne: null },
            recordingStatus: 'completed'
        })
            .populate('sessionId', 'date time')
            .populate('groupSessionId', 'title')
            .populate('participants.userId', 'name email')
            .sort({ callStartedAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await CallLog.countDocuments({
            'participants.userId': userId,
            recordingUrl: { $exists: true, $ne: null },
            recordingStatus: 'completed'
        });

        res.json({
            recordings: callLogs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        logger.error('Error getting user recordings:', error);
        res.status(500).json({ message: 'Failed to get recordings' });
    }
};

// Get all recordings (admin only)
const getAllRecordings = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        // Only admin can access all recordings
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }

        const recordings = await CallLog.find({
            recordingUrl: { $exists: true, $ne: null }
        })
            .populate('sessionId', 'date time')
            .populate('groupSessionId', 'title')
            .populate('participants.userId', 'name email')
            .sort({ callStartedAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await CallLog.countDocuments({
            recordingUrl: { $exists: true, $ne: null }
        });

        res.json({
            recordings,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        logger.error('Error getting all recordings:', error);
        res.status(500).json({ message: 'Failed to get recordings' });
    }
};

// Get recording by ID
const getRecordingById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        const callLog = await CallLog.findById(id)
            .populate('sessionId', 'date time')
            .populate('groupSessionId', 'title')
            .populate('participants.userId', 'name email');

        if (!callLog) {
            return res.status(404).json({ message: 'Recording not found' });
        }

        // Check if user has access to this recording
        const isAdmin = req.user.role === 'admin';
        const isTherapist = req.user.role === 'therapist';
        const isParticipant = callLog.participants.some(p => p.userId.toString() === userId);

        if (!isAdmin && !isTherapist && !isParticipant) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Verify recording exists
        if (!callLog.recordingUrl) {
            return res.status(404).json({ message: 'Recording not found' });
        }

        res.json({ callLog });
    } catch (error) {
        logger.error('Error getting recording:', error);
        res.status(500).json({ message: 'Failed to get recording' });
    }
};

module.exports = {
    createCallLog,
    getCallLogs,
    getCallLogById,
    updateCallLog,
    deleteCallLog,
    getSessionParticipants,
    startRecording,
    stopRecording,
    uploadRecording,
    getUserRecordings,
    getAllRecordings,
    getRecordingById
};
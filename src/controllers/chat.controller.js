const ChatMessage = require('../models/ChatMessage.model');
const Session = require('../models/Session.model');
const ApiResponse = require('../utils/apiResponse');

// Get chat messages for a session
const getChatMessages = async (req, res, next) => {
    try {
        const { sessionId } = req.params;

        // Debug logging
        console.log('Chat request debug info:');
        console.log('- Session ID from params:', sessionId);
        console.log('- User ID from token:', req.user.userId);
        console.log('- User role:', req.user.role);

        // First, try to find the session regardless of user
        const sessionExists = await Session.findById(sessionId);
        console.log('- Session exists in DB:', !!sessionExists);
        if (sessionExists) {
            console.log('- Session userId:', sessionExists.userId);
            console.log('- Session therapistId:', sessionExists.therapistId);
            console.log('- Session status:', sessionExists.status);
        }

        // Verify the session belongs to the user or therapist
        let session = await Session.findOne({
            _id: sessionId,
            $or: [
                { userId: req.user.userId },
                { therapistId: req.user.userId }
            ]
        });

        if (!session) {
            // If not found, check if user is admin
            if (req.user.role === 'admin') {
                session = await Session.findById(sessionId);
            }
        }

        if (!session) {
            return res.status(404).json(ApiResponse.error('Session not found or unauthorized access'));
        }

        const messages = await ChatMessage.find({ sessionId })
            .populate('senderId', 'name')
            .sort({ timestamp: 1 });

        res.status(200).json(ApiResponse.success({ messages }, 'Chat messages retrieved successfully'));
    } catch (error) {
        console.error('Chat controller error:', error);
        next(error);
    }
};

// Send a chat message
const sendMessage = async (req, res, next) => {
    try {
        const { sessionId } = req.params;
        const { message } = req.body;

        // Debug logging
        console.log('Send message debug info:');
        console.log('- Session ID from params:', sessionId);
        console.log('- User ID from token:', req.user.userId);
        console.log('- User role:', req.user.role);
        console.log('- Message:', message);

        // First, try to find the session regardless of user
        const sessionExists = await Session.findById(sessionId);
        console.log('- Session exists in DB:', !!sessionExists);
        if (sessionExists) {
            console.log('- Session userId:', sessionExists.userId);
            console.log('- Session therapistId:', sessionExists.therapistId);
            console.log('- Session status:', sessionExists.status);
        }

        // Verify the session belongs to the user or therapist
        let session = await Session.findOne({
            _id: sessionId,
            $or: [
                { userId: req.user.userId },
                { therapistId: req.user.userId }
            ]
        });

        if (!session) {
            // If not found, check if user is admin
            if (req.user.role === 'admin') {
                session = await Session.findById(sessionId);
            }
        }

        if (!session) {
            return res.status(404).json(ApiResponse.error('Session not found or unauthorized access'));
        }

        // Determine sender type
        let senderType = 'user';
        if (req.user.role === 'therapist' || req.user.role === 'admin') {
            senderType = 'therapist';
        }

        const chatMessage = new ChatMessage({
            sessionId,
            senderId: req.user.userId,
            message,
            senderType
        });

        await chatMessage.save();

        await chatMessage.populate('senderId', 'name');

        res.status(201).json(ApiResponse.success({ message: chatMessage }, 'Message sent successfully'));
    } catch (error) {
        console.error('Send message error:', error);
        next(error);
    }
};

module.exports = {
    getChatMessages,
    sendMessage
};
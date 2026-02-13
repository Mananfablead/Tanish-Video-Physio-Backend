const express = require('express');
const { getChatMessages, sendMessage } = require('../controllers/chat.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Join a chat room
router.post('/join', (req, res) => {
    // This would typically be handled via socket.io
    // For REST API, we just return success
    res.json({ message: 'Joined chat room successfully' });
});

// Leave a chat room
router.post('/leave', (req, res) => {
    // This would typically be handled via socket.io
    // For REST API, we just return success
    res.json({ message: 'Left chat room successfully' });
});

// Send a chat message
router.post('/send/:sessionId', sendMessage);

// Special endpoint for default live chat (no session validation)
router.post('/send/default-live-chat', async (req, res, next) => {
    try {
        const { message } = req.body;

        // Validate required fields
        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Message is required and must be a non-empty string',
                error: null,
                statusCode: 400
            });
        }

        // For default live chat, we'll create a special message without session validation
        // This is for general support chat that doesn't belong to a specific session
        const ChatMessage = require('../models/ChatMessage.model');

        const chatMessage = new ChatMessage({
            sessionId: null, // No session for default chat
            senderId: req.user.userId,
            message,
            senderType: req.user.role === 'admin' ? 'admin' : 'user',
            messageType: 'default-chat'
        });

        await chatMessage.save();
        await chatMessage.populate('senderId', 'name');

        res.status(201).json({
            success: true,
            message: 'Message sent successfully',
            data: { message: chatMessage },
            statusCode: 201
        });
    } catch (error) {
        console.error('Default chat send message error:', error);
        next(error);
    }
});

// Debug endpoint to check session info
router.get('/debug/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = await Session.findById(sessionId)
            .populate('userId', 'name email')
            .populate('therapistId', 'name email');

        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Session not found in database',
                sessionId: sessionId
            });
        }

        res.json({
            success: true,
            message: 'Session found',
            sessionId: sessionId,
            session: {
                _id: session._id,
                userId: session.userId,
                therapistId: session.therapistId,
                status: session.status,
                date: session.date,
                time: session.time
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching session info',
            error: error.message
        });
    }
});

// Get chat messages for a session
router.get('/:sessionId', getChatMessages);

// Special endpoint to get default chat messages (for support chat)
router.get('/default/messages', async (req, res, next) => {
    try {
        const ChatMessage = require('../models/ChatMessage.model');

        // Get default chat messages (where sessionId is null and messageType is default-chat)
        const messages = await ChatMessage.find({
            sessionId: null,
            messageType: 'default-chat'
        })
            .populate('senderId', 'name email role')
            .sort({ createdAt: 1 }); // Sort by creation time, oldest first

        res.status(200).json({
            success: true,
            message: 'Default chat messages retrieved successfully',
            data: { messages },
            statusCode: 200
        });
    } catch (error) {
        console.error('Error fetching default chat messages:', error);
        next(error);
    }
});

// Typing indicator
router.post('/typing', (req, res) => {
    // This would typically be handled via socket.io
    // For REST API, we just return success
    res.json({ message: 'Typing indicator sent' });
});

// Stop typing indicator
router.post('/stop-typing', (req, res) => {
    // This would typically be handled via socket.io
    // For REST API, we just return success
    res.json({ message: 'Stop typing indicator sent' });
});

module.exports = router;
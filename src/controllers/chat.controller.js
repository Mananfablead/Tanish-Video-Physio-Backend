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

        // Validate required fields
        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Message is required and must be a non-empty string',
                error: null,
                statusCode: 400
            });
        }

        // Handle default live chat specially
        if (sessionId === 'default-live-chat') {
            const chatMessage = new ChatMessage({
                sessionId: null,
                senderId: req.user.userId,
                message,
                senderType: req.user.role === 'admin' ? 'admin' : 'user',
                messageType: 'default-chat'
            });

            await chatMessage.save();
            await chatMessage.populate('senderId', 'name');

            // Broadcast to all users in default chat room
            const io = req.app.get('io');
            if (io) {
                // Emit to all users in default chat room
                io.to('default-live-chat').emit('admin-reply-received', {
                    message: chatMessage,
                    senderName: chatMessage.senderId.name || 'User'
                });

                // Also emit to all connected users for default chat
                io.emit('admin-reply-to-user', {
                    message: chatMessage
                });

                // Emit to all admins for default chat notification
                io.emit('admin-new-message', {
                    content: chatMessage.message,
                    senderId: chatMessage.senderId._id || chatMessage.senderId,
                    senderName: chatMessage.senderId.name || 'User',
                    timestamp: chatMessage.createdAt,
                    messageType: chatMessage.messageType,
                    message: chatMessage,
                    senderType: chatMessage.senderType,
                    userId: req.user.userId,
                    userName: chatMessage.senderId.name || 'User'
                });
            }

            return res.status(201).json({
                success: true,
                message: 'Message sent successfully',
                data: { message: chatMessage },
                statusCode: 201
            });
        }

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

        // Broadcast to all users in the session room via socket
        const io = req.app.get('io');
        if (io) {
            // Emit to all users in the session room
            io.to(sessionId).emit('message-received', {
                content: chatMessage.message,
                senderId: req.user.userId,
                senderName: chatMessage.senderId.name || 'User',
                timestamp: chatMessage.createdAt,
                senderType: chatMessage.senderType,
                message: chatMessage // Include full message object for compatibility
            });

            // Also emit to all admins for notification
            io.emit('admin-new-message', {
                content: chatMessage.message,
                senderId: chatMessage.senderId._id || chatMessage.senderId,
                senderName: chatMessage.senderId.name || 'User',
                timestamp: chatMessage.createdAt,
                messageType: 'live-chat',
                message: chatMessage,
                senderType: chatMessage.senderType,
                userId: req.user.userId,
                userName: chatMessage.senderId.name || 'User',
                sessionId: sessionId
            });
        }

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
const ChatMessage = require('../models/ChatMessage.model');
const Session = require('../models/Session.model');
const User = require('../models/User.model');
const logger = require('../utils/logger');

// Function to setup chat socket handlers
const setupChatHandlers = (io, socket) => {
    // Join a chat room
    socket.on('join-room', async (data) => {
        try {
            // Handle both string ID and object formats
            const sessionId = typeof data === 'string' ? data : (data.sessionId || data.groupSessionId);

            if (!sessionId) {
                socket.emit('error', { message: 'Session ID is required' });
                return;
            }

            // Verify session exists and user has access
            const session = await Session.findById(sessionId).populate('userId');
            if (!session) {
                socket.emit('error', { message: 'Session not found' });
                return;
            }

            // Add user to the room
            socket.join(sessionId);
            logger.info(`User ${socket.user.userId} joined session room ${sessionId}`);

            // Notify others in the room
            socket.to(sessionId).emit('user-joined', {
                userId: socket.user.userId,
                sessionId
            });
        } catch (error) {
            logger.error('Error joining room:', error);
            socket.emit('error', { message: 'Failed to join room' });
        }
    });

    // Leave a chat room
    socket.on('leave-room', (data) => {
        // Handle both string ID and object formats
        const sessionId = typeof data === 'string' ? data : (data.sessionId || data.groupSessionId);

        if (!sessionId) {
            socket.emit('error', { message: 'Session ID is required' });
            return;
        }

        socket.leave(sessionId);
        logger.info(`User ${socket.user.userId} left session room ${sessionId}`);

        socket.to(sessionId).emit('user-left', {
            userId: socket.user.userId,
            sessionId
        });
    });

    // Send a message
    socket.on('new-message', async (data) => {
        try {
            const { sessionId, message } = data;

            // Verify session exists and user has access
            const session = await Session.findById(sessionId);
            if (!session) {
                socket.emit('error', { message: 'Session not found' });
                return;
            }

            // Create new message
            const chatMessage = new ChatMessage({
                sessionId,
                senderId: socket.user.userId,
                senderType: 'user', // This would be 'therapist' if sent by therapist
                message: message.trim()
            });

            await chatMessage.save();
            await chatMessage.populate('senderId', 'name');

            // Broadcast message to room
            io.to(sessionId).emit('new-message', {
                message: chatMessage
            });

            logger.info(`Message sent in session ${sessionId} by user ${socket.user.userId}`);
        } catch (error) {
            logger.error('Error sending message:', error);
            socket.emit('error', { message: 'Failed to send message' });
        }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        logger.info(`User ${socket.user.userId} disconnected from chat`);
    });
};

module.exports = setupChatHandlers;
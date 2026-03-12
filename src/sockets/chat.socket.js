const ChatMessage = require('../models/ChatMessage.model');
const Session = require('../models/Session.model');
const User = require('../models/User.model');
const logger = require('../utils/logger');

// Generate UUID function
const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

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

            // Support rooms (support-<userId>) and admin rooms do not correspond to Session documents
            if (typeof sessionId === 'string' && (sessionId.startsWith('support-') || sessionId === 'admin-support-room' || sessionId === 'default-chat-room')) {
                socket.join(sessionId);
                logger.info(`User ${socket.user.userId} joined special room ${sessionId}`);
                socket.to(sessionId).emit('user-joined', {
                    userId: socket.user.userId,
                    sessionId
                });
                return;
            }

            // Regular session-based rooms: verify session exists and user has access
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

        socket.to(sessionId).emit('user-left', {
            userId: socket.user.userId,
            sessionId
        });
    });

    // Send a message (real-time)
    socket.on('send-message', async (data) => {
        try {
            const { roomId, roomType, message } = data;
            
            // Determine session ID based on room type
            const sessionId = roomType === 'group' ? roomId.replace('group-', '') : roomId;

            // Handle default live chat and support rooms specially (no Session required)
            let session = null;
            const isDefaultLive = sessionId === 'default-live-chat';
            const isSupportRoom = typeof sessionId === 'string' && sessionId.startsWith('support-');

            if (!isDefaultLive && !isSupportRoom) {
                // Verify session exists and user has access for regular sessions
                session = await Session.findById(sessionId);
                if (!session) {
                    socket.emit('error', { message: 'Session not found' });
                    return;
                }
            }

            // Determine sender type
            let senderType = 'user';
            if (socket.user.role === 'therapist' || socket.user.role === 'admin') {
                senderType = 'therapist';
            }

            // Create new message with UUID
            const chatMessageData = {
                messageId: generateUUID(), // Add UUID for deduplication
                sessionId: isDefaultLive || isSupportRoom ? null : sessionId, // No Session reference for default/support chat
                senderId: socket.user.userId,
                senderType: senderType,
                message: message.content || message.message || message.text || '', // Ensure message is a string
                messageType: isDefaultLive || isSupportRoom ? 'default-chat' : 'live-chat',
                attachments: message.attachments || []
            };

            // If message is empty but has attachments, add a placeholder text
            if (!chatMessageData.message.trim() && chatMessageData.attachments.length > 0) {
                chatMessageData.message = '📎 File attachment';
            }

            // If this is a support/private chat room, store the chatRoom name for querying
            if (isSupportRoom) {
                chatMessageData.chatRoom = sessionId;
            }

            const chatMessage = new ChatMessage(chatMessageData);

            await chatMessage.save();
            await chatMessage.populate('senderId', 'name');

            // Prepare message data for broadcast
            const messageData = {
                messageId: chatMessage.messageId, // Include UUID for deduplication
                content: chatMessage.message,
                senderId: socket.user.userId,
                senderName: chatMessage.senderId.name || 'User',
                timestamp: chatMessage.createdAt,
                messageType: chatMessage.messageType,
                message: chatMessage, // Include full message object for compatibility
                sessionId: sessionId,
                attachments: chatMessage.attachments || []
            };

            // Broadcast message to room (real-time) - single source of truth
            io.to(roomId).emit('message-received', {
                messageId: chatMessage.messageId,
                content: chatMessage.message,
                senderId: socket.user.userId,
                senderName: chatMessage.senderId.name || 'User',
                timestamp: chatMessage.createdAt,
                sessionId: sessionId,
                chatRoom: chatMessage.chatRoom || null,
                senderType: senderType,
                _id: chatMessage._id,
                attachments: chatMessage.attachments || []
            });

            // For support rooms, also emit message-received to admin_notifications so admin sees it in real-time
            if (isSupportRoom) {
                io.to('admin_notifications').emit('message-received', {
                    messageId: chatMessage.messageId,
                    content: chatMessage.message,
                    senderId: socket.user.userId,
                    senderName: chatMessage.senderId.name || 'User',
                    timestamp: chatMessage.createdAt,
                    sessionId: sessionId,
                    chatRoom: chatMessage.chatRoom || null,
                    senderType: senderType,
                    _id: chatMessage._id,
                    attachments: chatMessage.attachments || []
                });
            }

            // Emit admin notification if message is from user OR if this is a support room message from admin (so admin can see it in real-time)
            if (senderType === 'user' || sessionId === 'default-live-chat' || (isSupportRoom && senderType !== 'user')) {
                // Emit to all admins for default chat or user messages or support room messages
                io.emit('admin-new-message', {
                    ...messageData,
                    senderType: senderType,
                    userId: socket.user.userId,
                    userName: chatMessage.senderId.name || 'User',
                    chatRoom: chatMessage.chatRoom || null
                });

                // Also emit to admin support room for presence & notification
                const adminPayload = {
                    ...messageData,
                    senderType: senderType,
                    userId: socket.user.userId,
                    userName: chatMessage.senderId.name || 'User',
                    chatRoom: chatMessage.chatRoom || null
                };

                io.to('admin-support-room').emit('new-support-message', adminPayload);
                // Also send to admin notifications channel so admins connected via notifications socket receive it
                io.to('admin_notifications').emit('new-support-message', adminPayload);
            }

            logger.info(`Message sent by ${socket.user.userId} in room ${roomId}`);

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
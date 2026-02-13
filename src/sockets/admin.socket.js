const logger = require('../utils/logger');

// Function to setup admin socket handlers
const setupAdminHandlers = (io, socket) => {
    // Join admin support room
    socket.on('join-default-chat', async () => {
        try {
            const userId = socket.user?.userId;
            if (!userId) {
                socket.emit('error', { message: 'User not authenticated' });
                return;
            }

            // Join the default chat room for admin support
            socket.join('default-chat-room');

            logger.info(`User ${userId} joined default chat room`);

            // Notify admin about new user in chat
            socket.to('admin-support-room').emit('user-joined-default-chat', {
                userId,
                timestamp: new Date()
            });

            socket.emit('default-chat-joined', {
                message: 'Successfully joined default chat room'
            });
        } catch (error) {
            logger.error('Error joining default chat:', error);
            socket.emit('error', { message: 'Failed to join chat room' });
        }
    });

    // Leave default chat room
    socket.on('leave-default-chat', async () => {
        try {
            const userId = socket.user?.userId;
            if (!userId) {
                return;
            }

            socket.leave('default-chat-room');

            logger.info(`User ${userId} left default chat room`);

            // Notify admin about user leaving
            socket.to('admin-support-room').emit('user-left-default-chat', {
                userId,
                timestamp: new Date()
            });
        } catch (error) {
            logger.error('Error leaving default chat:', error);
        }
    });

    // Admin status request
    socket.on('admin-status-request', async () => {
        try {
            // Check if any admins are online
            const adminSockets = await io.in('admin-support-room').allSockets();
            const isAdminOnline = adminSockets.size > 0;

            socket.emit('admin-status-update', {
                online: isAdminOnline,
                onlineCount: adminSockets.size
            });
        } catch (error) {
            logger.error('Error checking admin status:', error);
        }
    });

    // Handle admin presence
    socket.on('admin-presence', async (data) => {
        try {
            const userId = socket.user?.userId;
            if (!userId) {
                return;
            }

            // Broadcast admin presence to all users in default chat
            socket.to('default-chat-room').emit('admin-presence', {
                presence: data.presence || 'online',
                adminId: userId,
                timestamp: new Date()
            });
        } catch (error) {
            logger.error('Error handling admin presence:', error);
        }
    });

    // Handle admin replies to default chat
    socket.on('admin-reply-default-chat', async (data) => {
        try {
            const userId = socket.user?.userId;
            if (!userId) {
                socket.emit('error', { message: 'Admin not authenticated' });
                return;
            }

            // Broadcast admin message to all users in default chat
            socket.to('default-chat-room').emit('admin-new-message', {
                content: data.message,
                senderId: userId,
                senderName: data.senderName || 'Support Team',
                senderType: 'admin',
                timestamp: new Date()
            });

            logger.info(`Admin ${userId} sent message to default chat`);
        } catch (error) {
            logger.error('Error sending admin reply:', error);
            socket.emit('error', { message: 'Failed to send message' });
        }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        logger.info(`Admin socket ${socket.id} disconnected`);

        // Notify users if this was an admin socket
        if (socket.rooms.has('admin-support-room')) {
            socket.to('default-chat-room').emit('admin-presence', {
                presence: 'offline',
                timestamp: new Date()
            });
        }
    });
};

module.exports = { setupAdminHandlers };
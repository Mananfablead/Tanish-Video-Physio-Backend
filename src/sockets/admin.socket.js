const logger = require('../utils/logger');

// Store online admins
const onlineAdmins = new Map();

// Function to setup admin socket handlers
const setupAdminHandlers = (io, socket) => {
    // Handle admin connection
    if (socket.user.role === 'admin') {
        // Add admin to online admins list
        onlineAdmins.set(socket.user.userId, {
            socketId: socket.id,
            userId: socket.user.userId,
            name: socket.user.name,
            connectedAt: new Date()
        });

        logger.info(`Admin ${socket.user.userId} (${socket.user.name}) connected`);

        // Broadcast admin status to all clients
        io.emit('admin-status-update', {
            online: true,
            adminId: socket.user.userId,
            adminName: socket.user.name,
            timestamp: new Date()
        });

        // Broadcast admin presence to default chat room
        io.to('default-live-chat').emit('admin-presence', {
            presence: 'online',
            adminId: socket.user.userId,
            adminName: socket.user.name
        });
    }

    // Handle admin joining default chat room
    socket.on('join-default-chat', () => {
        socket.join('default-live-chat');
        logger.info(`Admin ${socket.user.userId} joined default chat room`);

        // Notify clients that admin is in the chat room
        socket.to('default-live-chat').emit('admin-in-room', {
            adminId: socket.user.userId,
            adminName: socket.user.name
        });
    });

    // Handle admin leaving default chat room
    socket.on('leave-default-chat', () => {
        socket.leave('default-live-chat');
        logger.info(`Admin ${socket.user.userId} left default chat room`);
    });

    // Handle admin status request
    socket.on('admin-status-request', () => {
        if (socket.user.role === 'admin') {
            const onlineCount = getOnlineAdminsCount();
            const anyAdminOnline = isAnyAdminOnline();

            // Send current status back to requesting client
            socket.emit('admin-status-update', {
                online: anyAdminOnline,
                onlineCount: onlineCount,
                anyAdminOnline: anyAdminOnline,
                adminsOnline: onlineCount > 0,
                timestamp: new Date()
            });

            logger.info(`Admin status sent to client: ${onlineCount} admins online`);
        }
    });

    // Handle admin status update
    socket.on('admin-status-change', (data) => {
        if (socket.user.role === 'admin') {
            const status = data.status || 'online';
            logger.info(`Admin ${socket.user.userId} status changed to: ${status}`);

            // Broadcast to all clients
            io.emit('admin-status-update', {
                online: status === 'online',
                status: status,
                adminId: socket.user.userId,
                adminName: socket.user.name,
                timestamp: new Date()
            });

            // Broadcast to default chat room
            io.to('default-live-chat').emit('admin-presence', {
                presence: status,
                adminId: socket.user.userId,
                adminName: socket.user.name
            });
        }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        if (socket.user.role === 'admin') {
            // Remove admin from online list
            onlineAdmins.delete(socket.user.userId);
            logger.info(`Admin ${socket.user.userId} disconnected`);

            // Broadcast admin offline status
            io.emit('admin-status-update', {
                online: false,
                adminId: socket.user.userId,
                adminName: socket.user.name,
                timestamp: new Date()
            });

            // Broadcast to default chat room
            io.to('default-live-chat').emit('admin-presence', {
                presence: 'offline',
                adminId: socket.user.userId,
                adminName: socket.user.name
            });
        }
    });
};

// Helper function to get online admins count
const getOnlineAdminsCount = () => {
    return onlineAdmins.size;
};

// Helper function to check if any admin is online
const isAnyAdminOnline = () => {
    return onlineAdmins.size > 0;
};

module.exports = {
    setupAdminHandlers,
    getOnlineAdminsCount,
    isAnyAdminOnline,
    onlineAdmins
};
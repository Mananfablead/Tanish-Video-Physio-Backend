const logger = require('../utils/logger');

// Function to setup notification socket handlers
const setupNotificationHandlers = (io, socket) => {
    // Join user's personal notification room
    socket.on('join-notifications', async (data) => {
        try {
            const userId = socket.user?.userId;
            if (!userId) {
                socket.emit('error', { message: 'User not authenticated' });
                return;
            }

            // Join user's personal notification room
            const userNotificationRoom = `user_notifications_${userId}`;
            socket.join(userNotificationRoom);

            logger.info(`User ${userId} joined notification room ${userNotificationRoom}`);

            socket.emit('notifications-joined', {
                message: 'Successfully joined notifications channel',
                room: userNotificationRoom
            });
        } catch (error) {
            logger.error('Error joining notifications:', error);
            socket.emit('error', { message: 'Failed to join notifications' });
        }
    });

    // Admin joins admin notification room
    socket.on('join-admin-notifications', async (data) => {
        try {
            const userId = socket.user?.userId;
            const userRole = socket.user?.role;

            if (!userId || userRole !== 'admin') {
                socket.emit('error', { message: 'Admin access required' });
                return;
            }

            // Join admin notification room
            const adminNotificationRoom = 'admin_notifications';
            socket.join(adminNotificationRoom);

            logger.info(`Admin ${userId} joined admin notification room`);

            socket.emit('admin-notifications-joined', {
                message: 'Successfully joined admin notifications channel',
                room: adminNotificationRoom
            });
        } catch (error) {
            logger.error('Error joining admin notifications:', error);
            socket.emit('error', { message: 'Failed to join admin notifications' });
        }
    });

    // Handle connection failure reports from clients
    socket.on('report-connection-failure', async (data) => {
        try {
            const userId = socket.user?.userId;
            const { sessionId, errorDetails } = data;

            if (!userId || !sessionId) {
                socket.emit('error', { message: 'User ID and Session ID required' });
                return;
            }

            logger.info(`Connection failure reported by user ${userId} for session ${sessionId}`);

            // Broadcast to admin notification room
            const adminNotificationRoom = 'admin_notifications';
            io.to(adminNotificationRoom).emit('admin-notification', {
                type: 'connection_failure',
                title: 'Connection Issue Reported',
                message: `User ${userId} is experiencing connection issues in session ${sessionId}`,
                sessionId: sessionId,
                userId: userId,
                errorDetails: errorDetails,
                timestamp: new Date().toISOString(),
                priority: 'high'
            });

            // Confirm receipt to client
            socket.emit('connection-failure-reported', {
                message: 'Connection issue reported to admin team',
                sessionId: sessionId
            });

        } catch (error) {
            logger.error('Error handling connection failure report:', error);
            socket.emit('error', { message: 'Failed to report connection issue' });
        }
    });

    // Handle Google Meet link generation notification to client
    socket.on('notify-client-google-meet', async (data) => {
        try {
            const { userId, sessionId, googleMeetLink, googleMeetCode } = data;

            if (!userId || !sessionId || !googleMeetLink) {
                logger.error('Missing required data for client notification');
                return;
            }

            // Send notification to specific user
            const userNotificationRoom = `user_notifications_${userId}`;
            io.to(userNotificationRoom).emit('client-notification', {
                type: 'google_meet_ready',
                title: 'Alternative Meeting Ready',
                message: 'Your therapist has prepared a Google Meet link as an alternative. Please check your session details.',
                sessionId: sessionId,
                googleMeetLink: googleMeetLink,
                googleMeetCode: googleMeetCode,
                timestamp: new Date().toISOString(),
                priority: 'medium'
            });

            logger.info(`Google Meet notification sent to user ${userId} for session ${sessionId}`);

        } catch (error) {
            logger.error('Error notifying client about Google Meet:', error);
        }
    });

    // Handle general admin notifications
    socket.on('send-admin-notification', async (data) => {
        try {
            const senderId = socket.user?.userId;
            const senderRole = socket.user?.role;

            if (senderRole !== 'admin') {
                socket.emit('error', { message: 'Admin access required' });
                return;
            }

            const { type, title, message, targetUserId, priority = 'medium' } = data;

            if (!type || !title || !message) {
                socket.emit('error', { message: 'Type, title, and message are required' });
                return;
            }

            // Send to specific user or all admins
            if (targetUserId) {
                const userNotificationRoom = `user_notifications_${targetUserId}`;
                io.to(userNotificationRoom).emit('client-notification', {
                    type,
                    title,
                    message,
                    timestamp: new Date().toISOString(),
                    priority
                });
            } else {
                // Broadcast to all admins
                const adminNotificationRoom = 'admin_notifications';
                io.to(adminNotificationRoom).emit('admin-notification', {
                    type,
                    title,
                    message,
                    senderId,
                    timestamp: new Date().toISOString(),
                    priority
                });
            }

            socket.emit('admin-notification-sent', {
                message: 'Notification sent successfully'
            });

        } catch (error) {
            logger.error('Error sending admin notification:', error);
            socket.emit('error', { message: 'Failed to send notification' });
        }
    });
};

module.exports = { setupNotificationHandlers };
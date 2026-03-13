const Notification = require('../models/Notification.model');
const logger = require('../utils/logger');

// Create a notification
const createNotification = async (notificationData) => {
    try {
        const notification = new Notification(notificationData);
        await notification.save();
        return notification;
    } catch (error) {
        logger.error('Error creating notification:', error);
        throw error;
    }
};

// Create multiple notifications at once
const createNotifications = async (notificationsArray) => {
    try {
        const notifications = await Notification.insertMany(notificationsArray);
        return notifications;
    } catch (error) {
        logger.error('Error creating notifications:', error);
        throw error;
    }
};

// Get notifications for a user (client/therapist)
const getUserNotifications = async (userId, options = {}) => {
    try {
        const { page = 1, limit = 20, unreadOnly = false } = options;
        const skip = (page - 1) * limit;

        // IMPORTANT: User should only receive their own notifications.
        // Do not include global recipientType notifications, to avoid cross-user leakage.
        let query = { userId: userId };

        if (unreadOnly) {
            query.read = false;
        }

        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Notification.countDocuments(query);
        const unreadCount = await Notification.countDocuments({ ...query, read: false });

        return { notifications, total, unreadCount };
    } catch (error) {
        logger.error('Error getting user notifications:', error);
        throw error;
    }
};

// Get admin notifications
const getAdminNotifications = async (adminId, options = {}) => {
    try {
        const { page = 1, limit = 20, unreadOnly = false } = options;
        const skip = (page - 1) * limit;

        let query = {
            $or: [
                { adminId: adminId },
                { recipientType: 'admin' }
            ]
        };

        if (unreadOnly) {
            query.read = false;
        }

        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Notification.countDocuments(query);
        const unreadCount = await Notification.countDocuments({ ...query, read: false });

        return { notifications, total, unreadCount };
    } catch (error) {
        logger.error('Error getting admin notifications:', error);
        throw error;
    }
};

// Mark notification as read
const markNotificationAsRead = async (notificationId, userId, isAdmin = false) => {
    try {
        const query = { _id: notificationId };

        if (isAdmin) {
            query.adminId = userId;
        } else {
            query.userId = userId;
        }

        const notification = await Notification.findOneAndUpdate(
            query,
            { read: true },
            { new: true }
        );

        return notification;
    } catch (error) {
        logger.error('Error marking notification as read:', error);
        throw error;
    }
};

// Mark all notifications as read for a user
const markAllNotificationsAsRead = async (userId, isAdmin = false) => {
    try {
        let query = { read: false };

        if (isAdmin) {
            query.recipientType = 'admin';
        } else {
            // Only mark the authenticated user's notifications as read
            query = { userId: userId, read: false };
        }

        const result = await Notification.updateMany(query, { read: true });
        return result;
    } catch (error) {
        logger.error('Error marking all notifications as read:', error);
        throw error;
    }
};

// Delete a notification
const deleteNotification = async (notificationId, userId, isAdmin = false) => {
    try {
        const query = { _id: notificationId };

        if (isAdmin) {
            query.adminId = userId;
        } else {
            query.userId = userId;
        }

        const notification = await Notification.findOneAndDelete(query);
        return notification;
    } catch (error) {
        logger.error('Error deleting notification:', error);
        throw error;
    }
};

// Store and emit notification helper
const storeAndEmitNotification = async (io, notificationData, targetRoom, eventName) => {
    try {
        // Save to database
        const notification = new Notification(notificationData);
        await notification.save();

        // Emit via socket
        io.to(targetRoom).emit(eventName, {
            id: notification._id,
            ...notification.toObject(),
            timestamp: notification.createdAt
        });

        return notification;
    } catch (error) {
        logger.error('Error storing and emitting notification:', error);
        throw error;
    }
};

module.exports = {
    createNotification,
    createNotifications,
    getUserNotifications,
    getAdminNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    storeAndEmitNotification
};
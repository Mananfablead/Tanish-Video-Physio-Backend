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

// Get notifications for a user
const getUserNotifications = async (userId) => {
    try {
        const notifications = await Notification.find({
            $or: [
                { userId: userId }, // User-specific notifications
                { userId: null } // Global notifications
            ]
        }).sort({ createdAt: -1 });

        return notifications;
    } catch (error) {
        logger.error('Error getting user notifications:', error);
        throw error;
    }
};

// Mark notification as read
const markNotificationAsRead = async (notificationId, userId) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: notificationId, userId: userId },
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
const markAllNotificationsAsRead = async (userId) => {
    try {
        const result = await Notification.updateMany(
            { userId: userId, read: false },
            { read: true }
        );

        return result;
    } catch (error) {
        logger.error('Error marking all notifications as read:', error);
        throw error;
    }
};

// Delete a notification
const deleteNotification = async (notificationId, userId) => {
    try {
        const notification = await Notification.findOneAndDelete(
            { _id: notificationId, userId: userId }
        );

        return notification;
    } catch (error) {
        logger.error('Error deleting notification:', error);
        throw error;
    }
};

module.exports = {
    createNotification,
    getUserNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification
};
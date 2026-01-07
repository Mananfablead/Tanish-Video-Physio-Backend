const Notification = require('../models/Notification.model');
const ApiResponse = require('../utils/apiResponse');

// Get all notifications for authenticated user
const getAllNotifications = async (req, res, next) => {
    try {
        const notifications = await Notification.find({
            $or: [
                { userId: req.user.userId }, // User-specific notifications
                { userId: null } // Global notifications
            ]
        }).sort({ createdAt: -1 });

        res.status(200).json(ApiResponse.success({ notifications }, 'Notifications retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Send a notification (admin only)
const sendNotification = async (req, res, next) => {
    try {
        const { title, message, type, userId = null } = req.body;

        const notification = new Notification({
            title,
            message,
            type,
            userId // If null, it's a global notification
        });

        await notification.save();

        res.status(201).json(ApiResponse.success({ notification }, 'Notification sent successfully'));
    } catch (error) {
        next(error);
    }
};

// Mark notification as read
const markAsRead = async (req, res, next) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.userId },
            { read: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json(ApiResponse.error('Notification not found'));
        }

        res.status(200).json(ApiResponse.success({ notification }, 'Notification marked as read'));
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAllNotifications,
    sendNotification,
    markAsRead
};
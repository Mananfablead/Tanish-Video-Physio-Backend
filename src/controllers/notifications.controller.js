const Notification = require('../models/Notification.model');
const ApiResponse = require('../utils/apiResponse');
const NotificationService = require('../services/notificationService');
const User = require('../models/User.model');

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
        const { title, message, type, recipientType, userId = null, channels = {} } = req.body;

        // Save to database first (for in-app notifications)
        if (channels.inApp !== false) {
            const notification = new Notification({
                title,
                message,
                type,
                userId, // If null, it's a global notification
                channels: channels
            });

            await notification.save();
        }

        // Send via NotificationService (email/WhatsApp)
        let recipients = [];
        
        if (recipientType === 'all') {
            // Get all users and therapists
            const users = await User.find({ role: { $in: ['user', 'therapist'] } }).select('email phone name');
            recipients = users.map(user => ({
                email: user.email,
                phone: user.phone,
                name: user.name
            }));
        } else if (recipientType === 'users') {
            const users = await User.find({ role: 'user' }).select('email phone name');
            recipients = users.map(user => ({
                email: user.email,
                phone: user.phone,
                name: user.name
            }));
        } else if (recipientType === 'therapists') {
            const therapists = await User.find({ role: 'therapist' }).select('email phone name');
            recipients = therapists.map(user => ({
                email: user.email,
                phone: user.phone,
                name: user.name
            }));
        } else if (recipientType === 'specific' && userId) {
            const user = await User.findById(userId).select('email phone name');
            if (user) {
                recipients = [{
                    email: user.email,
                    phone: user.phone,
                    name: user.name
                }];
            }
        }

        // Send notifications via NotificationService
        if (recipients.length > 0) {
            const notificationResults = [];
            
            for (const recipient of recipients) {
                // Prepare recipient data
                const recipientData = {
                    email: recipient.email,
                    phone: recipient.phone
                };

                // Prepare notification data
                const notificationData = {
                    title: title,
                    message: message,
                    userName: recipient.name
                };

                // Send via selected channels
                const result = {
                    recipient: recipient.email || recipient.phone,
                    channels: []
                };

                // Send email if selected
                if (channels.email !== false && recipient.email) {
                    try {
                        const emailResult = await NotificationService.sendEmail(
                            recipient.email,
                            {
                                subject: title,
                                template: (data) => `
                                    <h2>${data.title}</h2>
                                    <p>Dear ${data.userName || 'Valued User'},</p>
                                    <p>${data.message}</p>
                                    <p>Best regards,<br>Tanish Physio Team</p>
                                `
                            },
                            notificationData
                        );
                        result.channels.push('email');
                    } catch (emailError) {
                        console.error('Email sending failed:', emailError);
                        result.emailError = emailError.message;
                    }
                }

                // Send WhatsApp if selected
                if (channels.whatsapp !== false && recipient.phone) {
                    try {
                        const whatsappResult = await NotificationService.sendWhatsApp(
                            recipient.phone,
                            (data) => `${data.title}: ${data.message}`,
                            notificationData
                        );
                        if (whatsappResult.success) {
                            result.channels.push('whatsapp');
                        } else {
                            result.whatsappError = whatsappResult.error;
                        }
                    } catch (whatsappError) {
                        console.error('WhatsApp sending failed:', whatsappError);
                        result.whatsappError = whatsappError.message;
                    }
                }

                notificationResults.push(result);
            }
            
            console.log('Notification delivery results:', notificationResults);
        }

        res.status(201).json(ApiResponse.success({ 
            notification: channels.inApp !== false ? notification : null,
            notificationResults: notificationResults,
            message: 'Notification sent successfully' 
        }, 'Notification sent successfully'));
    } catch (error) {
        console.error('Error sending notification:', error);
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

// Delete a notification (admin only)
const deleteNotification = async (req, res, next) => {
    try {
        const notification = await Notification.findByIdAndDelete(req.params.id);

        if (!notification) {
            return res.status(404).json(ApiResponse.error('Notification not found'));
        }

        res.status(200).json(ApiResponse.success(null, 'Notification deleted successfully'));
    } catch (error) {
        next(error);
    }
};

// Delete all notifications (admin only)
const deleteAllNotifications = async (req, res, next) => {
    try {
        await Notification.deleteMany({});

        res.status(200).json(ApiResponse.success(null, 'All notifications deleted successfully'));
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAllNotifications,
    sendNotification,
    markAsRead,
    deleteNotification,
    deleteAllNotifications
};
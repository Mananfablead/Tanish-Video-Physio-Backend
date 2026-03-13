const Notification = require('../models/Notification.model');
const ApiResponse = require('../utils/apiResponse');
const NotificationService = require('../services/notificationService');
const User = require('../models/User.model');
const CmsContact = require('../models/CmsContact.model');

// Get all notifications for authenticated user (client/therapist)
const getAllNotifications = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, unreadOnly = false } = req.query;
        const skip = (page - 1) * limit;

        console.log('📡 GET /notifications - Request info:', {
            userId: req.user.userId,
            role: req.user.role,
            page,
            limit,
            unreadOnly
        });

        let query = {};

        if (req.user.role === 'admin') {
            // Admin sees all notifications
            query = {};
            console.log('👑 Admin user - returning ALL notifications');
        } else {
            // Non-admin users must ONLY see notifications created specifically for them.
            // This prevents clients from seeing other users' notifications.
            query = { userId: req.user.userId };
            console.log('👤 Regular user - using user-scoped query:', JSON.stringify(query));
        }

        if (unreadOnly === 'true') {
            query.read = false;
            console.log('📖 Filtering for unread only');
        }

        console.log('🔍 Final query:', JSON.stringify(query));

        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Notification.countDocuments(query);
        const unreadCount = await Notification.countDocuments({ ...query, read: false });

        console.log(`✅ Found ${notifications.length} notifications (total: ${total})`);

        res.status(200).json(ApiResponse.success({
            notifications,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            },
            unreadCount
        }, 'Notifications retrieved successfully'));
    } catch (error) {
        console.error('❌ Error in getAllNotifications:', error);
        next(error);
    }
};

// Get admin-specific notifications
const getAdminNotifications = async (req, res, next) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json(ApiResponse.error('Access denied. Admin only.'));
        }

        const { page = 1, limit = 20, unreadOnly = false } = req.query;
        const skip = (page - 1) * limit;

        let query = { recipientType: 'admin' };

        if (unreadOnly === 'true') {
            query.read = false;
        }

        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Notification.countDocuments(query);
        const unreadCount = await Notification.countDocuments({ ...query, read: false });

        res.status(200).json(ApiResponse.success({
            notifications,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            },
            unreadCount
        }, 'Admin notifications retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Send a notification (admin only)
const sendNotification = async (req, res, next) => {
    try {
        const { title, message, type, recipientType, userId = null, channels = {}, priority = 'medium', metadata = {} } = req.body;

        // Validate recipient type
        if (!['all', 'users', 'therapists', 'admin', 'specific'].includes(recipientType)) {
            return res.status(400).json(ApiResponse.error('Invalid recipient type'));
        }

        let recipients = [];
        let savedNotifications = [];
        
        // Get recipients based on type
        if (recipientType === 'all') {
            const users = await User.find({ role: { $in: ['user', 'therapist'] } }).select('email phone name');
            recipients = users.map(user => ({
                email: user.email,
                phone: user.phone,
                name: user.name,
                userId: user._id
            }));

            // Save in-app notifications for all users
            if (channels.inApp !== false) {
                const userNotifications = recipients.map(recipient => ({
                    title,
                    message,
                    type,
                    recipientType: 'client',
                    userId: recipient.userId,
                    channels,
                    priority,
                    metadata
                }));
                savedNotifications = await Notification.insertMany(userNotifications);
            }
        } else if (recipientType === 'users') {
            const users = await User.find({ role: 'user' }).select('email phone name');
            recipients = users.map(user => ({
                email: user.email,
                phone: user.phone,
                name: user.name,
                userId: user._id
            }));

            if (channels.inApp !== false) {
                const userNotifications = recipients.map(recipient => ({
                    title,
                    message,
                    type,
                    recipientType: 'client',
                    userId: recipient.userId,
                    channels,
                    priority,
                    metadata
                }));
                savedNotifications = await Notification.insertMany(userNotifications);
            }
        } else if (recipientType === 'therapists') {
            const therapists = await User.find({ role: 'therapist' }).select('email phone name');
            recipients = therapists.map(user => ({
                email: user.email,
                phone: user.phone,
                name: user.name,
                userId: user._id
            }));

            if (channels.inApp !== false) {
                const therapistNotifications = recipients.map(recipient => ({
                    title,
                    message,
                    type,
                    recipientType: 'therapist',
                    userId: recipient.userId,
                    channels,
                    priority,
                    metadata
                }));
                savedNotifications = await Notification.insertMany(therapistNotifications);
            }
        } else if (recipientType === 'admin') {
            const admins = await User.find({ role: 'admin' }).select('email phone name');
            recipients = admins.map(admin => ({
                email: admin.email,
                phone: admin.phone,
                name: admin.name,
                adminId: admin._id
            }));

            if (channels.inApp !== false) {
                const adminNotifications = recipients.map(admin => ({
                    title,
                    message,
                    type,
                    recipientType: 'admin',
                    adminId: admin.adminId,
                    channels,
                    priority,
                    metadata
                }));
                savedNotifications = await Notification.insertMany(adminNotifications);
            }
        } else if (recipientType === 'specific' && userId) {
            const user = await User.findById(userId).select('email phone name role');
            if (user) {
                recipients = [{
                    email: user.email,
                    phone: user.phone,
                    name: user.name,
                    userId: user._id,
                    role: user.role
                }];

                if (channels.inApp !== false) {
                    const notificationData = {
                        title,
                        message,
                        type,
                        recipientType: user.role === 'admin' ? 'admin' : 'client',
                    };

                    if (user.role === 'admin') {
                        notificationData.adminId = user._id;
                    } else {
                        notificationData.userId = user._id;
                    }

                    notificationData.channels = channels;
                    notificationData.priority = priority;
                    notificationData.metadata = metadata;

                    savedNotifications = [await Notification.create(notificationData)];
                }
            }
        }

        // Send via NotificationService (email/WhatsApp)
        if (recipients.length > 0 && (channels.email !== false || channels.whatsapp !== false)) {
            const notificationResults = [];
            
            for (const recipient of recipients) {
                const recipientData = {
                    email: recipient.email,
                    phone: recipient.phone
                };

                const notificationData = {
                    title: title,
                    message: message,
                    userName: recipient.name
                };

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
                if (channels.whatsapp !== false) {
                    try {
                        const contactInfo = await CmsContact.findOne().sort({ createdAt: -1 });
                        if (contactInfo && contactInfo.phone) {
                            const whatsappResult = await NotificationService.sendWhatsApp(
                                contactInfo.phone,
                                (data) => `${data.title}: ${data.message}`,
                                notificationData
                            );
                            if (whatsappResult.success) {
                                result.channels.push('whatsapp');
                            } else {
                                result.whatsappError = whatsappResult.error;
                            }
                        } else {
                            result.whatsappError = 'Admin phone number not configured';
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
            notifications: savedNotifications,
            notificationResults: notificationResults,
            message: 'Notification sent successfully' 
        }, 'Notification sent successfully'));
    } catch (error) {
        console.error('Error sending notification:', error);
        next(error);
    }
};

// Mark notification as read/unread (toggle)
const markAsRead = async (req, res, next) => {
    try {
        let query = { _id: req.params.id };

        if (req.user.role === 'admin') {
            query.adminId = req.user.userId;
        } else {
            query.userId = req.user.userId;
        }

        // Get current read status to toggle
        const currentNotification = await Notification.findOne(query);
        
        if (!currentNotification) {
            return res.status(404).json(ApiResponse.error('Notification not found'));
        }

        // Toggle the read status
        const newReadStatus = !currentNotification.read;
        
        const notification = await Notification.findOneAndUpdate(
            query,
            { read: newReadStatus },
            { new: true }
        );

        res.status(200).json(ApiResponse.success({ 
            notification,
            read: newReadStatus
        }, `Notification marked as ${newReadStatus ? 'read' : 'unread'}`));
    } catch (error) {
        console.error('Error toggling notification read status:', error);
        next(error);
    }
};

// Mark all notifications as read
const markAllAsRead = async (req, res, next) => {
    try {
        let query = { read: false };

        if (req.user.role === 'admin') {
            query.recipientType = 'admin';
        } else {
            // Only mark the authenticated user's notifications as read
            query = { userId: req.user.userId, read: false };
        }

        const result = await Notification.updateMany(query, { read: true });

        res.status(200).json(ApiResponse.success({
            modifiedCount: result.modifiedCount
        }, 'All notifications marked as read'));
    } catch (error) {
        next(error);
    }
};

// Delete a notification (user can delete their own, admin can delete any)
const deleteNotification = async (req, res, next) => {
    try {
        let query = { _id: req.params.id };

        if (req.user.role === 'admin') {
            // Admin can delete any notification
            const notification = await Notification.findByIdAndDelete(req.params.id);

            if (!notification) {
                return res.status(404).json(ApiResponse.error('Notification not found'));
            }

            return res.status(200).json(ApiResponse.success(null, 'Notification deleted successfully'));
        } else {
            // Regular users can only delete their own notifications
            query.userId = req.user.userId;
            
            const notification = await Notification.findOneAndDelete(query);

            if (!notification) {
                return res.status(404).json(ApiResponse.error('Notification not found or access denied'));
            }

            return res.status(200).json(ApiResponse.success(null, 'Notification deleted successfully'));
        }
    } catch (error) {
        console.error('Error deleting notification:', error);
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
    getAdminNotifications,
    sendNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications
};
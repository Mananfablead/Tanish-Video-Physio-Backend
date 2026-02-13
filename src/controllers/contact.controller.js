const ContactMessage = require('../models/ContactMessage.model');
const ApiResponse = require('../utils/apiResponse');
const { sendContactNotificationEmail, sendContactReplyEmail } = require('../utils/email.utils');

// Create a new contact message (public route)
const createContactMessage = async (req, res, next) => {
    try {
        const { name, email, phone, subject, message } = req.body;

        // Get IP address and user agent
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent');

        const contactMessage = new ContactMessage({
            name,
            email,
            phone,
            subject,
            message,
            ipAddress,
            userAgent
        });

        await contactMessage.save();

        // Send notification email to admin
        try {
            await sendContactNotificationEmail(contactMessage);
        } catch (emailError) {
            console.error('Failed to send contact notification email:', emailError);
            // Don't fail the request if email fails
        }

        res.status(201).json(
            ApiResponse.success(
                { contactMessage: contactMessage.toObject() },
                'Message sent successfully'
            )
        );
    } catch (error) {
        next(error);
    }
};

// Get all contact messages (admin only)
const getAllContactMessages = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, status, search } = req.query;

        // Build filter object
        const filter = {};
        if (status) {
            filter.status = status;
        }

        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { subject: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (page - 1) * limit;

        const messages = await ContactMessage.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await ContactMessage.countDocuments(filter);

        res.status(200).json(
            ApiResponse.success(
                {
                    messages,
                    pagination: {
                        currentPage: parseInt(page),
                        totalPages: Math.ceil(total / limit),
                        totalMessages: total,
                        hasNextPage: skip + parseInt(limit) < total,
                        hasPrevPage: page > 1
                    }
                },
                'Contact messages retrieved successfully'
            )
        );
    } catch (error) {
        next(error);
    }
};

// Get contact message by ID (admin only)
const getContactMessageById = async (req, res, next) => {
    try {
        const message = await ContactMessage.findById(req.params.id);

        if (!message) {
            return res.status(404).json(
                ApiResponse.error('Contact message not found')
            );
        }

        // Mark as read if it's unread
        if (message.status === 'unread') {
            message.status = 'read';
            await message.save();
        }

        res.status(200).json(
            ApiResponse.success(
                { message: message.toObject() },
                'Contact message retrieved successfully'
            )
        );
    } catch (error) {
        next(error);
    }
};

// Update contact message status (admin only)
const updateContactMessageStatus = async (req, res, next) => {
    try {
        const { status, replyMessage } = req.body;

        const message = await ContactMessage.findById(req.params.id);

        if (!message) {
            return res.status(404).json(
                ApiResponse.error('Contact message not found')
            );
        }

        if (status) {
            message.status = status;
        }

        if (replyMessage) {
            message.replyMessage = replyMessage;
            message.repliedAt = new Date();
            message.status = 'replied';
        }

        await message.save();

        // Send reply email to user if replyMessage is provided
        if (replyMessage) {
            try {
                await sendContactReplyEmail(message);
            } catch (emailError) {
                console.error('Failed to send reply email to user:', emailError);
                // Don't fail the request if email fails
            }
        }

        res.status(200).json(
            ApiResponse.success(
                { message: message.toObject() },
                'Contact message updated successfully'
            )
        );
    } catch (error) {
        next(error);
    }
};

// Delete contact message (admin only)
const deleteContactMessage = async (req, res, next) => {
    try {
        const message = await ContactMessage.findByIdAndDelete(req.params.id);

        if (!message) {
            return res.status(404).json(
                ApiResponse.error('Contact message not found')
            );
        }

        res.status(200).json(
            ApiResponse.success(null, 'Contact message deleted successfully')
        );
    } catch (error) {
        next(error);
    }
};

// Get contact messages statistics (admin only)
const getContactMessagesStats = async (req, res, next) => {
    try {
        const total = await ContactMessage.countDocuments();
        const unread = await ContactMessage.countDocuments({ status: 'unread' });
        const read = await ContactMessage.countDocuments({ status: 'read' });
        const replied = await ContactMessage.countDocuments({ status: 'replied' });

        // Get messages from last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const recent = await ContactMessage.countDocuments({
            createdAt: { $gte: sevenDaysAgo }
        });

        res.status(200).json(
            ApiResponse.success(
                {
                    total,
                    unread,
                    read,
                    replied,
                    recent
                },
                'Contact messages statistics retrieved successfully'
            )
        );
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createContactMessage,
    getAllContactMessages,
    getContactMessageById,
    updateContactMessageStatus,
    deleteContactMessage,
    getContactMessagesStats
};
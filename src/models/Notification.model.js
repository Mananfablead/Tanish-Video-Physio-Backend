const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true,
        maxlength: [100, 'Title cannot exceed 100 characters']
    },
    message: {
        type: String,
        required: [true, 'Message is required'],
        maxlength: [500, 'Message cannot exceed 500 characters']
    },
    type: {
        type: String,
        enum: ['booking', 'payment', 'session', 'system', 'connection_failure', 'google_meet_ready'],
        required: [true, 'Type is required']
    },
    recipientType: {
        type: String,
        enum: ['client', 'admin', 'therapist', 'all'],
        default: 'client'
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null // If null, it's a global notification
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null // For admin-specific notifications
    },
    sessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Session',
        default: null // For session-specific notifications
    },
    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        default: null // For booking-specific notifications
    },
    googleMeetLink: {
        type: String,
        default: null
    },
    googleMeetCode: {
        type: String,
        default: null
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    channels: {
        type: {
            email: { type: Boolean, default: false },
            whatsapp: { type: Boolean, default: false },
            inApp: { type: Boolean, default: true }
        },
        default: { email: false, whatsapp: false, inApp: true }
    },
    read: {
        type: Boolean,
        default: false
    },
    metadata: {
        type: Object,
        default: {} // Additional data like errorDetails, senderId, etc.
    }
}, {
    timestamps: true
});

// Index for efficient querying
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ adminId: 1, createdAt: -1 });
notificationSchema.index({ recipientType: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
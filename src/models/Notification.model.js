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
        enum: ['booking', 'payment', 'session', 'system', 'connection_failure'],
        required: [true, 'Type is required']
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null // If null, it's a global notification
    },
    sessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Session',
        default: null // For session-specific notifications
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
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Notification', notificationSchema);
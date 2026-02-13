const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
    sessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Session',
        required: function () {
            // sessionId is required unless messageType is 'default-chat'
            return this.messageType !== 'default-chat';
        }
    },
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Sender ID is required']
    },
    senderType: {
        type: String,
        enum: ['user', 'therapist', 'admin'],
        required: [true, 'Sender type is required']
    },
    message: {
        type: String,
        required: [true, 'Message is required'],
        trim: true,
        maxlength: [1000, 'Message cannot exceed 1000 characters']
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    read: {
        type: Boolean,
        default: false
    },
    messageType: {
        type: String,
        enum: ['live-chat', 'video-call-chat', 'default-chat'],
        default: 'live-chat'
    },
    replyTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ChatMessage',
        default: null
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
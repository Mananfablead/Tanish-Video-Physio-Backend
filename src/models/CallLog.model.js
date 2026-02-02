const mongoose = require('mongoose');

const callLogSchema = new mongoose.Schema({
    sessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Session',
        required: true
    },
    groupSessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GroupSession'
    },
    participants: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        joinedAt: {
            type: Date
        },
        leftAt: {
            type: Date
        },
        duration: {
            type: Number // Duration in seconds
        }
    }],
    callStartedAt: {
        type: Date,
        required: true
    },
    callEndedAt: {
        type: Date
    },
    duration: {
        type: Number, // Total call duration in seconds
        default: 0
    },
    type: {
        type: String,
        enum: ['one-on-one', 'group'],
        default: 'one-on-one'
    },
    status: {
        type: String,
        enum: ['active', 'completed', 'missed'],
        default: 'active'
    },
    recordingUrl: {
        type: String,
        trim: true
    },
    recordingStatus: {
        type: String,
        enum: ['pending', 'recording', 'completed', 'failed'],
        default: 'pending'
    },
    recordingStartTime: {
        type: Date
    },
    recordingEndTime: {
        type: Date
    },
    recordingDuration: {
        type: Number // Duration in seconds
    },
    recordingSize: {
        type: Number // Size in bytes
    },
    recordingFormat: {
        type: String // Format of the recording (mp4, webm, etc)
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('CallLog', callLogSchema);
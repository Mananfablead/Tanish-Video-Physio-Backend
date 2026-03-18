const mongoose = require('mongoose');

const groupSessionSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    therapistId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    startTime: {
        type: Date,
        required: true
    },
    endTime: {
        type: Date,
        required: true
    },
    maxParticipants: {
        type: Number,
        default: 10,
        min: 1,
        max: 50
    },
    participants: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        bookingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking'
        },
        joinedAt: {
            type: Date,
            default: Date.now
        },
        status: {
            type: String,
            enum: ['pending', 'accepted', 'rejected'],
            default: 'pending'
        }
    }],
    status: {
        type: String,
        enum: ['scheduled', 'active', 'completed', 'cancelled'],
        default: 'scheduled'
    },
    callStartedAt: {
        type: Date,
        default: null
    },
    callEndedAt: {
        type: Date,
        default: null
    },
    isActiveCall: {
        type: Boolean,
        default: false
    },
    currentParticipants: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        joinedAt: {
            type: Date,
            default: Date.now
        },
        leftAt: {
            type: Date,
            default: null
        },
        isMuted: {
            type: Boolean,
            default: false
        },
        isVideoOff: {
            type: Boolean,
            default: false
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

groupSessionSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('GroupSession', groupSessionSchema);
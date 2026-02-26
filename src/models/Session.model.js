const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        required: false // Not required when using subscription
    },
    subscriptionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subscription',
        required: false // Not required when using booking
    },
    therapistId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        // required: [true, 'Therapist ID is required']
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required']
    },
    sessionId: {
        type: String,
        unique: true,
        required: [true, 'Session ID is required'],
        default: function () {
            return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
    },

    date: {
        type: String, // Format: YYYY-MM-DD
        required: [true, 'Date is required'],
        match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format']
    },
    time: {
        type: String, // Format: HH:MM
        required: [true, 'Time is required'],
        match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in HH:MM format']
    },
    startTime: {
        type: Date,
        required: [true, 'Start time is required']
    },
    endTime: {
        type: Date
    },
    type: {
        type: String,
        enum: ['1-on-1', 'group'],
        default: '1-on-1'
    },
    status: {
        type: String,
        enum: ['pending', 'scheduled', 'live', 'completed', 'cancelled'],
        default: 'pending'
    },
    duration: {
        type: Number, // Duration in minutes
        default: 0
    },
    googleMeetLink: {
        type: String
    },
    googleMeetCode: {
        type: String
    },
    googleMeetExpiresAt: {
        type: Date
    },
    googleMeetEventId: {
        type: String
    },
    notes: {
        type: String,
        maxlength: [1000, 'Notes cannot exceed 1000 characters']
    },
    feedback: {
        rating: { type: Number, min: 1, max: 5 },
        comment: String
    },
    recordingUrl: {
        type: String // URL to the session recording
    },
    joinLink: {
        type: String
    },
    therapistJoinLink: {
        type: String
    },
    last24HourReminderSent: {
        type: Date
    },
    last1HourReminderSent: {
        type: Date
    }
}, {
    timestamps: true
    // Removed custom validation as it was causing issues with session creation
    // validate: {
    //     validator: function () {
    //         return this.bookingId || this.subscriptionId;
    //     },
    //     message: 'Either bookingId or subscriptionId must be provided'
    // }
});

module.exports = mongoose.model('Session', sessionSchema);
const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        required: [true, 'Booking ID is required']
    },
    therapistId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Therapist ID is required']
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required']
    },
    sessionId: {
        type: String,
        unique: true,
        required: [true, 'Session ID is required']
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
        enum: ['scheduled', 'live', 'completed', 'cancelled'],
        default: 'scheduled'
    },
    duration: {
        type: Number, // Duration in minutes
        default: 0
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
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Session', sessionSchema);
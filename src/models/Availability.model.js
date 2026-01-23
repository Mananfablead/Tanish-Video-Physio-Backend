const mongoose = require('mongoose');

const availabilitySchema = new mongoose.Schema({
    therapistId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Therapist ID is required']
    },
    date: {
        type: String, // Format: YYYY-MM-DD
        required: [true, 'Date is required'],
        match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format']
    },
    timeSlots: [{
        start: {
            type: String, // Format: "HH:MM"
            required: true,
            match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Start time must be in HH:MM format']
        },
        end: {
            type: String, // Format: "HH:MM"
            required: true,
            match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'End time must be in HH:MM format']
        },
        status: {
            type: String,
            enum: ['available', 'unavailable', 'booked'],
            default: 'available'
        }
    }]
}, {
    timestamps: true
});

module.exports = mongoose.model('Availability', availabilitySchema);
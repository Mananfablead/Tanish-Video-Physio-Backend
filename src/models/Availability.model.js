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
            type: String, // Format: "HH:MM" (stored as admin's local time)
            required: true,
            match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Start time must be in HH:MM format']
        },
        end: {
            type: String, // Format: "HH:MM" (stored as admin's local time)
            required: true,
            match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'End time must be in HH:MM format']
        },
        status: {
            type: String,
            enum: ['available', 'unavailable', 'booked', 'tentative'],
            default: 'available'
        },
        duration: {
            type: Number, // Duration in minutes
            required: true,
            default: 45, // Default to 45 minutes for regular sessions
            enum: [15, 45] // Allow 15 min for free consultation, 45 min for regular
        },
        bookingType: {
            type: String,
            enum: ['regular', 'free-consultation'],
            default: 'regular'
        },
        // Group session fields
        sessionType: {
            type: String,
            enum: ['one-to-one', 'group'],
            default: 'one-to-one'
        },
        serviceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Service',
            default: null
        },
        maxParticipants: {
            type: Number,
            default: 1,
            min: 1
        },
        bookedParticipants: {
            type: Number,
            default: 0,
            min: 0
        }
    }],
    adminTimezone: {
        type: String,
        required: true,
        description: 'Admin/Therapist timezone when creating the slot (e.g., "America/New_York")'
    },
    minimumNoticePeriod: {
        type: Number,
        default: 15, // Default 15 minutes
        min: 0,
        description: 'Minimum minutes in advance required for booking (e.g., 30 = must book 30 min before)'
    }
}, { timestamps: true });

module.exports = mongoose.model('Availability', availabilitySchema);
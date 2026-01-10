const mongoose = require('mongoose');

const therapistSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        maxlength: [50, 'Name cannot exceed 50 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        match: [
            /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
            'Please enter a valid email'
        ]
    },
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true
    },
    specialty: {
        type: String,
        required: [true, 'Specialty is required'],
        trim: true
    },
    rating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    sessions: {
        type: Number,
        default: 0
    },
    avatar: {
        type: String, // URL to the image
        default: null
    },
    bio: {
        type: String,
        required: [true, 'Bio is required'],
        maxlength: [500, 'Bio cannot exceed 500 characters']
    },
    education: {
        type: String,
        required: [true, 'Education is required']
    },
    experience: {
        type: String,
        required: [true, 'Experience is required']
    },
    languages: [{
        type: String,
        required: [true, 'At least one language is required']
    }],
    availableTimes: [{
        type: String, // Format: "HH:MM"
        match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in HH:MM format']
    }],
    status: {
        type: String,
        enum: ['active', 'inactive', 'pending'],
        default: 'active'
    },
    sessionTypes: [{
        type: String,
        enum: ['1-on-1', 'group'],
        default: '1-on-1'
    }],
    licenseNumber: {
        type: String,
        required: [true, 'License number is required'],
        unique: true
    },
    licenseExpiry: {
        type: Date,
        required: [true, 'License expiry date is required']
    },
    hourlyRate: {
        type: Number,
        required: [true, 'Hourly rate is required'],
        min: 0
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Therapist', therapistSchema);
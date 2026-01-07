const mongoose = require('mongoose');
const { hashPassword } = require('../utils/auth.utils');

const userSchema = new mongoose.Schema({
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
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
    },
    phone: {
        type: String,
        required: false,
        match: [/^[0-9]{10}$/, 'Please enter a valid 10-digit phone number']
    },
    role: {
        type: String,
        enum: ['patient', 'admin'],
        default: 'patient'
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'suspended'],
        default: 'active'
    },
    subscription: {
        type: String,
        enum: ['daily', 'weekly', 'monthly', 'none'],
        default: 'none'
    },
    healthProfile: {
        primaryConcern: String,
        painIntensity: { type: Number, min: 1, max: 10 }, // 1-10 scale
        priorTreatments: String,
        medicalHistory: String,
        allergies: String,
        medications: String,
        emergencyContact: String,
        additionalNotes: String
    },
    profilePicture: {
        type: String, // URL to the image
        default: null
    },
    joinDate: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    try {
        this.password = await hashPassword(this.password);
        next();
    } catch (error) {
        next(error);
    }
});


module.exports = mongoose.model('User', userSchema);
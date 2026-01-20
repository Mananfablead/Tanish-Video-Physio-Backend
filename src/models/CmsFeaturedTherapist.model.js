const mongoose = require('mongoose');

const cmsFeaturedTherapistSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    specialty: {
        type: String,
        required: true,
        trim: true
    },
    experience: {
        type: String,
        required: true,
        trim: true
    },
    rating: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    image: {
        type: String,
        required: true
    },
    availableToday: {
        type: Boolean,
        default: true
    },
    ctaText: {
        type: String,
        required: true,
        trim: true
    },
    viewProfileText: {
        type: String,
        required: true,
        trim: true
    },
    isPublic: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('CmsFeaturedTherapist', cmsFeaturedTherapistSchema);
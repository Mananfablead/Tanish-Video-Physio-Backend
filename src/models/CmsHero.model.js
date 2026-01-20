const mongoose = require('mongoose');

const cmsHeroSchema = new mongoose.Schema({
    heading: {
        type: String,
        required: true,
        trim: true
    },
    subHeading: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        default: ''
    },
    ctaText: {
        type: String,
        required: true,
        trim: true
    },
    secondaryCtaText: {
        type: String,
        required: true,
        trim: true
    },
    image: {
        type: String,
        required: true
    },
    isTherapistAvailable: {
        type: Boolean,
        default: true
    },
    trustedBy: {
        type: String,
        default: ''
    },
    certifiedTherapists: {
        type: Boolean,
        default: true
    },
    rating: {
        type: String,
        default: ''
    },
    features: [{
        type: String,
        trim: true
    }],
    isPublic: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('CmsHero', cmsHeroSchema);
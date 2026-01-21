const mongoose = require('mongoose');

const cmsStepSchema = new mongoose.Schema({
    heading: {
        type: String,
        required: false, // Made optional to align with frontend expectations
        trim: true
    },
    subHeading: {
        type: String,
        required: false, // Made optional to align with frontend expectations
        trim: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    icon: {
        type: String,
        required: false, // Added to align with frontend expectations
        trim: true
    },
    image: {
        type: String,
        required: false // Made optional to allow for steps without images
    },
    isPublic: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('CmsStep', cmsStepSchema);
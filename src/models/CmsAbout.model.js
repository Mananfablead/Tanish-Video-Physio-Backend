const mongoose = require('mongoose');

const cmsAboutSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    mission: {
        type: String,
        required: true
    },
    vision: {
        type: String,
        required: true
    },
    values: [{
        type: String,
        trim: true
    }],
    foundingStory: {
        type: String,
        required: true
    },
    teamInfo: {
        type: String,
        required: true
    },
    images: [{
        type: String,
        default: ''
    }],
    image: {
        type: String,
        default: ''
    },
    isPublic: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('CmsAbout', cmsAboutSchema);
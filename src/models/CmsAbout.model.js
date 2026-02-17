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
    aboutheadline: {
        type: String,
        required: true
    },
    aboutheadlDescription: {
        type: String,
        required: true
    },
 
    images: [{
        type: String,
        default: ''
    }],
    isPublic: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('CmsAbout', cmsAboutSchema);
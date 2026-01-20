const mongoose = require('mongoose');

const cmsTermsSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    content: {
        type: String,
        required: true
    },
    lastUpdated: {
        type: String,
        required: true
    },
    version: {
        type: String,
        required: true
    },
    isPublic: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('CmsTerms', cmsTermsSchema);
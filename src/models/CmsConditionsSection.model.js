const mongoose = require('mongoose');

const cmsConditionSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    image: {
        type: String,
        default: ''
    },
});

const cmsConditionsSectionSchema = new mongoose.Schema({
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
    conditions: [cmsConditionSchema],
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

module.exports = mongoose.model('CmsConditionsSection', cmsConditionsSectionSchema);
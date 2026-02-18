const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    question: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['text', 'mcq', 'slider', 'skalaeton', 'upload', 'age'],
        required: true
    },
    required: {
        type: Boolean,
        default: false
    },
    active: {
        type: Boolean,
        default: true
    },
    order: {
        type: Number,
        required: true
    },
    options: [{
        type: String,
        trim: true
    }],
    // New fields for common text field
    hasCommonField: {
        type: Boolean,
        default: false
    },
    commonFieldLabel: {
        type: String,
        default: "Additional Information"
    },
    commonFieldPlaceholder: {
        type: String,
        default: "Enter additional details..."
    }
}, {
    timestamps: true
});

const questionnaireSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        default: "Patient Intake Questionnaire"
    },
    description: {
        type: String,
        trim: true,
        default: "Health intake questions for therapist matching"
    },
    questions: [questionSchema],
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Questionnaire', questionnaireSchema);
const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    question: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['text', 'mcq', 'slider'],
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
    }]
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
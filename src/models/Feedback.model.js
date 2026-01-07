const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
    sessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Session',
        required: [true, 'Session ID is required']
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required']
    },
    therapistId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Therapist',
        required: [true, 'Therapist ID is required']
    },
    rating: {
        type: Number,
        required: [true, 'Rating is required'],
        min: 1,
        max: 5
    },
    comment: {
        type: String,
        maxlength: [1000, 'Comment cannot exceed 1000 characters']
    },
    sessionDate: {
        type: Date,
        required: [true, 'Session date is required']
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Feedback', feedbackSchema);
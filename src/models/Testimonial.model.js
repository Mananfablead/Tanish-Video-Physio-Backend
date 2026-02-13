const mongoose = require('mongoose');

const testimonialSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required'],
    },
    rating: {
        type: Number,
        required: [true, 'Rating is required'],
        min: [1, 'Rating must be at least 1'],
        max: [5, 'Rating cannot exceed 5']
    },
    content: {
        type: String,
        required: [true, 'Testimonial content is required'],
        trim: true,
        minlength: [10, 'Content must be at least 10 characters'],
        maxlength: [1000, 'Content cannot exceed 1000 characters']
    },
    problem: {
        type: String,
        required: [true, 'Problem is required'],
        trim: true,
        maxlength: [200, 'Problem description cannot exceed 200 characters']
    },
    serviceUsed: {
        type: String,
        required: [true, 'Service used is required'],
        trim: true,
        maxlength: [100, 'Service used description cannot exceed 100 characters']
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
        required: true
    },
    featured: {
        type: Boolean,
        default: false
    },
    video: {
        type: String,
        trim: true,
        default: null
    },
    sessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Session',
        required: false // Not required since admin can create testimonials not tied to a session
    }
}, {
    timestamps: true // Adds createdAt and updatedAt fields
});

module.exports = mongoose.model('Testimonial', testimonialSchema);
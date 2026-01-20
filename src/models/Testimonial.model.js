const mongoose = require('mongoose');

const testimonialSchema = new mongoose.Schema({
    clientName: {
        type: String,
        required: [true, 'Client name is required'],
        trim: true,
        maxlength: [100, 'Client name cannot exceed 100 characters']
    },
    clientEmail: {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: [150, 'Email cannot exceed 150 characters'],
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
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
    serviceUsed: {
        type: String,
        required: [true, 'Service used is required'],
        trim: true,
        maxlength: [100, 'Service name cannot exceed 100 characters']
    },
    problem: {
        type: String,
        required: [true, 'Problem is required'],
        trim: true,
        maxlength: [200, 'Problem description cannot exceed 200 characters']
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
    avatar: {
        type: String,
        trim: true,
        maxlength: [500, 'Avatar URL cannot exceed 500 characters']
    }
}, {
    timestamps: true // Adds createdAt and updatedAt fields
});

module.exports = mongoose.model('Testimonial', testimonialSchema);
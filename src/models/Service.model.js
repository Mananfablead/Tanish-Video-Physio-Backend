const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Service name is required'],
        trim: true,
        maxlength: [100, 'Service name cannot exceed 100 characters']
    },
    description: {
        type: String,
        required: [true, 'Service description is required'],
        maxlength: [500, 'Description cannot exceed 500 characters']
    },
    price: {
        type: Number,
        required: [true, 'Price is required'],
        min: 0
    },
    duration: {
        type: String,
        required: [true, 'Duration is required'],
        match: [/^([0-9]+) (min|mins|minutes)$/, 'Duration must be in format: "X min/mins/minutes"']
    },
    image: {
        type: String, // URL to the image
        default: null
    },
    category: {
        type: String,
        required: [true, 'Category is required'],
        trim: true
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    features: [{
        type: String
    }],
    prerequisites: [{
        type: String
    }],
    benefits: [{
        type: String
    }],
    contraindications: [{
        type: String
    }]
}, {
    timestamps: true
});

module.exports = mongoose.model('Service', serviceSchema);
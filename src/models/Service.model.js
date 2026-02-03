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
    about: {
        type: String,
        maxlength: [2000, 'About section cannot exceed 2000 characters']
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
    images: [{
        type: String // URLs to the images
    }],
    videos: [{
        type: String // URLs to the videos
    }],
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
    }],
    sessions: {
        type: Number,
        min: 0,
        required: [true, 'Number of sessions is required']
    },
    validity: {
        type: Number,
        min: 0,
        required: [true, 'Validity period is required']
    }
}, {
    timestamps: true
});



// Add method to check expiration status
serviceSchema.methods.checkExpirationStatus = function(purchaseDate = null) {
    if (!this.validity || this.validity === 0) {
        return {
            isExpired: false,
            expiryDate: null,
            status: 'unlimited',
            daysRemaining: Infinity
        };
    }
    
    const actualPurchaseDate = purchaseDate || this.purchaseDate || this.createdAt;
    const expiryDate = new Date(actualPurchaseDate);
    expiryDate.setDate(actualPurchaseDate.getDate() + this.validity);
    
    const now = new Date();
    const isExpired = now > expiryDate;
    
    // Calculate days remaining (negative if expired)
    const timeDiff = expiryDate.getTime() - now.getTime();
    const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    
    let status;
    if (isExpired) {
        status = 'expired';
    } else if (daysRemaining <= 7) {
        status = 'expiring_soon';
    } else {
        status = 'active';
    }
    
    return {
        isExpired,
        expiryDate,
        status,
        daysRemaining
    };
};

// Ensure virtual fields are serialized
serviceSchema.set('toJSON', {
    virtuals: true
});

module.exports = mongoose.model('Service', serviceSchema);
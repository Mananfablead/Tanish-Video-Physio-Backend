const mongoose = require('mongoose');
const { generateUniqueSlug } = require('../utils/slug.utils');

const serviceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Service name is required'],
        trim: true,
        maxlength: [100, 'Service name cannot exceed 100 characters']
    },
    slug: {
        type: String,
        unique: true,
        sparse: true, // Allows multiple documents with null/undefined slug
        trim: true
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
    priceINR: {
        type: Number,
        required: [true, 'Price in INR is required'],
        min: 0
    },
    priceUSD: {
        type: Number,
        required: [true, 'Price in USD is required'],
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
        default: 1
    },
    validity: {
        type: Number,
        min: 0,
        required: [true, 'Validity period is required']
    },
    featured: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Pre-save middleware to auto-generate slug
serviceSchema.pre('save', async function (next) {
    if (this.isModified('name') || (this.isNew && !this.slug)) {
        this.slug = await generateUniqueSlug(this.constructor, this.name, this._id);
    }
    next();
});

// Index for slug field to improve query performance
serviceSchema.index({ slug: 1 });



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
const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema({
    planId: {
        type: String,
        required: [true, 'Plan ID is required'],
        unique: true,
        trim: true
    },
    name: {
        type: String,
        required: [true, 'Plan name is required'],
        trim: true
    },
    price: {
        type: Number,
        required: [true, 'Price is required'],
        min: 0
    },
    description: {
        type: String,
        required: [true, 'Description is required']
    },
    features: [{
        type: String
    }],
    duration: {
        type: String,
        required: [true, 'Duration is required'],
       enum: ["daily", "weekly", "monthly", "quarterly", "yearly"]
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    sortOrder: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
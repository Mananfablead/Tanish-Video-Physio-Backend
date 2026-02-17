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
        enum: ["one-time", "monthly", "quarterly", "half-yearly", "yearly"]
    },
    sessions: {
        type: Number,
        default: 0,
        required: [true, 'Number of sessions is required']
    },
    session_type: {
        type: String,
        enum: ['individual', 'group'],
        default: 'individual',
        required: [true, 'Session type is required']
    },
    price_inr: {
        type: Number,
        min: 0,
        default: 0
    },
    price_usd: {
        type: Number,
        min: 0,
        default: 0
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    sortOrder: {
        type: Number,
        default: 0
    },
    validityDays: {
        type: Number,
        default: function() {
            // Set default validity based on duration
            switch(this.duration) {
                case 'one-time': return 1; // Valid for 1 day
                case 'monthly': return 30;
                case 'quarterly': return 90;
                case 'half-yearly': return 180;
                case 'yearly': return 365;
                default: return 30;
            }
        }
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
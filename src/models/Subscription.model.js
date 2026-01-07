const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required']
    },
    planId: {
        type: String,
        required: [true, 'Plan ID is required'],
        enum: ['daily', 'weekly', 'monthly']
    },
    planName: {
        type: String,
        required: [true, 'Plan name is required']
    },
    amount: {
        type: Number,
        required: [true, 'Amount is required'],
        min: 0
    },
    currency: {
        type: String,
        required: [true, 'Currency is required'],
        default: 'INR',
        uppercase: true
    },
    orderId: {
        type: String,
        required: [true, 'Order ID is required']
    },
    paymentId: {
        type: String // Razorpay payment ID
    },
    status: {
        type: String,
        enum: ['created', 'failed', 'paid', 'active', 'inactive', 'expired'],
        default: 'created'
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    endDate: {
        type: Date
    },
    autoRenew: {
        type: Boolean,
        default: true
    },
    paymentGateway: {
        type: String,
        default: 'razorpay'
    },
    nextBillingDate: {
        type: Date
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Subscription', subscriptionSchema);
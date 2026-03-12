const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking'
    },
    subscriptionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subscription'
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // May be empty initially for guest payments
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
        enum: ['created', 'failed', 'paid'],
        default: 'created'
    },
    captured: {
        type: Boolean,
        default: false
    },
    paymentMethod: {
        type: String,
        enum: ['card', 'netbanking', 'upi', 'wallet'],
        default: 'card' // card, netbanking, upi, wallet, cash
    },
    transactionId: {
        type: String // Transaction ID from payment gateway
    },
    paymentGateway: {
        type: String,
        default: 'razorpay'
    },
    paymentDate: {
        type: Date
    },
    verifiedAt: {
        type: Date
    },
    notes: {
        type: String,
        maxlength: [500, 'Notes cannot exceed 500 characters']
    },
    guestName: {
        type: String,
        required: false // Only for guest payments
    },
    guestEmail: {
        type: String,
        required: false // Only for guest payments
    },
    guestPhone: {
        type: String,
        required: false // Only for guest payments
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Payment', paymentSchema);
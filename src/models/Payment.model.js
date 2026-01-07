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
        required: [true, 'User ID is required']
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
        default: 'card' // card, netbanking, upi, wallet, etc.
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
    notes: {
        type: String,
        maxlength: [500, 'Notes cannot exceed 500 characters']
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Payment', paymentSchema);
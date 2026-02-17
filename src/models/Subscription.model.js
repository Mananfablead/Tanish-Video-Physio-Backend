const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // May be empty initially for guest subscriptions
    },
    planId: {
        type: String,
        required: [true, 'Plan ID is required']
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
    },
    guestName: {
        type: String,
        required: false // Only for guest subscriptions
    },
    guestEmail: {
        type: String,
        required: false // Only for guest subscriptions
    },
    guestPhone: {
        type: String,
        required: false // Only for guest subscriptions
    },
    finalAmount: {
        type: Number,
        min: 0
    },
    couponCode: {
        type: String
    },
    discountAmount: {
        type: Number,
        min: 0
    },
    therapistId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // Therapist ID is optional for general subscriptions
    },
    scheduledDate: {
        type: String, // Store as string in YYYY-MM-DD format
        required: false
    },
    scheduledTime: {
        type: String, // Store as HH:MM format
        required: false
    },
    timeSlot: {
        start: String, // Start time in HH:MM format
        end: String    // End time in HH:MM format
    },
    scheduleType: {
        type: String,
        default: 'now'
    }
}, {
    timestamps: true
});

// Add virtual field to calculate if subscription is expired
subscriptionSchema.virtual('isExpired').get(function() {
    if (!this.endDate) return false;
    
    const now = new Date();
    return new Date(this.endDate) < now;
});

// Add method to check expiration status
subscriptionSchema.methods.checkExpirationStatus = function() {
    if (!this.endDate) {
        return {
            isExpired: false,
            expiryDate: null,
            status: 'active',
            daysRemaining: Infinity
        };
    }
    
    const expiryDate = new Date(this.endDate);
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
subscriptionSchema.set('toJSON', {
    virtuals: true
});

module.exports = mongoose.model('Subscription', subscriptionSchema);
const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    serviceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
        required: function() {
            return this.bookingType !== 'free-consultation';
        }
    },
    serviceName: {
        type: String,
        required: [true, 'Service name is required']
    },
    therapistId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Therapist ID is required']
    },
    therapistName: {
        type: String,
        required: [true, 'Therapist name is required']
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required']
    },
    clientName: {
        type: String,
        required: [true, 'Client name is required']
    },
    date: {
        type: String, // Format: YYYY-MM-DD
        required: [true, 'Date is required'],
        match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format']
    },
    time: {
        type: String, // Format: HH:MM
        // required: [true, 'Time is required'],
        // match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in HH:MM format']
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'cancelled', 'completed', 'scheduled'],
        default: 'pending'
    },
    notes: {
        type: String,
        maxlength: [500, 'Notes cannot exceed 500 characters']
    },
    cancellationReason: {
        type: String,
        maxlength: [200, 'Cancellation reason cannot exceed 200 characters']
    },
    paymentStatus: {
        type: String,
        enum: ['verified', 'pending', 'paid', 'failed'],
        default: 'pending'
    },
    amount: {
        type: Number,
        required: [true, 'Amount is required'],
        min: 0
    },
    purchaseDate: {
        type: Date,
        default: Date.now
    },
    serviceExpiryDate: {
        type: Date
    },
    serviceValidityDays: {
        type: Number
    },
    lastPaymentReminderSent: {
        type: Date
    },
    lastSessionReminderSent: {
        type: Date
    },
    googleMeetLink: {
        type: String
    },
    scheduleType: {
        type: String,
        enum: ['now', 'later'],
        default: 'later'
    },
    scheduledDate: {
        type: String, // Format: YYYY-MM-DD
        default: null
    },
    scheduledTime: {
        type: String, // Format: HH:MM
        default: null
    },
    timeSlot: {
        start: String,
        end: String
    },
    bookingType: {
        type: String,
        enum: ['regular', 'free-consultation', 'subscription-covered'],
        default: 'regular'
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
    originalAmount: {
        type: Number,
        min: 0
    }
}, {
    timestamps: true
});

// Virtual field to check if service has expired
bookingSchema.virtual('isServiceExpired').get(function() {
    if (!this.serviceExpiryDate) return false;
    
    const now = new Date();
    return now > this.serviceExpiryDate;
});

// Method to calculate service expiration
bookingSchema.methods.calculateServiceExpiry = function(validityDays = null) {
    // If validity is not provided, try to use the service's validity if populated
    if (validityDays === null && this.serviceId && typeof this.serviceId === 'object' && this.serviceId.validity) {
        validityDays = this.serviceId.validity;
    }
    
    // If validity is still null or 0, return null (no expiration)
    if (!validityDays || validityDays === 0) {
        this.serviceExpiryDate = null;
        this.serviceValidityDays = null;
        return null;
    }
    
    // Calculate expiry date based on purchase date
    const purchaseDate = this.purchaseDate || this.createdAt;
    const expiryDate = new Date(purchaseDate);
    expiryDate.setDate(purchaseDate.getDate() + validityDays);
    
    this.serviceExpiryDate = expiryDate;
    this.serviceValidityDays = validityDays;
    
    return expiryDate;
};

// Ensure virtual fields are serialized
bookingSchema.set('toJSON', {
    virtuals: true
});

module.exports = mongoose.model('Booking', bookingSchema);
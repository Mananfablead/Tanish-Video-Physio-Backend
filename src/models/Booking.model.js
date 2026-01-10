const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    serviceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
        required: [true, 'Service ID is required']
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
        required: [true, 'Time is required'],
        match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in HH:MM format']
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'cancelled', 'completed'],
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
        enum: ['pending', 'paid', 'failed'],
        default: 'pending'
    },
    amount: {
        type: Number,
        required: [true, 'Amount is required'],
        min: 0
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Booking', bookingSchema);
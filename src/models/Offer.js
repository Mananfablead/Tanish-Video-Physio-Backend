const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  discount: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['percentage', 'fixed']
  },
  value: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    required: false,
    default: ""
  },
  isActive: {
    type: Boolean,
    default: true
  },
  minimumAmount: {
    type: Number,
    default: 0,
    required: false
  },
  maxDiscountAmount: {
    type: Number,
    default: null,
    required: false
  },
  usageLimit: {
    type: Number,
    default: null,
    required: false
  },
  usedCount: {
    type: Number,
    default: 0
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // User-specific restrictions
  appliesToUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }], // If specified, only these users can use the coupon
  appliesToNewUsersOnly: {
    type: Boolean,
    default: false
  },
  // Booking type limitations
  allowedBookingTypes: [{
    type: String,
    enum: ['booking', 'subscription'],
    default: ['booking', 'subscription']
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Offer', offerSchema);
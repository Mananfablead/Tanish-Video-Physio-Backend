const Razorpay = require('razorpay');
const config = require('./env');

// Fallback for missing environment variables
const key_id = config.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || 'rzp_test_S250uIjk1rVbsT';
const key_secret = config.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET || 'uvPkIj6Wi9gO3WYHqje57gh7';

const razorpay = new Razorpay({
    key_id: key_id,
    key_secret: key_secret,
});

module.exports = razorpay;
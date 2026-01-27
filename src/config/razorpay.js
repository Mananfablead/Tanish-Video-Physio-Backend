const Razorpay = require('razorpay');
const config = require('./env');

// Get Razorpay credentials
const key_id = config.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID;
const key_secret = config.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET;

let razorpay;

if (!key_id || !key_secret) {
    console.warn('WARNING: Razorpay credentials not found! Payment functionality will be disabled.');
    console.warn('Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.');

    // Create a mock razorpay object with stub methods for development
    razorpay = {
        orders: {
            create: () => Promise.reject(new Error('Razorpay not configured')),
        },
        payments: {
            fetch: () => Promise.reject(new Error('Razorpay not configured')),
        }
    };
} else {
    razorpay = new Razorpay({
        key_id: key_id,
        key_secret: key_secret,
    });
}

module.exports = razorpay;
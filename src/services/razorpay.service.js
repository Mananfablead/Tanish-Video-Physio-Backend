const razorpay = require('../config/razorpay');
const Payment = require('../models/Payment.model');
const logger = require('../utils/logger');
const { getRazorpayCredentials } = require('../utils/credentialsManager');

// Create a payment order
const createOrder = async (options) => {
    try {
        const order = await razorpay.orders.create(options);
        return order;
    } catch (error) {
        logger.error('Error creating Razorpay order:', error);
        throw error;
    }
};

// Verify payment
const verifyPayment = async (paymentData) => {
    try {
        const crypto = require('crypto');

        // Get Razorpay credentials from database
        const razorpayCreds = await getRazorpayCredentials();

        if (!razorpayCreds || !razorpayCreds.keySecret) {
            throw new Error('Razorpay key secret not found in database');
        }

        const secret = razorpayCreds.keySecret;

        const signature = paymentData.razorpay_signature;
        const paymentId = paymentData.razorpay_payment_id;
        const orderId = paymentData.razorpay_order_id;

        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(`${orderId}|${paymentId}`)
            .digest('hex');

        const isVerified = expectedSignature === signature;
        return isVerified;
    } catch (error) {
        logger.error('Error verifying payment:', error);
        throw error;
    }
};

// Get payment details
const getPayment = async (paymentId) => {
    try {
        const payment = await razorpay.payments.fetch(paymentId);
        return payment;
    } catch (error) {
        logger.error('Error fetching payment details:', error);
        throw error;
    }
};

// Capture payment
const capturePayment = async (paymentId, amount) => {
    try {
        const payment = await razorpay.payments.capture(paymentId, amount * 100); // amount in paise
        return payment;
    } catch (error) {
        logger.error('Error capturing payment:', error);
        throw error;
    }
};

// Refund payment
const refundPayment = async (paymentId, options = {}) => {
    try {
        const refund = await razorpay.payments.refund(paymentId, options);
        return refund;
    } catch (error) {
        logger.error('Error refunding payment:', error);
        throw error;
    }
};

module.exports = {
    createOrder,
    verifyPayment,
    getPayment,
    capturePayment,
    refundPayment
};
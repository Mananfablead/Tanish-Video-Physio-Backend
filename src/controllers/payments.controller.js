const razorpay = require('../config/razorpay');
const Booking = require('../models/Booking.model');
const Payment = require('../models/Payment.model');
const ApiResponse = require('../utils/apiResponse');

// Create a payment order for Razorpay
const createOrder = async (req, res, next) => {
    try {
        const { bookingId, amount, currency = 'INR' } = req.body;

        // Verify the booking belongs to the user
        const booking = await Booking.findOne({ _id: bookingId, userId: req.user.userId });
        if (!booking) {
            return res.status(404).json(ApiResponse.error('Booking not found'));
        }

        // Create order in Razorpay
        const options = {
            amount: amount * 100, // Razorpay expects amount in paise
            currency: currency,
            receipt: `booking_${bookingId}`,
            payment_capture: 1 // Auto-capture payment
        };

        const order = await razorpay.orders.create(options);

        // Create payment record in our database
        const payment = new Payment({
            bookingId,
            userId: req.user.userId,
            amount,
            currency,
            orderId: order.id,
            status: 'created'
        });

        await payment.save();

        res.status(200).json(
            ApiResponse.success({
                orderId: order.id,
                key: process.env.RAZORPAY_KEY_ID,
                amount: order.amount,
                currency: order.currency
            }, 'Payment order created successfully')
        );
    } catch (error) {
        next(error);
    }
};

// Verify payment after successful transaction
const verifyPayment = async (req, res, next) => {
    try {
        const { paymentId, orderId, signature } = req.body;
        const userId = req.user.userId;

        // Fetch payment details from our database
        const payment = await Payment.findOne({ orderId, userId });
        if (!payment) {
            return res.status(404).json(ApiResponse.error('Payment not found'));
        }

        // Verify the payment with Razorpay
        const crypto = require('crypto');
        const secret = process.env.RAZORPAY_SECRET;

        // Create the expected signature
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(orderId + '|' + paymentId)
            .digest('hex');

        // Compare signatures
        if (expectedSignature === signature) {
            // Payment verified successfully
            await Payment.findOneAndUpdate(
                { orderId },
                {
                    paymentId,
                    status: 'verified',
                    verifiedAt: new Date()
                }
            );

            // Update the booking status as well
            await Booking.findByIdAndUpdate(
                payment.bookingId,
                { paymentStatus: 'verified' }
            );

            res.status(200).json(
                ApiResponse.success({
                    paymentId,
                    orderId,
                    status: 'verified'
                }, 'Payment verified successfully')
            );
        } else {
            // Invalid signature
            await Payment.findOneAndUpdate(
                { orderId },
                {
                    paymentId,
                    status: 'failed',
                    failureReason: 'Invalid signature'
                }
            );

            return res.status(400).json(ApiResponse.error('Payment verification failed'));
        }
    } catch (error) {
        next(error);
    }
};

// Handle Razorpay webhook
const handleWebhook = async (req, res) => {
    try {
        const { event, payload } = req.body;

        if (event === 'payment.captured') {
            // Payment was successful
            const paymentId = payload.payment.entity.id;
            const orderId = payload.payment.entity.order_id;

            // Update payment status in our database
            await Payment.findOneAndUpdate(
                { orderId },
                {
                    paymentId,
                    status: 'paid',
                    captured: true
                }
            );

            // You might want to update the booking status as well
            const payment = await Payment.findOne({ orderId });
            if (payment) {
                await Booking.findByIdAndUpdate(
                    payment.bookingId,
                    { paymentStatus: 'paid' }
                );
            }
        } else if (event === 'payment.failed') {
            // Payment failed
            const orderId = payload.payment.entity.order_id;

            await Payment.findOneAndUpdate(
                { orderId },
                {
                    status: 'failed',
                    captured: false
                }
            );
        }

        // Acknowledge the webhook
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    createOrder,
    verifyPayment,
    handleWebhook
};
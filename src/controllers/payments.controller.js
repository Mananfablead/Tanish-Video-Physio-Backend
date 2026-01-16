const razorpay = require('../config/razorpay');
const Booking = require('../models/Booking.model');
const Payment = require('../models/Payment.model');
const Subscription = require('../models/Subscription.model');
const SubscriptionPlan = require('../models/SubscriptionPlan.model');
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
        
        // Check if the required environment variable is available
        if (!process.env.RAZORPAY_KEY_SECRET) {
            return res.status(500).json(ApiResponse.error('Server configuration error: Razorpay secret is not set'));
        }
        
        const secret = process.env.RAZORPAY_KEY_SECRET; // Using the correct environment variable name

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

// Create a subscription payment order for Razorpay
const createSubscriptionOrder = async (req, res, next) => {
    try {
        const { planId, amount, currency = 'INR' } = req.body;

        // Validate plan exists in the database
        const plan = await SubscriptionPlan.findOne({ planId, status: 'active' });
        if (!plan) {
            return res.status(400).json(ApiResponse.error('Invalid or inactive plan ID'));
        }

        // Use the actual plan price instead of the provided amount
        const planAmount = plan.price;

        // Create order in Razorpay
        const options = {
            amount: planAmount * 100, // Razorpay expects amount in paise
            currency: currency,
            receipt: `sub_${planId}_${req.user.userId}`,
            payment_capture: 1 // Auto-capture payment
        };

        const order = await razorpay.orders.create(options);

        // Create subscription record in our database
        const subscription = new Subscription({
            userId: req.user.userId,
            planId,
            planName: plan.name,
            amount: planAmount,
            currency,
            orderId: order.id,
            status: 'created'
        });

        await subscription.save();

        res.status(200).json(
            ApiResponse.success({
                orderId: order.id,
                key: process.env.RAZORPAY_KEY_ID, // Frontend needs this to initialize Razorpay
                amount: order.amount,
                currency: order.currency
            }, 'Subscription order created successfully')
        );
    } catch (error) {
        next(error);
    }
};

// Verify subscription payment after successful transaction
const verifySubscriptionPayment = async (req, res, next) => {
    try {
        const { paymentId, orderId, signature } = req.body;
        const userId = req.user.userId;

        // Fetch subscription details from our database
        const subscription = await Subscription.findOne({ orderId, userId });
        if (!subscription) {
            return res.status(404).json(ApiResponse.error('Subscription not found'));
        }

        // Verify the payment with Razorpay
        const crypto = require('crypto');
        
        // Check if the required environment variable is available
        if (!process.env.RAZORPAY_KEY_SECRET) {
            return res.status(500).json(ApiResponse.error('Server configuration error: Razorpay secret is not set'));
        }
        
        const secret = process.env.RAZORPAY_KEY_SECRET; // Using the correct environment variable name

        // Create the expected signature
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(orderId + '|' + paymentId)
            .digest('hex');

        // Compare signatures
        if (expectedSignature === signature) {
            // Payment verified successfully
            await Subscription.findOneAndUpdate(
                { orderId },
                {
                    paymentId,
                    status: 'verified',
                    verifiedAt: new Date()
                }
            );

            res.status(200).json(
                ApiResponse.success({
                    paymentId,
                    orderId,
                    status: 'verified'
                }, 'Subscription payment verified successfully')
            );
        } else {
            // Invalid signature
            await Subscription.findOneAndUpdate(
                { orderId },
                {
                    paymentId,
                    status: 'failed',
                    failureReason: 'Invalid signature'
                }
            );

            return res.status(400).json(ApiResponse.error('Subscription payment verification failed'));
        }
    } catch (error) {
        next(error);
    }
};

// Get payments for authenticated user
const getUserPayments = async (req, res, next) => {
    try {
        const payments = await Payment.find({ userId: req.user.userId })
            .populate('bookingId', 'serviceName therapistName date time')
            .select('-userId') // Don't expose user ID in response for security
            .sort({ createdAt: -1 });

        res.status(200).json(ApiResponse.success({ payments }, 'User payments retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Get all payments (Admin only)
const getAllPayments = async (req, res, next) => {
    try {
        const payments = await Payment.find()
            .populate('userId', 'name email')
            .populate('bookingId', 'serviceName therapistName date time')
            .sort({ createdAt: -1 });

        res.status(200).json(ApiResponse.success({ payments }, 'All payments retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createOrder,
    verifyPayment,
    handleWebhook,
    createSubscriptionOrder,
    verifySubscriptionPayment,
    getUserPayments,
    getAllPayments
};
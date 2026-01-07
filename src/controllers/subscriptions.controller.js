const razorpay = require('../config/razorpay');
const Subscription = require('../models/Subscription.model');
const ApiResponse = require('../utils/apiResponse');

// Get available subscription plans
const getSubscriptionPlans = async (req, res, next) => {
    try {
        // Define the available plans
        const plans = [
            {
                id: 'daily',
                name: 'Daily Plan',
                price: 100,
                description: 'Access to daily physiotherapy sessions',
                features: ['Daily 1-on-1 sessions', 'Unlimited access to resources']
            },
            {
                id: 'weekly',
                name: 'Weekly Plan',
                price: 500,
                description: 'Access to weekly physiotherapy sessions',
                features: ['Weekly 1-on-1 sessions', 'Unlimited access to resources']
            },
            {
                id: 'monthly',
                name: 'Monthly Plan',
                price: 1800,
                description: 'Access to monthly physiotherapy sessions',
                features: ['Monthly 1-on-1 sessions', 'Unlimited access to resources']
            }
        ];

        res.status(200).json(ApiResponse.success({ plans }, 'Subscription plans retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Create a subscription payment order for Razorpay
const createSubscriptionOrder = async (req, res, next) => {
    try {
        const { planId, amount, currency = 'INR' } = req.body;

        // Validate plan
        const validPlans = ['daily', 'weekly', 'monthly'];
        if (!validPlans.includes(planId)) {
            return res.status(400).json(ApiResponse.error('Invalid plan ID'));
        }

        // Create order in Razorpay
        const options = {
            amount: amount * 100, // Razorpay expects amount in paise
            currency: currency,
            receipt: `sub_${planId}_${req.user.userId}`,
            payment_capture: 1 // Auto-capture payment
        };

        const order = await razorpay.orders.create(options);

        // Create subscription record in our database
        const subscription = new Subscription({
            userId: req.user.userId,
            planId,
            amount,
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

module.exports = {
    getSubscriptionPlans,
    createSubscriptionOrder
};
const razorpay = require('../config/razorpay');
const Subscription = require('../models/Subscription.model');
const SubscriptionPlan = require('../models/SubscriptionPlan.model');
const ApiResponse = require('../utils/apiResponse');

// Get available subscription plans
const getSubscriptionPlans = async (req, res, next) => {
    try {
        const plans = await SubscriptionPlan.find({ status: 'active' }).sort({ sortOrder: 1 });

        res.status(200).json(ApiResponse.success({ plans }, 'Subscription plans retrieved successfully'));
    } catch (error) {
        next(error);
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

// Create a new subscription plan (admin only)
const createSubscriptionPlan = async (req, res, next) => {
    try {
        const { planId, name, price, description, features, duration } = req.body;

        // Check if plan already exists
        const existingPlan = await SubscriptionPlan.findOne({ planId });
        if (existingPlan) {
            return res.status(400).json(ApiResponse.error('Plan with this ID already exists'));
        }

        const plan = new SubscriptionPlan({
            planId,
            name,
            price,
            description,
            features,
            duration
        });

        await plan.save();

        res.status(201).json(ApiResponse.success({ plan }, 'Subscription plan created successfully'));
    } catch (error) {
        next(error);
    }
};

// Get all subscription plans (admin only)
const getAllSubscriptionPlans = async (req, res, next) => {
    try {
        const plans = await SubscriptionPlan.find().sort({ createdAt: -1 });

        res.status(200).json(ApiResponse.success({ plans }, 'All subscription plans retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Get a specific subscription plan
const getSubscriptionPlan = async (req, res, next) => {
    try {
        const plan = await SubscriptionPlan.findById(req.params.id);

        if (!plan) {
            return res.status(404).json(ApiResponse.error('Subscription plan not found'));
        }

        res.status(200).json(ApiResponse.success({ plan }, 'Subscription plan retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Update a subscription plan (admin only)
const updateSubscriptionPlan = async (req, res, next) => {
    try {
        const { name, price, description, features, duration, status, sortOrder } = req.body;

        const plan = await SubscriptionPlan.findByIdAndUpdate(
            req.params.id,
            { name, price, description, features, duration, status, sortOrder },
            { new: true, runValidators: true }
        );

        if (!plan) {
            return res.status(404).json(ApiResponse.error('Subscription plan not found'));
        }

        res.status(200).json(ApiResponse.success({ plan }, 'Subscription plan updated successfully'));
    } catch (error) {
        next(error);
    }
};

// Delete a subscription plan (admin only)
const deleteSubscriptionPlan = async (req, res, next) => {
    try {
        const plan = await SubscriptionPlan.findByIdAndDelete(req.params.id);

        if (!plan) {
            return res.status(404).json(ApiResponse.error('Subscription plan not found'));
        }

        res.status(200).json(ApiResponse.success(null, 'Subscription plan deleted successfully'));
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getSubscriptionPlans,
    createSubscriptionOrder,
    createSubscriptionPlan,
    getAllSubscriptionPlans,
    getSubscriptionPlan,
    updateSubscriptionPlan,
    deleteSubscriptionPlan
};
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

// Get subscriptions for authenticated user
const getUserSubscriptions = async (req, res, next) => {
    try {
        const subscriptions = await Subscription.find({ userId: req.user.userId })
            .populate('planId')
            .sort({ createdAt: -1 });

        res.status(200).json(ApiResponse.success({ subscriptions }, 'User subscriptions retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Get all subscriptions (admin only)
const getAllSubscriptions = async (req, res, next) => {
    try {
        const subscriptions = await Subscription.find()
            .populate('userId', 'name email')
            .populate('planId')
            .sort({ createdAt: -1 });

        res.status(200).json(ApiResponse.success({ subscriptions }, 'All subscriptions retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getSubscriptionPlans,
    createSubscriptionPlan,
    getAllSubscriptionPlans,
    getSubscriptionPlan,
    updateSubscriptionPlan,
    deleteSubscriptionPlan,
    getUserSubscriptions,
    getAllSubscriptions
};
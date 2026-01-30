const razorpay = require('../config/razorpay');
const Subscription = require('../models/Subscription.model');
const SubscriptionPlan = require('../models/SubscriptionPlan.model');
const Session = require('../models/Session.model');
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
        const { planId, name, price, description, features, duration, sessions } = req.body;

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
            duration,
            sessions
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
        const { name, price, description, features, duration, sessions, status, sortOrder } = req.body;

        const plan = await SubscriptionPlan.findByIdAndUpdate(
            req.params.id,
            { name, price, description, features, duration, sessions, status, sortOrder },
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
        // Get user's subscriptions
        const subscriptions = await Subscription.find({ userId: req.user.userId })
            .populate('planId')
            .sort({ createdAt: -1 });

        // For each subscription, we can enrich it with session data
        // Let's calculate session usage for each subscription
        const enrichedSubscriptions = await Promise.all(subscriptions.map(async (subscription) => {
            // Convert to plain object to modify
            const subscriptionObj = subscription.toObject();

            // Handle both ObjectId and string planId
            let plan = null;
            if (subscription.planId) {
                // Try to find by ObjectId first
                const isValidObjectId = require('mongoose').Types.ObjectId.isValid(subscription.planId);
                if (isValidObjectId) {
                    plan = await SubscriptionPlan.findById(subscription.planId);
                } else {
                    // Try to find by planId string
                    plan = await SubscriptionPlan.findOne({ planId: subscription.planId });
                }
            }

            if (plan && plan.sessions > 0) {
                // Count all sessions for this subscription (more accurate approach)
                const Booking = require('../models/Booking.model');

                // Count all non-cancelled sessions for this specific subscription
                const usedSessions = await Session.countDocuments({
                    subscriptionId: subscription._id,
                    status: { $ne: "cancelled" } // Don't count cancelled sessions
                });

                // Also count bookings made during subscription period for additional context
                let bookingCount = 0;
                if (subscription.startDate) {
                    const endDate = subscription.endDate || new Date();
                    bookingCount = await Booking.countDocuments({
                        userId: req.user.userId,
                        createdAt: {
                            $gte: subscription.startDate,
                            $lte: endDate
                        }
                    });
                }

                // Add session information to the subscription object
                subscriptionObj.sessionInfo = {
                    totalAllowed: plan.sessions,
                    sessionsUsed: usedSessions,
                    sessionsRemaining: Math.max(0, plan.sessions - usedSessions),
                    bookingsMade: bookingCount
                };
                
                // Add "kitna bacha hai" information
                subscriptionObj.availableSessions = {
                    total: plan.sessions,
                    used: usedSessions,
                    remaining: Math.max(0, plan.sessions - usedSessions),
                    percentageUsed: Math.round((usedSessions / plan.sessions) * 100)
                };
            } else {
                // Unlimited sessions
                subscriptionObj.sessionInfo = {
                    totalAllowed: 'unlimited',
                    sessionsUsed: 0, // Would need to count actual sessions separately
                    sessionsRemaining: 'unlimited',
                    bookingsMade: 0
                };
                
                // Add "kitna bacha hai" information for unlimited plans
                subscriptionObj.availableSessions = {
                    total: 'unlimited',
                    used: 0,
                    remaining: 'unlimited',
                    percentageUsed: 0
                };
            }
            
            // Additionally, get user's purchased services with their session information
            const Service = require('../models/Service.model');
            const BookingModel = require('../models/Booking.model');
            
            // Get all bookings for the user that are paid (representing purchased services)
            const userBookings = await BookingModel.find({
                userId: req.user.userId,
                paymentStatus: 'paid'
            }).populate('serviceId');
            
            // Process each booking to get session information
            const purchasedServicesWithSessionInfo = await Promise.all(userBookings.map(async (booking) => {
                if (!booking.serviceId || !booking.serviceId.sessions || booking.serviceId.sessions === 0) {
                    // Service has unlimited sessions
                    return {
                        ...booking.toObject(),
                        serviceSessionInfo: {
                            total: 'unlimited',
                            used: 0, // Would need to count actual sessions separately
                            remaining: 'unlimited',
                            percentageUsed: 0
                        }
                    };
                }
                
                // Count all non-cancelled sessions for this specific booking
                const usedSessions = await Session.countDocuments({
                    bookingId: booking._id,
                    status: { $ne: "cancelled" } // Don't count cancelled sessions
                });
                
                const remainingSessions = booking.serviceId.sessions - usedSessions;
                
                return {
                    ...booking.toObject(),
                    serviceSessionInfo: {
                        total: booking.serviceId.sessions,
                        used: usedSessions,
                        remaining: Math.max(0, booking.serviceId.sessions - usedSessions),
                        percentageUsed: Math.round((usedSessions / booking.serviceId.sessions) * 100)
                    }
                };
            }));
            
            // Add purchased services with session information to the subscription object
            subscriptionObj.purchasedServices = purchasedServicesWithSessionInfo;

            return subscriptionObj;
        }));

        res.status(200).json(ApiResponse.success({ subscriptions: enrichedSubscriptions }, 'User subscriptions retrieved successfully'));
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

        // Enrich each subscription with session information
        const enrichedSubscriptions = await Promise.all(subscriptions.map(async (subscription) => {
            // Convert to plain object to modify
            const subscriptionObj = subscription.toObject();

            // Handle both ObjectId and string planId
            let plan = null;
            if (subscription.planId) {
                console.log(`Looking up plan for subscription ${subscription._id}, planId: ${subscription.planId}`);
                // Try to find by ObjectId first
                const isValidObjectId = require('mongoose').Types.ObjectId.isValid(subscription.planId);
                console.log(`Is valid ObjectId: ${isValidObjectId}`);
                if (isValidObjectId) {
                    plan = await SubscriptionPlan.findById(subscription.planId);
                } else {
                    // Try to find by planId string
                    plan = await SubscriptionPlan.findOne({ planId: subscription.planId });
                }
                console.log(`Found plan:`, plan ? { name: plan.name, sessions: plan.sessions } : 'null');
            }

            if (plan && plan.sessions > 0) {
                // Count all sessions for this subscription (more accurate approach)
                const Booking = require('../models/Booking.model');

                // Count all non-cancelled sessions for this specific subscription
                const usedSessions = await Session.countDocuments({
                    subscriptionId: subscription._id,
                    status: { $ne: "cancelled" } // Don't count cancelled sessions
                });

                // Also count bookings made during subscription period for additional context
                let bookingCount = 0;
                if (subscription.userId && subscription.startDate) {
                    const endDate = subscription.endDate || new Date();
                    bookingCount = await Booking.countDocuments({
                        userId: subscription.userId,
                        createdAt: {
                            $gte: subscription.startDate,
                            $lte: endDate
                        }
                    });
                }

                // Add session information to the subscription object
                subscriptionObj.sessionInfo = {
                    totalAllowed: plan.sessions,
                    sessionsUsed: usedSessions,
                    sessionsRemaining: Math.max(0, plan.sessions - usedSessions),
                    bookingsMade: bookingCount
                };
                
                // Add "kitna bacha hai" (how many left) information
                subscriptionObj.availableSessions = {
                    total: plan.sessions,
                    used: usedSessions,
                    remaining: Math.max(0, plan.sessions - usedSessions),
                    percentageUsed: Math.round((usedSessions / plan.sessions) * 100)
                };
            } else {
                // Unlimited sessions
                subscriptionObj.sessionInfo = {
                    totalAllowed: 'unlimited',
                    sessionsUsed: 0,
                    sessionsRemaining: 'unlimited',
                    bookingsMade: 0
                };
                
                // Add "kitna bacha hai" information for unlimited plans
                subscriptionObj.availableSessions = {
                    total: 'unlimited',
                    used: 0,
                    remaining: 'unlimited',
                    percentageUsed: 0
                };
            }
            
            // Additionally, get user's purchased services with their session information
            const Service = require('../models/Service.model');
            const BookingModel = require('../models/Booking.model');
            
            // Get all bookings for the user that are paid (representing purchased services)
            const userBookings = await BookingModel.find({
                userId: subscription.userId,
                paymentStatus: 'paid'
            }).populate('serviceId');
            
            // Process each booking to get session information
            const purchasedServicesWithSessionInfo = await Promise.all(userBookings.map(async (booking) => {
                if (!booking.serviceId || !booking.serviceId.sessions || booking.serviceId.sessions === 0) {
                    // Service has unlimited sessions
                    return {
                        ...booking.toObject(),
                        serviceSessionInfo: {
                            total: 'unlimited',
                            used: 0, // Would need to count actual sessions separately
                            remaining: 'unlimited',
                            percentageUsed: 0
                        }
                    };
                }
                
                // Count all non-cancelled sessions for this specific booking
                const usedSessions = await Session.countDocuments({
                    bookingId: booking._id,
                    status: { $ne: "cancelled" } // Don't count cancelled sessions
                });
                
                const remainingSessions = booking.serviceId.sessions - usedSessions;
                
                return {
                    ...booking.toObject(),
                    serviceSessionInfo: {
                        total: booking.serviceId.sessions,
                        used: usedSessions,
                        remaining: Math.max(0, booking.serviceId.sessions - usedSessions),
                        percentageUsed: Math.round((usedSessions / booking.serviceId.sessions) * 100)
                    }
                };
            }));
            
            // Add purchased services with session information to the subscription object
            subscriptionObj.purchasedServices = purchasedServicesWithSessionInfo;

            return subscriptionObj;
        }));

        res.status(200).json(ApiResponse.success({ subscriptions: enrichedSubscriptions }, 'All subscriptions retrieved successfully'));
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
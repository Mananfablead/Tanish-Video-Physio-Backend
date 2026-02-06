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
        const { planId, name, price, description, features, duration, sessions, validityDays } = req.body;

        // Check if plan already exists
        const existingPlan = await SubscriptionPlan.findOne({ planId });
        if (existingPlan) {
            return res.status(400).json(ApiResponse.error('Plan with this ID already exists'));
        }

        // Calculate validityDays based on duration if not provided
        let calculatedValidityDays = validityDays;
        if (!calculatedValidityDays) {
            switch(duration) {
                case 'monthly': calculatedValidityDays = 30; break;
                case 'quarterly': calculatedValidityDays = 90; break;
                case 'half-yearly': calculatedValidityDays = 180; break;
                case 'yearly': calculatedValidityDays = 365; break;
                default: calculatedValidityDays = 30;
            }
        }

        const plan = new SubscriptionPlan({
            planId,
            name,
            price,
            description,
            features,
            duration,
            sessions,
            validityDays: calculatedValidityDays
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
        
        // Add subscriber count for each plan
        const plansWithSubscriberCount = await Promise.all(plans.map(async (plan) => {
            const subscriberCount = await Subscription.countDocuments({
                planId: plan.planId,
                status: { $in: ['active', 'expired'] }
            });
            
            return {
                ...plan.toObject(),
                subscriberCount
            };
        }));

        res.status(200).json(ApiResponse.success({ plans: plansWithSubscriberCount }, 'All subscription plans with subscriber counts retrieved successfully'));
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
        const { name, price, description, features, duration, sessions, status, sortOrder, validityDays } = req.body;

        // Calculate validityDays based on duration if not provided
        let updateData = { name, price, description, features, duration, sessions, status, sortOrder };
        
        if (validityDays !== undefined) {
            updateData.validityDays = validityDays;
        } else if (duration) {
            // Recalculate validityDays based on new duration
            switch(duration) {
                case 'monthly': updateData.validityDays = 30; break;
                case 'quarterly': updateData.validityDays = 90; break;
                case 'half-yearly': updateData.validityDays = 180; break;
                case 'yearly': updateData.validityDays = 365; break;
                default: updateData.validityDays = 30;
            }
        }

        const plan = await SubscriptionPlan.findByIdAndUpdate(
            req.params.id,
            updateData,
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

// Helper function to check if a subscription has expired
const isSubscriptionExpired = (subscription) => {
    // Use the new method from the subscription model if available
    if (subscription.checkExpirationStatus) {
        const status = subscription.checkExpirationStatus();
        return status.isExpired;
    }
    
    // Fallback to manual calculation
    if (!subscription.endDate) return false;
    const now = new Date();
    return new Date(subscription.endDate) < now;
};

// Helper function to check if a service has expired based on validity period
const isServiceExpired = (booking, service) => {
    if (!service || !service.validity || service.validity === 0) return false;
    
    const purchaseDate = new Date(booking.purchaseDate || booking.createdAt);
    const expiryDate = new Date(purchaseDate);
    expiryDate.setDate(purchaseDate.getDate() + service.validity); // Add validity days
    
    const now = new Date();
    return now > expiryDate;
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
            
            // Process each booking to get session information and expiration status
            const purchasedServicesWithSessionInfo = await Promise.all(userBookings.map(async (booking) => {
                const isExpired = isServiceExpired(booking, booking.serviceId);
                
                if (!booking.serviceId || !booking.serviceId.sessions || booking.serviceId.sessions === 0) {
                    // Service has unlimited sessions
                    return {
                        ...booking.toObject(),
                        isExpired: isExpired,
                        expiryDate: booking.serviceId && booking.serviceId.validity ? 
                            new Date(new Date(booking.purchaseDate || booking.createdAt).setDate(new Date(booking.purchaseDate || booking.createdAt).getDate() + booking.serviceId.validity)) : 
                            null,
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
                    isExpired: isExpired,
                    expiryDate: booking.serviceId && booking.serviceId.validity ? 
                        new Date(new Date(booking.createdAt).setDate(new Date(booking.createdAt).getDate() + booking.serviceId.validity)) : 
                        null,
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
        
        // Enrich each subscription with session information and expiration status
        const enrichedSubscriptions = await Promise.all(subscriptions.map(async (subscription) => {
            // Convert to plain object to modify
            const subscriptionObj = subscription.toObject();
            
            // Check if subscription has expired
            const isExpired = isSubscriptionExpired(subscription);
            subscriptionObj.isExpired = isExpired;
            subscriptionObj.status = isExpired ? 'expired' : subscription.status;

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
            
            // Process each booking to get session information and expiration status
            const purchasedServicesWithSessionInfo = await Promise.all(userBookings.map(async (booking) => {
                const isExpired = isServiceExpired(booking, booking.serviceId);
                
                if (!booking.serviceId || !booking.serviceId.sessions || booking.serviceId.sessions === 0) {
                    // Service has unlimited sessions
                    return {
                        ...booking.toObject(),
                        isExpired: isExpired,
                        expiryDate: booking.serviceId && booking.serviceId.validity ? 
                            new Date(new Date(booking.purchaseDate || booking.createdAt).setDate(new Date(booking.purchaseDate || booking.createdAt).getDate() + booking.serviceId.validity)) : 
                            null,
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
                    isExpired: isExpired,
                    expiryDate: booking.serviceId && booking.serviceId.validity ? 
                        new Date(new Date(booking.createdAt).setDate(new Date(booking.createdAt).getDate() + booking.serviceId.validity)) : 
                        null,
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

// Get expired subscriptions for admin
const getExpiredSubscriptions = async (req, res, next) => {
    try {
        const now = new Date();
        const expiredSubscriptions = await Subscription.find({
            endDate: { $lt: now },
            status: 'active'
        })
        .populate('userId', 'name email')
        .populate('planId')
        .sort({ endDate: 1 }); // Sort by expiry date
        
        res.status(200).json(ApiResponse.success({ 
            subscriptions: expiredSubscriptions,
            count: expiredSubscriptions.length 
        }, 'Expired subscriptions retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Get expired services for admin
const getExpiredServices = async (req, res, next) => {
    try {
        const Booking = require('../models/Booking.model');
        const Service = require('../models/Service.model');
        
        // Get all paid bookings
        const paidBookings = await Booking.find({ paymentStatus: 'paid' })
            .populate('serviceId')
            .populate('userId', 'name email');
        
        // Filter expired services
        const expiredServices = paidBookings.filter(booking => 
            booking.serviceId && isServiceExpired(booking, booking.serviceId)
        );
        
        // Add expiration details
        const expiredServicesWithDetails = expiredServices.map(booking => ({
            ...booking.toObject(),
            expiryDate: booking.serviceId.validity ? 
                new Date(new Date(booking.purchaseDate || booking.createdAt).setDate(new Date(booking.purchaseDate || booking.createdAt).getDate() + booking.serviceId.validity)) : 
                null,
            daysSinceExpiry: booking.serviceId.validity ? 
                Math.floor((new Date() - new Date(new Date(booking.purchaseDate || booking.createdAt).setDate(new Date(booking.purchaseDate || booking.createdAt).getDate() + booking.serviceId.validity))) / (1000 * 60 * 60 * 24)) : 
                0
        }));
        
        res.status(200).json(ApiResponse.success({ 
            services: expiredServicesWithDetails,
            count: expiredServicesWithDetails.length 
        }, 'Expired services retrieved successfully'));
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
    getAllSubscriptions,
    getExpiredSubscriptions,
    getExpiredServices
};
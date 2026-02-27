const razorpay = require('../config/razorpay');
const Subscription = require('../models/Subscription.model');
const SubscriptionPlan = require('../models/SubscriptionPlan.model');
const Session = require('../models/Session.model');
const Booking = require('../models/Booking.model');
const ApiResponse = require('../utils/apiResponse');

// Get available subscription plans
const getSubscriptionPlans = async (req, res, next) => {
    try {
        const { session_type, country } = req.query;
        
        // Build query filter
        let query = { status: 'active' };
        if (session_type) {
            query.session_type = session_type;
        }
        
        const plans = await SubscriptionPlan.find(query).sort({ sortOrder: 1 });

        // Add price based on country
        const plansWithCountryPrice = plans.map(plan => {
            let price = plan.price; // fallback to existing price field
            let currency = '₹'; // default to INR
            
            if (country === 'India' && plan.price_inr > 0) {
                price = plan.price_inr;
                currency = '₹';
            } else if (country !== 'India' && plan.price_usd > 0) {
                price = plan.price_usd;
                currency = '$';
            }
            
            return {
                ...plan.toObject(),
                price: price,
                currency: currency
            };
        });

        res.status(200).json(ApiResponse.success({ plans: plansWithCountryPrice }, 'Subscription plans retrieved successfully'));
    } catch (error) {
        next(error);
    }
};


// Create a new subscription plan (admin only)
const createSubscriptionPlan = async (req, res, next) => {
    try {
        const { planId, name, price, description, features, duration, sessions, totalService, validityDays, session_type, price_inr, price_usd } = req.body;

        // If planId is provided, check if it already exists
        if (planId) {
            const existingPlan = await SubscriptionPlan.findOne({ planId });
            if (existingPlan) {
                return res.status(400).json(ApiResponse.error('Plan with this ID already exists'));
            }
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

        const planData = {
            name,
            price,
            description,
            features,
            duration,
            sessions,
            totalService,
            session_type: session_type || 'individual',
            price_inr: price_inr || 0,
            price_usd: price_usd || 0,
            validityDays: calculatedValidityDays
        };
        
        // Only add planId if provided
        if (planId) {
            planData.planId = planId;
        }
        
        const plan = new SubscriptionPlan(planData);

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
                subscriberCount,
                // Add display name for better UI
                displayName: `${plan.name} (${plan.planId})`
            };
        }));

        res.status(200).json(ApiResponse.success({ plans: plansWithSubscriberCount }, 'All subscription plans with subscriber counts retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Get a specific subscription plan id with subscriber  
const getSubscriptionPlan = async (req, res, next) => {
    try {
        const plan = await SubscriptionPlan.findById(req.params.id);

        if (!plan) {
            return res.status(404).json(ApiResponse.error('Subscription plan not found'));
        }
        
        // Use the planId string value to match with subscriptions
        const planIdValue = plan.planId;
        let queryCondition = { planId: planIdValue };
        
        // Count total subscribers for this plan (including guest subscriptions)
        const subscriberCount = await Subscription.countDocuments({
            ...queryCondition,
            status: { $in: ['active', 'expired'] }
        });
        
        // Get detailed subscriber information
        const subscriptions = await Subscription.find(queryCondition)
        .populate('userId', 'name email phone joinDate')
        .sort({ createdAt: -1 });
        
        // Process subscribers to handle both registered users and guest users
        const subscribers = await Promise.all(subscriptions.map(async (sub) => {
            if (sub.userId) {
                // Registered user
                return {
                    id: sub._id,
                    userId: sub.userId,
                    status: sub.status,
                    startDate: sub.startDate,
                    endDate: sub.endDate,
                    createdAt: sub.createdAt,
                    updatedAt: sub.updatedAt,
                    amount: sub.amount,
                    currency: sub.currency
                };
            } else {
                // Guest user - include guest information if available
                return {
                    id: sub._id,
                    userId: {
                        _id: sub.userId || 'guest',
                        name: sub.guestName || 'Guest User',
                        email: sub.guestEmail || 'N/A',
                        phone: sub.guestPhone || 'N/A',
                        joinDate: sub.createdAt
                    },
                    status: sub.status,
                    startDate: sub.startDate,
                    endDate: sub.endDate,
                    createdAt: sub.createdAt,
                    updatedAt: sub.updatedAt,
                    amount: sub.amount,
                    currency: sub.currency
                };
            }
        }));
        
        // Add additional stats
        const activeSubscribers = await Subscription.countDocuments({
            ...queryCondition,
            status: 'active'
        });
        
        const expiredSubscribers = await Subscription.countDocuments({
            ...queryCondition,
            status: 'expired'
        });
        
        res.status(200).json(ApiResponse.success({ 
            plan: {
                ...plan.toObject(),
                subscriberCount,
                activeSubscribers,
                expiredSubscribers,
                subscribers // Already mapped in the processing step above
            } 
        }, 'Subscription plan with subscriber details retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Update a subscription plan (admin only)
const updateSubscriptionPlan = async (req, res, next) => {
    try {
        const { name, price, description, features, duration, sessions, totalService, status, sortOrder, validityDays, session_type, price_inr, price_usd } = req.body;
        
        // Check if the plan has any active or past subscriptions
        const existingPlan = await SubscriptionPlan.findById(req.params.id);
        if (!existingPlan) {
            return res.status(404).json(ApiResponse.error('Subscription plan not found'));
        }
        
        // Count if any user has ever subscribed to this plan
        const subscriptionCount = await Subscription.countDocuments({
            planId: existingPlan.planId  // Use planId string to match both ObjectId and string references
        });
        
        // If plan has been purchased by users, restrict certain updates
        if (subscriptionCount > 0) {
            // Allow only safe updates for plans that have been purchased
            let updateData = {};
            
            // Allow these fields to be updated
            if (description !== undefined) updateData.description = description;
            if (features !== undefined) updateData.features = features;
            if (status !== undefined) updateData.status = status;
            if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
            if (totalService !== undefined) updateData.totalService = totalService;
            
            // Calculate validityDays based on duration if provided
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
            
            // Disallow updates to critical fields that affect existing subscribers
            if (price !== undefined) {
                return res.status(400).json(
                    ApiResponse.error('Cannot update price for a plan that has been purchased by users. Create a new plan instead.')
                );
            }
            if (name !== undefined) {
                return res.status(400).json(
                    ApiResponse.error('Cannot update name for a plan that has been purchased by users. Create a new plan instead.')
                );
            }
            if (duration !== undefined) {
                return res.status(400).json(
                    ApiResponse.error('Cannot update duration for a plan that has been purchased by users. Create a new plan instead.')
                );
            }
            if (sessions !== undefined) {
                return res.status(400).json(
                    ApiResponse.error('Cannot update session count for a plan that has been purchased by users. Create a new plan instead.')
                );
            }
            if (totalService !== undefined) {
                return res.status(400).json(
                    ApiResponse.error('Cannot update total service count for a plan that has been purchased by users. Create a new plan instead.')
                );
            }
            
            // Update the plan with only allowed fields
            const plan = await SubscriptionPlan.findByIdAndUpdate(
                req.params.id,
                updateData,
                { new: true, runValidators: true }
            );

            if (!plan) {
                return res.status(404).json(ApiResponse.error('Subscription plan not found'));
            }

            return res.status(200).json(ApiResponse.success({ plan }, 'Subscription plan updated successfully with limited fields'));            
        } else {
            // If no users have purchased this plan, allow all updates
            let updateData = { name, price, description, features, duration, sessions, totalService, status, sortOrder };
            
            if (session_type !== undefined) {
                updateData.session_type = session_type;
            }
            if (price_inr !== undefined) {
                updateData.price_inr = price_inr;
            }
            if (price_usd !== undefined) {
                updateData.price_usd = price_usd;
            }
            
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
        }
    } catch (error) {
        next(error);
    }
};

// Archive a subscription plan (admin only) - soft delete approach
const archiveSubscriptionPlan = async (req, res, next) => {
    try {
        // Find the plan by ID
        const plan = await SubscriptionPlan.findByIdAndUpdate(
            req.params.id,
            { status: 'archived' },
            { new: true, runValidators: true }
        );

        if (!plan) {
            return res.status(404).json(ApiResponse.error('Subscription plan not found'));
        }

        res.status(200).json(ApiResponse.success({ plan }, 'Subscription plan archived successfully'));
    } catch (error) {
        next(error);
    }
};

// Delete a subscription plan (admin only)
const deleteSubscriptionPlan = async (req, res, next) => {
    try {
        // Check if the plan has any active or past subscriptions
        const existingPlan = await SubscriptionPlan.findById(req.params.id);
        if (!existingPlan) {
            return res.status(404).json(ApiResponse.error('Subscription plan not found'));
        }
        
        // Count if any user has ever subscribed to this plan
        const subscriptionCount = await Subscription.countDocuments({
            planId: existingPlan.planId  // Use planId string to match both ObjectId and string references
        });
        
        if (subscriptionCount > 0) {
            return res.status(400).json(
                ApiResponse.error('Cannot delete plan that has been purchased by users. Archive the plan instead or contact support.')
            );
        }

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
            
            // Get all bookings for the user that are paid (representing purchased services)
            const userBookings = await Booking.find({
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
            
            // Get all bookings for the user that are paid (representing purchased services)
            const userBookings = await Booking.find({
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

// Check if user can book service for free with subscription
const checkSubscriptionEligibility = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        
        // Find user's active subscription (get the most recent one)
        const subscription = await Subscription.findOne({ 
            userId, 
            status: 'active' 
        }).sort({ createdAt: -1 }); // Get the most recent active subscription
        
        if (!subscription) {
            return res.status(200).json(ApiResponse.success({
                eligible: false,
                message: "No active subscription found",
                reason: "USER_NO_SUBSCRIPTION"
            }));
        }
        
        // Check if subscription is expired
        if (subscription.isExpired) {
            return res.status(200).json(ApiResponse.success({
                eligible: false,
                message: "Subscription has expired",
                reason: "SUBSCRIPTION_EXPIRED"
            }));
        }
        
        // Fetch the plan data manually since planId is a string field
        let plan = null;
        if (subscription.planId) {
            const isValidObjectId = require('mongoose').Types.ObjectId.isValid(subscription.planId);
            if (isValidObjectId) {
                plan = await SubscriptionPlan.findById(subscription.planId);
            } else {
                // Try to find by planId string
                plan = await SubscriptionPlan.findOne({ planId: subscription.planId });
            }
        }
        
        if (!plan) {
            return res.status(200).json(ApiResponse.success({
                eligible: false,
                message: "Subscription plan not found",
                reason: "PLAN_NOT_FOUND",
                subscriptionId: subscription._id
            }));
        }
        
        // Count used sessions for this subscription
        // ONLY count actual Session documents, not Booking documents
        const usedSessions = await Session.countDocuments({
            $or: [
                { subscriptionId: subscription._id },
                { subscriptionId: subscription._id.toString() }
            ],
            status: { $ne: "cancelled" }
        });
        
        // Count used services for this subscription (based on bookings that have been created)
        // For subscription-based bookings, we count all bookings associated with the subscription
        const usedServices = await Booking.countDocuments({
            $or: [
                { subscriptionId: subscription._id },
                { subscriptionId: subscription._id.toString() }
            ],
            status: { $ne: "cancelled" }
        });
        
        // Get total sessions from plan (handle different formats)
        let totalSessions = 0;
        if (plan.sessions === 'unlimited' || plan.sessions === null || plan.sessions === undefined) {
            totalSessions = 'unlimited';
        } else if (typeof plan.sessions === 'number') {
            totalSessions = plan.sessions;
        } else if (typeof plan.sessions === 'string') {
            const parsed = parseInt(plan.sessions, 10);
            totalSessions = !isNaN(parsed) ? parsed : 0;
        }
        
        // Get total services from plan
        let totalServices = 0;
        if (plan.totalService === 'unlimited' || plan.totalService === null || plan.totalService === undefined) {
            totalServices = 'unlimited';
        } else if (typeof plan.totalService === 'number') {
            totalServices = plan.totalService;
        } else if (typeof plan.totalService === 'string') {
            const parsed = parseInt(plan.totalService, 10);
            totalServices = !isNaN(parsed) ? parsed : 0;
        }
        
        // Safe value calculations
        const safeUsedSessions = (usedSessions != null && !isNaN(usedSessions)) ? usedSessions : 0;
        const safeUsedServices = (usedServices != null && !isNaN(usedServices)) ? usedServices : 0;
        
        // For session eligibility check, ONLY count actual Session documents
        // Do NOT count Bookings as used sessions
        const totalUsed = safeUsedSessions; // Only count actual sessions
        const remainingSessions = (totalSessions === 'unlimited') ? 'unlimited' : Math.max(0, totalSessions - totalUsed);
        
        console.log(`Subscription eligibility check for user ${userId}:`, {
            subscriptionId: subscription._id,
            planName: plan.name,
            totalSessions: totalSessions,
            usedSessions: safeUsedSessions,
            usedServices: safeUsedServices,
            totalUsed: totalUsed,
            remainingSessions: remainingSessions
        });
        
        // Calculate remaining services (affected by service usage)
        let remainingServices = 0;
        if (totalServices === 'unlimited') {
            remainingServices = 'unlimited';
        } else {
            remainingServices = Math.max(0, totalServices - safeUsedServices);
        }
        
        // Log detailed information for debugging
        console.log(`Subscription eligibility check for user ${userId}:`, {
            subscriptionId: subscription._id,
            planId: plan._id || plan.planId,
            planName: plan.name,
            totalSessions,
            usedSessions: safeUsedSessions,
            totalServices,
            usedServices: safeUsedServices,
            totalUsed,
            remainingSessions,
            remainingServices,
            subscriptionStatus: subscription.status,
            isExpired: subscription.isExpired,
            sessionQuery: {
                subscriptionId: subscription._id,
                status: { $ne: "cancelled" }
            }
        });
        
        // Handle plans with no sessions
        if (totalSessions === 0) {
            return res.status(200).json(ApiResponse.success({
                eligible: false,
                message: `Your ${plan.name} plan does not include any sessions. Please upgrade your plan.`,
                reason: "NO_SESSIONS_IN_PLAN",
                subscriptionId: subscription._id,
                planName: plan.name || "Your Plan",
                totalSessions: totalSessions,
                totalServices: totalServices,
                usedSessions: safeUsedSessions,
                usedServices: safeUsedServices,
                totalUsed,
                remainingSessions: remainingSessions,
                remainingServices: remainingServices
            }));
        }
        
        // Handle unlimited plans
        if (totalSessions === 'unlimited') {
            return res.status(200).json(ApiResponse.success({
                eligible: true,
                message: "Unlimited sessions and services available with your subscription",
                subscriptionId: subscription._id,
                planName: plan.name || "Unlimited Plan",
                totalSessions: 'unlimited',
                totalServices: totalServices,
                usedSessions: safeUsedSessions,
                usedServices: safeUsedServices,
                totalUsed,
                remainingSessions: 'unlimited',
                remainingServices: remainingServices
            }));
        }
        
        // Check if sessions are exhausted
        if (remainingSessions <= 0) {
            return res.status(200).json(ApiResponse.success({
                eligible: false,
                message: `You have used all ${totalSessions} sessions/services from your ${plan.name} plan.`,
                reason: "SESSIONS_EXHAUSTED",
                subscriptionId: subscription._id,
                planName: plan.name || "Your Plan",
                totalSessions: totalSessions,
                totalServices: totalServices,
                usedSessions: safeUsedSessions,
                usedServices: safeUsedServices,
                totalUsed,
                remainingSessions: remainingSessions,
                remainingServices: remainingServices
            }));
        }
        
        // User has sessions remaining - they are eligible
        return res.status(200).json(ApiResponse.success({
            eligible: true,
            message: `You have ${remainingSessions} sessions/services remaining out of ${totalSessions} total in your ${plan.name} plan.`,
            subscriptionId: subscription._id,
            planName: plan.name || "Unknown Plan",
            totalSessions: totalSessions,
            totalServices: totalServices,
            usedSessions: safeUsedSessions,
            usedServices: safeUsedServices,
            totalUsed,
            remainingSessions: remainingSessions,
            remainingServices: remainingServices
        }));
        

        
    } catch (error) {
        console.error("Error checking subscription eligibility:", error);
        next(error);
    }
};

// Get available services that can be booked with subscription
const getSubscriptionServices = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        
        // Find user's active subscription
        const subscription = await Subscription.findOne({ 
            userId, 
            status: 'active' 
        }).populate('planId');
        
        if (!subscription || !subscription.planId) {
            return res.status(404).json(ApiResponse.error("No active subscription found"));
        }
        
        const plan = subscription.planId;
        
        // For subscription plans, all services are typically available
        const availableServices = [
            {
                id: 'general-physio',
                name: 'General Physiotherapy',
                description: 'Comprehensive physiotherapy consultation and treatment',
                duration: '45 minutes',
                category: 'consultation'
            },
            {
                id: 'sports-injury',
                name: 'Sports Injury Treatment',
                description: 'Specialized treatment for sports-related injuries',
                duration: '60 minutes',
                category: 'treatment'
            },
            {
                id: 'post-surgery',
                name: 'Post-Surgery Rehabilitation',
                description: 'Recovery and rehabilitation after surgical procedures',
                duration: '60 minutes',
                category: 'rehabilitation'
            },
            {
                id: 'back-pain',
                name: 'Back Pain Management',
                description: 'Specialized treatment for back and spine issues',
                duration: '45 minutes',
                category: 'treatment'
            },
            {
                id: 'neck-shoulder',
                name: 'Neck & Shoulder Therapy',
                description: 'Targeted therapy for neck and shoulder problems',
                duration: '45 minutes',
                category: 'treatment'
            }
        ];
        
        // Count used sessions
        const usedSessions = await Session.countDocuments({
            subscriptionId: subscription._id,
            status: { $ne: "cancelled" }
        });
        
        const remainingSessions = plan.sessions === 0 ? 'unlimited' : plan.sessions - usedSessions;
        
        res.status(200).json(ApiResponse.success({
            services: availableServices,
            subscriptionInfo: {
                planName: plan.name,
                totalSessions: plan.sessions === 0 ? 'unlimited' : plan.sessions,
                usedSessions: usedSessions,
                remainingSessions: remainingSessions,
                endDate: subscription.endDate
            }
        }));
        
    } catch (error) {
        console.error("Error getting subscription services:", error);
        next(error);
    }
};

// Create free session with subscription
const createFreeSessionWithSubscription = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { date, time, therapistId, serviceType, notes } = req.body;
        
        // Validate required fields
        if (!date || !time || !therapistId) {
            return res.status(400).json(ApiResponse.error("Date, time, and therapistId are required"));
        }
        
        // Find user's active subscription
        const subscription = await Subscription.findOne({ 
            userId, 
            status: 'active' 
        }).populate('planId');
        
        if (!subscription) {
            return res.status(400).json(ApiResponse.error("No active subscription found"));
        }
        
        if (subscription.isExpired) {
            return res.status(400).json(ApiResponse.error("Subscription has expired"));
        }
        
        const plan = subscription.planId;
        
        // Check session limits for limited plans
        if (plan.sessions > 0) {
            const usedSessions = await Session.countDocuments({
                subscriptionId: subscription._id,
                status: { $ne: "cancelled" }
            });
            
            if (usedSessions >= plan.sessions) {
                return res.status(400).json(ApiResponse.error(
                    `Session limit reached. You have used all ${plan.sessions} sessions in your plan.`
                ));
            }
        }
        
        // Create session without payment
        const startTime = new Date(`${date}T${time}:00`);
        const endTime = new Date(startTime.getTime() + 45 * 60000); // Default 45 minutes
        
        const session = new Session({
            subscriptionId: subscription._id,
            therapistId,
            userId,
            date,
            time,
            startTime,
            endTime,
            type: serviceType || '1-on-1',
            status: 'scheduled',
            duration: 45,
            notes: notes || `Free session booked with ${plan.name} subscription`,
            sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        });
        
        await session.save();
        
        // Return success response
        res.status(201).json(ApiResponse.success({
            session: session,
            message: "Session booked successfully with your subscription",
            subscriptionInfo: {
                planName: plan.name,
                remainingSessions: plan.sessions === 0 ? 'unlimited' : 
                    plan.sessions - (await Session.countDocuments({
                        subscriptionId: subscription._id,
                        status: { $ne: "cancelled" }
                    }))
            }
        }, "Session booked successfully"));
        
    } catch (error) {
        console.error("Error creating free session with subscription:", error);
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
    archiveSubscriptionPlan,
    getUserSubscriptions,
    getAllSubscriptions,
    getExpiredSubscriptions,
    getExpiredServices,
    checkSubscriptionEligibility,
    getSubscriptionServices,
    createFreeSessionWithSubscription
};
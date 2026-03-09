const User = require('../models/User.model');
const Subscription = require('../models/Subscription.model');
const SubscriptionPlan = require('../models/SubscriptionPlan.model');
const Booking = require('../models/Booking.model');
const Session = require('../models/Session.model');
const { generateToken } = require('../config/jwt');
const { refreshTokens } = require('../services/jwt.service');
const { hashPassword, comparePassword } = require('../utils/auth.utils');
const ApiResponse = require('../utils/apiResponse');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { createTransport } = nodemailer;
const { getEmailCredentials } = require('../utils/credentialsManager');
const NotificationService = require('../services/notificationService');

// Register a new user
const register = async (req, res, next) => {
    try {
        const { name, email, password, phone } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json(ApiResponse.error('User already exists with this email'));
        }

        // Create new user
        const user = new User({
            name,
            email,
            password,
            phone
            // role will default to 'patient' as per schema
        });


        await user.save();

        // Generate token with explicit userId string conversion
        const token = generateToken({ userId: user._id.toString(), role: user.role });

        // Send welcome notifications (email + WhatsApp) without blocking the response
        NotificationService.sendNotification(
            { email: user.email, phone: user.phone },
            'welcome_message',
            { clientName: user.name }
        ).catch(err => {
            console.error('Welcome notification failed:', err.message);
        });

        res.status(201).json(
            ApiResponse.success({
                token,
                user: {
                    id: user._id,
                    email: user.email,
                    name: user.name,
                    role: user.role
                }
            }, 'User registered successfully')
        );
    } catch (error) {
        next(error);
    }
};

// Login user
const login = async (req, res, next) => {
    try {
        // Debug: Log CSRF token details
        console.log('🔍 Login Request - CSRF Debug:');
        console.log('  - X-CSRF-Token header:', req.headers['x-csrf-token']);
        console.log('  - Cookie (csrftoken):', req.cookies?.csrftoken);
        console.log('  - All cookies:', req.cookies);
        console.log('  - Match?', req.headers['x-csrf-token'] === req.cookies?.csrftoken ? '✅ YES' : '❌ NO');

        const { email, password, appType } = req.body; // appType can be 'client' or 'admin'

        // Find user by email
        const user = await User.findOne({ email });
        console.log("findOne result:", user);
        if (!user) {
            return res
                .status(401)
                .json(ApiResponse.error("Invalid email or password", 401));
        }

        // Check if user is active
        if (user.status !== 'active') {
            return res
                .status(401)
                .json(ApiResponse.error("Account is not active. Please contact support.", 401));
        }

        // Strict role-based login isolation
        if (appType === 'client' && user.role !== 'patient') {
            return res
                .status(403)
                .json(ApiResponse.error("Access denied. Admin users cannot login to client portal.", 403));
        }

        if (appType === 'admin' && user.role !== 'admin') {
            return res
                .status(403)
                .json(ApiResponse.error("Access denied. Patient users cannot login to admin portal.", 403));
        }

        // If no appType specified, allow login but log warning
        if (!appType) {
            console.warn(`Login attempt without appType specified for user ${email}`);
        }

        // Check if password is properly hashed
        if (!user.password || typeof user.password !== 'string' || user.password.length < 10) {
            return res
                .status(401)
                .json(ApiResponse.error("Invalid email or password", 401));
        }

        let isMatch = false;

        // Handle temporary password case
        if (user.hasTempPassword) {
            // For users with temporary passwords, we need to compare against the hashed password
            // because the temp password gets hashed when saved to the database
            isMatch = await comparePassword(password, user.password);

            // If temp password login is successful, convert it to regular password
            if (isMatch) {
                // Update user to remove temp password flag and keep the same password
                user.hasTempPassword = false;
                await user.save({ validateBeforeSave: false });
                console.log(`Temp password used for user ${email}, converted to regular password`);
            }
        } else {
            // Regular password comparison
            isMatch = await comparePassword(password, user.password);
        }

        if (!isMatch) {
            return res
                .status(401)
                .json(ApiResponse.error("Invalid email or password", 401));
        }

        // Generate token with explicit string conversion
        const token = generateToken({
            userId: user._id.toString(),
            role: user.role,
        });

        console.log("🎟️ JWT token generated for user:", {
            userId: user._id.toString(),
            role: user.role,
        });

        res.status(200).json(
            ApiResponse.success(
                {
                    token,
                    user: {
                        id: user._id,
                        email: user.email,
                        name: user.name,
                        role: user.role,
                        phone: user.phone,
                    },
                },
                "Login successful"
            )
        );

        console.log("🎉 Login successful for:", email);
    } catch (error) {
        console.error("🔥 Login error:", error.message);
        next(error);
    }
};


// Logout user
const logout = async (req, res, next) => {
    try {
        // In a real application, you might want to add the token to a blacklist
        res.status(200).json(ApiResponse.success(null, 'User logged out successfully'));
    } catch (error) {
        next(error);
    }
};

// Validate token and check app type compatibility
const validateToken = async (req, res, next) => {
    try {
        const { appType } = req.body; // Optional: 'client' or 'admin'

        // Token is already validated by authenticateToken middleware
        // req.user is attached with userId and role

        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(401).json(ApiResponse.error("User not found", 401));
        }

        // Check if user is active
        if (user.status !== 'active') {
            return res.status(401).json(ApiResponse.error("Account is not active", 401));
        }

        // If appType is provided, validate role compatibility
        if (appType) {
            const validAppTypes = ['client', 'admin'];
            if (!validAppTypes.includes(appType)) {
                return res.status(400).json(ApiResponse.error("Invalid appType. Must be 'client' or 'admin'", 400));
            }

            // Strict role-based app type validation
            if (appType === 'client' && user.role !== 'patient') {
                return res.status(403).json(ApiResponse.error("Access denied. Admin users cannot access client portal", 403));
            }

            if (appType === 'admin' && user.role !== 'admin') {
                return res.status(403).json(ApiResponse.error("Access denied. Patient users cannot access admin portal", 403));
            }
        }

        // Token is valid and user has appropriate access
        res.json(ApiResponse.success({
            valid: true,
            userId: user._id,
            email: user.email,
            role: user.role,
            name: user.name,
            appTypeCompatible: appType ? true : null,
            message: appType ? `Token is valid for ${appType} application` : "Token is valid"
        }, "Token validation successful"));

    } catch (error) {
        next(error);
    }
};

// Get user profile
const getProfile = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.userId).select('-password');
        if (!user) {
            return res.status(404).json(ApiResponse.error('User not found'));
        }

        // If user has a profile picture, convert to full URL
        if (user.profilePicture && user.profilePicture.startsWith('/uploads/')) {
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            user.profilePicture = `${baseUrl}${user.profilePicture}`;
        }

        // Get user's subscriptions (both active and recent ones) - with error handling
        let subscriptions = [];
        try {
            subscriptions = await Subscription.find({
                userId: req.user.userId
            })
                .sort({ createdAt: -1 })
                .limit(5); // Get last 5 subscriptions
        } catch (subError) {
            console.error('Error fetching subscriptions:', subError);
            subscriptions = [];
        }

        // Manually populate plan details while preserving original planId - with error handling
        const subscriptionsWithPlanDetails = await Promise.all(subscriptions.map(async (subscription) => {
            try {
                const subscriptionObj = subscription.toObject();
                
                // Look up the plan using the planId string
                if (subscriptionObj.planId) {
                    const plan = await SubscriptionPlan.findOne({ planId: subscriptionObj.planId });
                    if (plan) {
                        // Add plan details as a separate property instead of overwriting planId
                        subscriptionObj.planDetails = plan.toObject();
                    }
                }
                
                return subscriptionObj;
            } catch (planError) {
                console.error('Error populating plan details:', planError);
                return subscription.toObject();
            }
        }));

        // Find the most relevant subscription (active/paid or most recent)
        let activeSubscription = null;
        let expiredSubscriptions = [];

        // Check expiration status for all subscriptions
        const subscriptionsWithExpiry = await Promise.all(subscriptionsWithPlanDetails.map(async (subscription) => {
            const expiryStatus = subscription.checkExpirationStatus ? subscription.checkExpirationStatus() : {
                isExpired: subscription.endDate ? new Date() > new Date(subscription.endDate) : false,
                expiryDate: subscription.endDate,
                status: subscription.endDate ? (new Date() > new Date(subscription.endDate) ? 'expired' : 'active') : 'active',
                daysRemaining: subscription.endDate ? Math.ceil((new Date(subscription.endDate) - new Date()) / (1000 * 60 * 60 * 24)) : Infinity
            };
            
            return {
                ...subscription,
                ...expiryStatus
            };
        }));

        // Separate active and expired subscriptions
        // Only show subscriptions that are actually paid
        const activeSubscriptions = subscriptionsWithExpiry.filter(sub => 
            !sub.isExpired && sub.status === 'paid' || sub.status === 'active'
        );
        
        expiredSubscriptions = subscriptionsWithExpiry.filter(sub => sub.isExpired);

        // First check for active subscriptions
        activeSubscription = activeSubscriptions[0] || null;

        // If no active subscription found, get the most recent paid one
        if (!activeSubscription && subscriptions.length > 0) {
            const paidSubscriptions = subscriptionsWithExpiry.filter(sub => sub.status === 'paid');
            if (paidSubscriptions.length > 0) {
                activeSubscription = paidSubscriptions[0];
            }
        }

        // Get user's bookings with service information - with error handling
        let userBookings = [];
        try {
            userBookings = await Booking.find({
                userId: req.user.userId
            })
                .populate('serviceId')
                .sort({ createdAt: -1 });
        } catch (bookingError) {
            console.error('Error fetching bookings:', bookingError);
            userBookings = [];
        }

        // Get active services from bookings (only services user has purchased)
        const purchasedServices = userBookings
            .filter(booking =>
                booking.serviceId &&
                booking.serviceId.status === 'active' &&
                booking.status === 'confirmed' &&
                booking.paymentStatus === 'paid'
            )
            .map(booking => {
                // Calculate expiration status based on service validity
                const service = booking.serviceId;
                let isExpired = false;
                let expiryDate = null;
                
                if (service.validity && service.validity > 0) {
                    const purchaseDate = booking.purchaseDate || booking.createdAt;
                    const calculatedExpiryDate = new Date(purchaseDate);
                    calculatedExpiryDate.setDate(calculatedExpiryDate.getDate() + service.validity);
                    
                    expiryDate = calculatedExpiryDate;
                    isExpired = new Date() > calculatedExpiryDate;
                }
                
                return {
                    id: service._id,
                    name: service.name,
                    description: service.description,
                    category: service.category,
                    price: service.price,
                    duration: service.duration,
                    validity: service.validity,
                    bookingId: booking._id,
                    bookingDate: booking.date,
                    bookingTime: booking.time,
                    bookingStatus: booking.status,
                    paymentStatus: booking.paymentStatus,
                    amountPaid: booking.amount,
                    purchaseDate: booking.purchaseDate || booking.createdAt,
                    expiryDate,
                    isExpired,
                    serviceSessionInfo: {
                        total: service.sessions,
                        used: 0, // This would need to be calculated based on actual usage
                        remaining: service.sessions
                    }
                };
            })
            .filter(service => !service.isExpired); // Filter out expired services

        // Count used sessions and services for this subscription before building response - with error handling
        let usedSessions = 0;
        let usedServices = 0;
        
        // Use the plan details from the preserved object
        const planDetails = activeSubscription?.planDetails;
        
        if (activeSubscription && planDetails) {
            try {
                // Count used sessions for this subscription
                usedSessions = await Session.countDocuments({
                    subscriptionId: activeSubscription._id,
                    status: { $ne: "cancelled" }
                });
            } catch (sessionError) {
                console.error('Error counting sessions:', sessionError);
                usedSessions = 0;
            }
            
            try {
                // Count used services for this subscription (based on bookings)
                // For subscription-based bookings, we count all bookings associated with the subscription
                usedServices = await Booking.countDocuments({
                    subscriptionId: activeSubscription._id,
                    status: { $ne: "cancelled" }
                });
            } catch (serviceError) {
                console.error('Error counting services:', serviceError);
                usedServices = 0;
            }
        }
        
        // Calculate remaining counts
        const totalSessions = planDetails?.sessions || 0;
        const totalServices = planDetails?.totalService || 0;
        const remainingSessions = Math.max(0, totalSessions - usedSessions);
        const remainingServices = Math.max(0, totalServices - usedServices);
        
        // Add subscription data, expiration info, and purchased services to the response
        const responseData = {
            ...user.toObject(),
            subscriptionData: activeSubscription ? {
                id: activeSubscription._id,
                planId: activeSubscription.planId, // This is now preserved as a string
                planName: planDetails?.name || activeSubscription.planName, // Use plan details name
                amount: activeSubscription.amount,
                currency: activeSubscription.currency,
                status: activeSubscription.status,
                startDate: activeSubscription.startDate,
                endDate: activeSubscription.endDate,
                isExpired: activeSubscription.isExpired,
                daysRemaining: activeSubscription.daysRemaining,
                expiryStatus: activeSubscription.status, // active, expiring_soon, expired
                createdAt: activeSubscription.createdAt,
                // Add session and service usage information
                totalSessions: totalSessions,
                totalService: totalServices,
                usedSessions: usedSessions,
                usedServices: usedServices,
                remainingSessions: remainingSessions,
                remainingServices: remainingServices,
            } : null,
            expiredSubscriptions: expiredSubscriptions.map(sub => ({
                id: sub._id,
                planId: sub.planId,
                planName: sub.planName,
                amount: sub.amount,
                status: sub.status,
                startDate: sub.startDate,
                endDate: sub.endDate,
                expiredDays: Math.abs(sub.daysRemaining),
                expiryDate: sub.expiryDate
            })),
            purchasedServices: purchasedServices
        };

        // If there's an active subscription, add detailed usage information with percentages
        if (activeSubscription && activeSubscription.planId) {
            const plan = activeSubscription.planId;
            
            // Calculate percentage used for sessions
            const sessionPercentageUsed = plan.sessions > 0 ? Math.round(((responseData.subscriptionData.usedSessions || 0) / plan.sessions) * 100) : 0;
            
            // Add session usage info to subscription data
            responseData.subscriptionData.availableSessions = {
                total: plan.sessions,
                used: responseData.subscriptionData.usedSessions || 0,
                remaining: responseData.subscriptionData.remainingSessions || 0,
                percentageUsed: sessionPercentageUsed
            };
            
            // Calculate percentage used for services
            const servicePercentageUsed = plan.totalService > 0 ? Math.round(((responseData.subscriptionData.usedServices || 0) / plan.totalService) * 100) : 0;
            
            // Add service usage info to subscription data
            responseData.subscriptionData.availableServices = {
                total: plan.totalService,
                used: responseData.subscriptionData.usedServices || 0,
                remaining: responseData.subscriptionData.remainingServices || 0,
                percentageUsed: servicePercentageUsed
            };
        }

        // Add subscription warning message if there are expired subscriptions
        if (expiredSubscriptions.length > 0) {
            responseData.subscriptionWarning = {
                type: 'expired',
                message: `You have ${expiredSubscriptions.length} expired subscription(s).`,
                count: expiredSubscriptions.length
            };
        } else if (activeSubscription && activeSubscription.status === 'expiring_soon') {
            responseData.subscriptionWarning = {
                type: 'expiring_soon',
                message: `Your subscription expires in ${activeSubscription.daysRemaining} day(s).`,
                daysRemaining: activeSubscription.daysRemaining
            };
        }

        res.status(200).json(ApiResponse.success(responseData, 'Profile retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Get all admin profiles (fully public endpoint)
const getAllAdminProfiles = async (req, res, next) => {
    try {
        // Get all admin users
        const admins = await User.find({ role: 'admin' }).select('-password -resetPasswordToken -resetPasswordExpires');
        
        if (!admins || admins.length === 0) {
            return res.status(404).json(ApiResponse.error('No admin users found'));
        }

        // Process each admin's data for public consumption
        const publicAdminData = admins.map(admin => {
            // Convert profile picture to full URL if it exists
            let profilePictureUrl = admin.profilePicture;
            if (admin.profilePicture && admin.profilePicture.startsWith('/uploads/')) {
                const baseUrl = `${req.protocol}://${req.get('host')}`;
                profilePictureUrl = `${baseUrl}${admin.profilePicture}`;
            }

            // Convert certification URLs to full URLs if they exist
            let certificationsUrls = admin.doctorProfile?.certifications || [];
            if (certificationsUrls.length > 0) {
                const baseUrl = `${req.protocol}://${req.get('host')}`;
                certificationsUrls = certificationsUrls.map(cert => {
                    if (cert && cert.startsWith('/uploads/')) {
                        return `${baseUrl}${cert}`;
                    }
                    return cert;
                });
            }

            // Handle languages - convert to string if it's an array
            let languagesDisplay = '';
            if (admin.doctorProfile?.languages) {
                if (Array.isArray(admin.doctorProfile.languages)) {
                    languagesDisplay = admin.doctorProfile.languages.join(', ');
                } else {
                    languagesDisplay = admin.doctorProfile.languages;
                }
            }
            
            return {
                id: admin._id,
                name: admin.name,
                email: admin.email,
                role: admin.role,
                profilePicture: profilePictureUrl,
                doctorProfile: admin.doctorProfile ? {
                    name: admin.doctorProfile.name,
                    experience: admin.doctorProfile.experience,
                    specialization: admin.doctorProfile.specialization,
                    bio: admin.doctorProfile.bio,
                    education: admin.doctorProfile.education,
                    languages: languagesDisplay,
                    certifications: certificationsUrls,
                    certificationNames: admin.doctorProfile.certificationNames || []
                } : null,
                joinDate: admin.joinDate
            };
        });

        res.status(200).json(ApiResponse.success(publicAdminData, 'All admin profiles retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Get public admin profile (publicly accessible but only for admin users)
const getPublicProfile = async (req, res, next) => {
    try {
        const { userId } = req.params;
        
        // Only allow access to admin user profiles
        const user = await User.findById(userId).select('-password -resetPasswordToken -resetPasswordExpires');
        if (!user) {
            return res.status(404).json(ApiResponse.error('User not found'));
        }

        // Check if user is admin
        if (user.role !== 'admin') {
            return res.status(403).json(ApiResponse.error('Access denied. Only admin profiles are publicly accessible.'));
        }

        // If user has a profile picture, convert to full URL
        if (user.profilePicture && user.profilePicture.startsWith('/uploads/')) {
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            user.profilePicture = `${baseUrl}${user.profilePicture}`;
        }

        // Handle languages - convert to string if it's an array
        let languagesDisplay = '';
        if (user.doctorProfile?.languages) {
            if (Array.isArray(user.doctorProfile.languages)) {
                languagesDisplay = user.doctorProfile.languages.join(', ');
            } else {
                languagesDisplay = user.doctorProfile.languages;
            }
        }
        
        // Prepare admin-specific public data
        const publicAdminData = {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            profilePicture: user.profilePicture,
            doctorProfile: user.doctorProfile ? {
                name: user.doctorProfile.name,
                experience: user.doctorProfile.experience,
                specialization: user.doctorProfile.specialization,
                bio: user.doctorProfile.bio,
                education: user.doctorProfile.education,
                languages: languagesDisplay,
                certifications: user.doctorProfile.certifications,
                certificationNames: user.doctorProfile.certificationNames || []
            } : null,
            joinDate: user.joinDate
        };

        res.status(200).json(ApiResponse.success(publicAdminData, 'Admin profile retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Update user profile
const updateProfile = async (req, res, next) => {
    try {
       const { name, phone, location } = req.body;


        // Handle healthProfile - it may come as a JSON string when using form data
        let healthProfile = req.body.healthProfile;
        if (typeof healthProfile === 'string') {
            try {
                healthProfile = JSON.parse(healthProfile);
            } catch (e) {
                // If it's not JSON, create an object from individual fields
                healthProfile = {};
                Object.keys(req.body).forEach(key => {
                    if (key.startsWith('healthProfile[')) {
                        const field = key.match(/healthProfile\[(.*?)\]/)[1];
                        if (!healthProfile[field]) {
                            healthProfile[field] = req.body[key];

                            // Convert numeric fields
                            if (field === 'painIntensity') {
                                healthProfile[field] = parseInt(req.body[key]) || null;
                            }
                        }
                    }
                });
            }
        }

        // Handle doctorProfile - it may come as a JSON string when using form data
        let doctorProfile = req.body.doctorProfile;
        if (typeof doctorProfile === 'string') {
            try {
                doctorProfile = JSON.parse(doctorProfile);
            } catch (e) {
                // If it's not JSON, create an object from individual fields
                doctorProfile = {};
            }
        } else if (!doctorProfile) {
            doctorProfile = {};
        }
        
        // Handle individual doctorProfile fields (doctorProfile[...])
        Object.keys(req.body).forEach(key => {
            if (key.startsWith('doctorProfile[')) {
                const field = key.match(/doctorProfile\[(.*?)\]/)[1];
                if (!doctorProfile[field]) {
                    doctorProfile[field] = req.body[key];
                    
                    // Handle certificationNames specifically
                    if (field === 'certificationNames' && typeof req.body[key] === 'string') {
                        try {
                            // Handle deeply nested JSON strings
                            let parsed = req.body[key];
                            // Keep parsing while it's a string that looks like JSON
                            while (typeof parsed === 'string' && (parsed.startsWith('[') || parsed.startsWith('{'))) {
                                try {
                                    parsed = JSON.parse(parsed);
                                } catch (e) {
                                    break;
                                }
                            }
                            doctorProfile[field] = Array.isArray(parsed) ? parsed : [parsed];
                        } catch (parseError) {
                            doctorProfile[field] = [req.body[key]];
                        }
                    }
                }
            }
        });
        
        // Handle certificationNames that come directly in req.body
        let certificationNames = req.body.certificationNames;
        if (typeof certificationNames === 'string') {
            try {
                // Handle deeply nested JSON strings
                let parsed = certificationNames;
                // Keep parsing while it's a string that looks like JSON
                while (typeof parsed === 'string' && (parsed.startsWith('[') || parsed.startsWith('{'))) {
                    try {
                        parsed = JSON.parse(parsed);
                    } catch (e) {
                        break;
                    }
                }
                certificationNames = Array.isArray(parsed) ? parsed : [parsed];
            } catch (e) {
                certificationNames = [certificationNames];
            }
            
            // If we have certificationNames but no doctorProfile, create one
            if (!doctorProfile) {
                doctorProfile = {};
            }
            doctorProfile.certificationNames = certificationNames;
        }

        // Handle profile picture if uploaded
        let profilePicture = null;
        if (req.files && req.files['profilePicture'] && req.files['profilePicture'].length > 0) {
            // Create full URL for the image
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            profilePicture = `${baseUrl}/uploads/profile-pictures/${req.files['profilePicture'][0].filename}`;
        }

        // Handle certification files if uploaded
        let certifications = [];
        if (req.files && req.files['certifications']) {
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            certifications = req.files['certifications'].map(file => 
                `${baseUrl}/uploads/certifications/${file.filename}`
            );
        }

      const updateData = { name, phone };

if (location) {
  updateData.location = location;
}
    
        if (healthProfile && Object.keys(healthProfile).length > 0) {
            updateData.healthProfile = healthProfile;
        }
        if (doctorProfile && Object.keys(doctorProfile).length > 0) {
            // Merge existing certifications with new ones if they exist
            if (certifications.length > 0) {
                doctorProfile.certifications = [
                    ...(doctorProfile.certifications || []),
                    ...certifications
                ];
            }
            updateData.doctorProfile = doctorProfile;
        } else if (certifications.length > 0) {
            // If no doctorProfile exists but we have certifications, create one
            updateData.doctorProfile = {
                certifications: certifications
            };
        }
        if (profilePicture) {
            updateData.profilePicture = profilePicture;
        }

        const user = await User.findByIdAndUpdate(
            req.user.userId,
            updateData,
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json(ApiResponse.error('User not found'));
        }

        // If user has a profile picture, convert to full URL
        if (user.profilePicture && user.profilePicture.startsWith('/uploads/')) {
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            user.profilePicture = `${baseUrl}${user.profilePicture}`;
        }

        // If user has certifications, convert to full URLs
        if (user.doctorProfile && user.doctorProfile.certifications) {
            user.doctorProfile.certifications = user.doctorProfile.certifications.map(cert => {
                if (cert && cert.startsWith('/uploads/')) {
                    const baseUrl = `${req.protocol}://${req.get('host')}`;
                    return `${baseUrl}${cert}`;
                }
                return cert;
            });
        }

        res.status(200).json(ApiResponse.success(user, 'Profile updated successfully'));
    } catch (error) {
        next(error);
    }
};

// Create admin user (for initial setup only)
const createAdminUser = async (req, res, next) => {
    try {
        const { name, email, password } = req.body;

        // Validation
        if (!name || !email || !password) {
            return res.status(400).json(ApiResponse.error('Name, email, and password are required'));
        }

        // Check if an admin user already exists
        const existingAdmin = await User.findOne({ role: 'admin' });
        if (existingAdmin) {
            return res.status(400).json(ApiResponse.error('An admin user already exists'));
        }

        // Check if user with this email already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json(ApiResponse.error('A user with this email already exists'));
        }

        // Create new admin user
        const adminUser = new User({
            name,
            email,
            password,
            role: 'admin'
        });

        await adminUser.save();

        // Log the created admin user ID for debugging
        console.log("🔐 Admin user created with ID:", adminUser._id.toString());

        // Generate token with explicit userId
        const token = generateToken({ 
            userId: adminUser._id.toString(), 
            role: adminUser.role 
        });

        console.log("🎟️ Admin JWT token payload:", {
            userId: adminUser._id.toString(),
            role: adminUser.role
        });

        res.status(201).json(
            ApiResponse.success({
                token,
                user: {
                    id: adminUser._id,
                    email: adminUser.email,
                    name: adminUser.name,
                    role: adminUser.role
                }
            }, 'Admin user created successfully')
        );
    } catch (error) {
        next(error);
    }
};

// Forgot password - initiate password reset
const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json(ApiResponse.error('Email is required'));
        }

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json(ApiResponse.error('User not found with this email'));
        }

        // Generate password reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = Date.now() + 3600000; // 1 hour

        // Save reset token and expiry to user
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = resetTokenExpiry;
        await user.save({ validateBeforeSave: false });

        // Get email credentials from database
        const emailCreds = await getEmailCredentials();
        if (!emailCreds) {
            return res.status(500).json(ApiResponse.error('Email configuration not found. Please contact administrator.'));
        }

        // Configure security settings based on encryption type
        let secure = false;
        let requireTLS = false;

        if (emailCreds.encryption) {
            switch (emailCreds.encryption.toUpperCase()) {
                case 'SSL':
                    secure = true;
                    break;
                case 'TLS':
                case 'STARTTLS':
                    requireTLS = true;
                    break;
                case 'NONE':
                    secure = false;
                    requireTLS = false;
                    break;
                default:
                    // Default behavior based on port
                    secure = emailCreds.port === 465;
                    break;
            }
        } else {
            // Default behavior based on port if no encryption specified
            secure = emailCreds.port === 465;
        }

        // Create transporter for sending email
        const resetPasswordTransporter = createTransport({
            host: emailCreds.host,
            port: emailCreds.port,
            secure: secure, // true for 465, false for other ports like 587
            requireTLS: requireTLS, // Enable STARTTLS if required
            auth: {
                user: emailCreds.user,
                pass: emailCreds.password
            }
        });

        try {
            // Verify transporter configuration
            await resetPasswordTransporter.verify();
        } catch (verifyError) {
            console.error('Email transporter verification failed:', verifyError.message);
            // Continue to send email, as verification sometimes fails but sending succeeds
        }

        // Prepare email
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
        const message = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Password Reset</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>

<body style="margin:0; padding:0; background-color:#f4f6f8; font-family:Arial, Helvetica, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f8; padding:30px 0;">
    <tr>
      <td align="center">

        <!-- Main Container -->
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 6px 18px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#667eea,#764ba2); padding:30px; text-align:center; color:#ffffff;">
              <h1 style="margin:0; font-size:26px;">Tanish Physio</h1>
              <p style="margin:8px 0 0; font-size:14px; opacity:0.9;">
                Physical Therapy & Rehabilitation Center
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:35px; color:#333333;">
              <h2 style="margin-top:0; font-size:22px; color:#222;">
                Password Reset Request
              </h2>

              <p style="font-size:15px; line-height:1.6;">
                Hello <strong>${user.name}</strong>,
              </p>

              <p style="font-size:15px; line-height:1.6;">
                We received a request to reset the password for your <strong>Tanish Physio</strong> account.
                Click the button below to securely reset your password.
              </p>

              <!-- Button -->
              <table cellpadding="0" cellspacing="0" width="100%" style="margin:25px 0;">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}"
                       style="background:linear-gradient(135deg,#667eea,#764ba2);
                              color:#ffffff;
                              text-decoration:none;
                              padding:14px 34px;
                              border-radius:6px;
                              font-size:15px;
                              font-weight:bold;
                              display:inline-block;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="font-size:14px; color:#555; line-height:1.6;">
                ⚠️ This password reset link will expire in <strong>1 hour</strong> for security reasons.
              </p>

              <p style="font-size:14px; color:#555; line-height:1.6;">
                If you did not request this reset, you can safely ignore this email.
                Your password will remain unchanged.
              </p>

              <p style="font-size:15px; margin-top:30px;">
                Regards,<br>
                <strong>Tanish Physio Team</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f1f3f6; padding:20px; text-align:center; font-size:12px; color:#777;">
              <p style="margin:0;">
                © 2024 Tanish Physio. All rights reserved.
              </p>
              <p style="margin:6px 0 0;">
                This is an automated email. Please do not reply.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
`;

        const mailOptions = {
            to: user.email,
            from: emailCreds.user,
            subject: 'Password Reset Request - Tanish Physio',
            html: message
        };

        // Send email with error handling
        try {
            await resetPasswordTransporter.sendMail(mailOptions);
        } catch (emailError) {
            console.error('Error sending password reset email:', {
                message: emailError.message,
                code: emailError.code,
                command: emailError.command
            });

            if (emailError.code === 'EAUTH' || emailError.message.includes('535') || emailError.message.includes('Username and Password not accepted')) {
                console.error('Authentication error: Please check your email credentials in the admin panel. If using Gmail, ensure you are using an App Password, not your regular password.');
                return res.status(500).json(ApiResponse.error('Email configuration error. Please contact administrator.'));
            }

            throw emailError;
        }

        res.status(200).json(ApiResponse.success(null, 'Password reset email sent successfully'));
    } catch (error) {
        // Clear reset token if error occurs
        if (req.user) {
            req.user.resetPasswordToken = undefined;
            req.user.resetPasswordExpires = undefined;
            await req.user.save({ validateBeforeSave: false });
        }

        next(error);
    }
};

// Reset password - complete password reset
const resetPassword = async (req, res, next) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        if (!password) {
            return res.status(400).json(ApiResponse.error('New password is required'));
        }

        if (password.length < 6) {
            return res.status(400).json(ApiResponse.error('Password must be at least 6 characters long'));
        }

        // Find user by reset token
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json(ApiResponse.error('Password reset token is invalid or has expired'));
        }

        // Update user password and clear reset token
        // The pre-save hook will hash the password automatically
        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        user.hasTempPassword = false; // Clear temp password flag when password is reset

        await user.save();

        res.status(200).json(ApiResponse.success(null, 'Password reset successfully'));
    } catch (error) {
        next(error);
    }
};

// Update password for authenticated user
const updatePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json(ApiResponse.error('Current password and new password are required'));
        }

        if (newPassword.length < 6) {
            return res.status(400).json(ApiResponse.error('New password must be at least 6 characters long'));
        }

        // Get user from token (req.user is populated by auth middleware)
        const user = await User.findById(req.user.userId).select('+password');

        if (!user) {
            return res.status(404).json(ApiResponse.error('User not found'));
        }

        // Check current password
        const isMatch = await comparePassword(currentPassword, user.password);

        if (!isMatch) {
            return res.status(400).json(ApiResponse.error('Current password is incorrect'));
        }

        // Set new password (will be hashed by pre-save hook)
        user.password = newPassword;
        user.hasTempPassword = false; // Clear temp password flag when user sets new password
        await user.save();

        res.status(200).json(ApiResponse.success(null, 'Password updated successfully'));
    } catch (error) {
        next(error);
    }
};

// Refresh token (generate a new token with the same payload)
const refreshToken = async (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers["authorization"];
        const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json(ApiResponse.error("Access token required"));
        }

        try {
            // Use the refreshTokens function from jwt.service
            const newToken = refreshTokens(token);

            return res.status(200).json(
                ApiResponse.success(
                    { token: newToken },
                    "Token refreshed successfully"
                )
            );
        } catch (error) {
            return res.status(403).json(ApiResponse.error("Invalid token, please login again"));
        }
    } catch (error) {
        console.error("Token refresh error:", error.message);
        next(error);
    }
};

module.exports = {
    register,
    login,
    logout,
    validateToken,
    getProfile,
    getPublicProfile,
    getAllAdminProfiles,
    updateProfile,
    createAdminUser,
    forgotPassword,
    resetPassword,
    updatePassword,
    refreshToken
};

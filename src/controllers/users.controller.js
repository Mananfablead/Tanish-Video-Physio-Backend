const mongoose = require('mongoose');
const User = require('../models/User.model');
const Booking = require('../models/Booking.model');
const Subscription = require('../models/Subscription.model');
const ApiResponse = require('../utils/apiResponse');
const { generateToken } = require('../config/jwt');

// Get all users (admin only)
const getAllUsers = async (req, res, next) => {
    try {
        // Get all patient users without pagination/search
        const users = await User.find({ role: 'patient' })
            .select('-password')
            .sort({ createdAt: -1 });

        // Populate service and subscription information for all users
        const resultUsers = [];
        for (let user of users) {
            // Get user's recent bookings to identify services used
            const bookings = await Booking.find({ userId: user._id }).populate('serviceId').sort({ createdAt: -1 }).limit(5);
            user._doc.servicesUsed = bookings.map(booking => ({
                serviceName: booking.serviceName,
                serviceId: booking.serviceId?._id,
                bookingDate: booking.createdAt,
                bookingId: booking._id
            }));
            
            // Get user's subscription information
            const subscription = await Subscription.findOne({ userId: user._id }).sort({ createdAt: -1 });
            user._doc.subscriptionInfo = subscription ? {
                planName: subscription.planName,
                planId: subscription.planId,
                status: subscription.status,
                startDate: subscription.startDate,
                endDate: subscription.endDate,
                amount: subscription.amount,
                isExpired: subscription.checkExpirationStatus ? subscription.checkExpirationStatus().isExpired : (subscription.endDate ? new Date(subscription.endDate) < new Date() : false),
                daysUntilExpiry: subscription.checkExpirationStatus ? subscription.checkExpirationStatus().daysRemaining : null
            } : null;
            
            // Convert profile picture paths to full URLs
            if (user.profilePicture && user.profilePicture.startsWith('/uploads/')) {
                const baseUrl = `${req.protocol}://${req.get('host')}`;
                user.profilePicture = `${baseUrl}${user.profilePicture}`;
            }
            
            resultUsers.push(user);
        }

        res.status(200).json(
            ApiResponse.success({
                users: resultUsers
            }, 'Users retrieved successfully')
        );
    } catch (error) {
        next(error);
    }
};

// Get user by ID
const getUserById = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) {
            return res.status(404).json(ApiResponse.error('User not found'));
        }
        
        // Get user's recent bookings to identify services used
        const bookings = await Booking.find({ userId: req.params.id }).populate('serviceId').sort({ createdAt: -1 }).limit(10);
        user._doc.servicesUsed = bookings.map(booking => ({
            serviceName: booking.serviceName,
            serviceId: booking.serviceId?._id,
            bookingDate: booking.createdAt,
            bookingId: booking._id
        }));
        
        // Get user's subscription information
        const subscription = await Subscription.findOne({ userId: req.params.id }).sort({ createdAt: -1 });
        user._doc.subscriptionInfo = subscription ? {
            planName: subscription.planName,
            planId: subscription.planId,
            status: subscription.status,
            startDate: subscription.startDate,
            endDate: subscription.endDate,
            amount: subscription.amount,
            isExpired: subscription.checkExpirationStatus ? subscription.checkExpirationStatus().isExpired : (subscription.endDate ? new Date(subscription.endDate) < new Date() : false),
            daysUntilExpiry: subscription.checkExpirationStatus ? subscription.checkExpirationStatus().daysRemaining : null
        } : null;

        // If user has a profile picture, convert to full URL
        if (user.profilePicture && user.profilePicture.startsWith('/uploads/')) {
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            user.profilePicture = `${baseUrl}${user.profilePicture}`;
        }

        res.status(200).json(ApiResponse.success(user, 'User retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Update user by ID (admin only)
const updateUser = async (req, res, next) => {
    try {
        const { name, email, phone, subscription, status } = req.body;

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { name, email, phone, subscription, status },
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

        res.status(200).json(ApiResponse.success(user, 'User updated successfully'));
    } catch (error) {
        next(error);
    }
};

// Create user (admin only)
const createUser = async (req, res, next) => {
    try {
        const { name, email, phone, password, role = 'patient', status = 'active', assignedServices = [], subscriptionInfo = null } = req.body;
        const crypto = require('crypto');
        const { sendEmail } = require('../services/email.service');

        let tempPassword = null; // Initialize to track if we created a new user with temp password

        // Validation - password is now optional
        if (!name || !email) {
            return res.status(400).json(ApiResponse.error('Name and email are required'));
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json(ApiResponse.error('Invalid email format'));
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json(ApiResponse.error('User with this email already exists'));
        }

        // Generate random password if not provided
        tempPassword = Math.random().toString(36).slice(-8) + 'Temp1!';

        // Prepare subscription info if provided
        let processedSubscriptionInfo = null;
        let createdSubscription = null;
        
        if (subscriptionInfo && subscriptionInfo.planId) {
            const SubscriptionPlan = mongoose.model('SubscriptionPlan');
            const plan = await SubscriptionPlan.findOne({ planId: subscriptionInfo.planId });
            
            if (plan) {
                const startDate = new Date();
                
                // Calculate end date based on plan validityDays or duration
                const endDate = new Date(startDate);
                const validityDays = plan.validityDays || 
                    (function() {
                        switch(plan.duration) {
                            case 'one-time': return 1;
                            case 'daily': return 1;
                            case 'weekly': return 7;
                            case 'monthly': return 30;
                            case 'quarterly': return 90;
                            case 'half-yearly': return 180;
                            case 'yearly': return 365;
                            default: return 30;
                        }
                    })();
                
                endDate.setDate(endDate.getDate() + validityDays);
                
                processedSubscriptionInfo = {
                    planId: plan.planId,
                    planName: plan.name,
                    status: 'active',
                    startDate: startDate,
                    endDate: endDate,
                    isExpired: false
                };

                // Generate unique order ID for admin-created subscription
                const orderId = `ADMIN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                
                // Create Subscription record without payment
                const Subscription = mongoose.model('Subscription');
                createdSubscription = new Subscription({
                    userId: null, // Will be set after user is created
                    planId: plan.planId,
                    planName: plan.name,
                    amount: plan.price,
                    currency: 'INR',
                    orderId: orderId,
                    paymentId: null, // No payment for admin-assigned subscriptions
                    status: 'active',
                    startDate: startDate,
                    endDate: endDate,
                    autoRenew: false,
                    paymentGateway: 'admin_assignment',
                    guestName: name,
                    guestEmail: email,
                    guestPhone: phone,
                    finalAmount: plan.price,
                    discountAmount: 0,
                    scheduleType: 'now'
                });
            }
        }

        // Prepare user data object
        const userData = {
            name,
            email,
            phone,
            password: tempPassword,
            role,
            status,
            hasTempPassword: tempPassword ? true : false,
            assignedServices: assignedServices || []
        };
        
        // Only add subscriptionInfo if it's not null
        if (processedSubscriptionInfo) {
            userData.subscriptionInfo = processedSubscriptionInfo;
        }

        // Create new user - password will be hashed by pre-save hook
        const user = new User(userData);

        await user.save();

        // If subscription was created, update it with the userId
        if (createdSubscription) {
            createdSubscription.userId = user._id;
            await createdSubscription.save();
            
            console.log(`✅ Subscription created for user ${user.email}: ${createdSubscription._id}`);
        }

        // Remove password from response
        const userResponse = user.toObject();
        delete userResponse.password;

        // Send welcome email with credentials
        try {
            let emailContent;
            if (tempPassword) {
                emailContent = `
                    <h2>Welcome to Tanish Physio!</h2>
                    <p>Your account has been created successfully by an administrator.</p>
                    <p><strong>Login Credentials:</strong></p>
                    <p><strong>Email:</strong> ${email}</p>
                    <p><strong>Password:</strong> ${tempPassword}</p>
                    <p style="color: #e53e3e; font-weight: bold;">⚠️ Important: Please change your password after first login for security.</p>
                    ${processedSubscriptionInfo ? `<p><strong>Assigned Plan:</strong> ${processedSubscriptionInfo.planName}</p>` : ''}
                    ${assignedServices.length > 0 ? `<p><strong>Assigned Services:</strong> ${assignedServices.length} service(s)</p>` : ''}
                    <p>Thank you for choosing Tanish Physio & Fitness!</p>
                `;
            } else {

            }

            await sendEmail({
                to: email,
                subject: 'Welcome to Tanish Physio - Account Created',
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Welcome to Tanish Physio</title>
                    </head>
                    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                            <h1 style="margin: 0; font-size: 28px;">Welcome to Tanish Physio!</h1>
                            <p style="margin: 10px 0 0; font-size: 16px; opacity: 0.9;">Your Health & Wellness Journey Starts Here</p>
                        </div>
                        
                        <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
                            ${emailContent}
                            
                            <div style="margin-top: 30px; padding: 20px; background-color: #f9fafb; border-radius: 8px; border-left: 4px solid #4f46e5;">
                                <h3 style="margin-top: 0; color: #4f46e5;">Next Steps:</h3>
                                <ul style="padding-left: 20px;">
                                    <li>Login to your account using the credentials above</li>
                                    <li>Complete your profile information</li>
                                    <li>Explore our services and book your first session</li>
                                    <li>Start your recovery journey with our expert therapists</li>
                                </ul>
                            </div>
                            
                            <div style="margin-top: 25px; text-align: center; color: #6b7280; font-size: 14px;">
                                <p>Need help? Contact our support team at <a href="mailto:support@tanishphysio.com" style="color: #4f46e5;">support@tanishphysio.com</a></p>
                                <p style="margin-top: 15px;">© 2024 Tanish Physio & Fitness. All rights reserved.</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `
            });
            
            console.log(`📧 Welcome email sent to ${email}`);
        } catch (emailError) {
            console.error('Email sending failed:', emailError);
            // Don't fail the user creation if email fails
        }

        res.status(201).json(ApiResponse.success(userResponse, 'User created successfully'));
    } catch (error) {
        next(error);
    }
};

// Delete user by ID (admin only)
const deleteUser = async (req, res, next) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) {
            return res.status(404).json(ApiResponse.error('User not found'));
        }

        res.status(200).json(ApiResponse.success(null, 'User deleted successfully'));
    } catch (error) {
        next(error);
    }
};

// Get current user profile
const getUserProfile = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.userId).select('-password');
        if (!user) {
            return res.status(404).json(ApiResponse.error('User not found'));
        }

        // Get user's subscription information
        const subscription = await Subscription.findOne({ userId: req.user.userId }).sort({ createdAt: -1 });
        user._doc.subscriptionInfo = subscription ? {
            planName: subscription.planName,
            planId: subscription.planId,
            status: subscription.status,
            startDate: subscription.startDate,
            endDate: subscription.endDate,
            amount: subscription.amount,
            isExpired: subscription.checkExpirationStatus ? subscription.checkExpirationStatus().isExpired : (subscription.endDate ? new Date(subscription.endDate) < new Date() : false),
            daysUntilExpiry: subscription.checkExpirationStatus ? subscription.checkExpirationStatus().daysRemaining : null
        } : null;

        res.status(200).json(ApiResponse.success(user, 'Profile retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Update current user profile
const updateUserProfile = async (req, res, next) => {
    try {
        const { name, phone, healthProfile } = req.body;

        const user = await User.findByIdAndUpdate(
            req.user.userId,
            { name, phone, healthProfile },
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json(ApiResponse.error('User not found'));
        }

        // Get user's subscription information
        const subscription = await Subscription.findOne({ userId: req.user.userId }).sort({ createdAt: -1 });
        user._doc.subscriptionInfo = subscription ? {
            planName: subscription.planName,
            planId: subscription.planId,
            status: subscription.status,
            startDate: subscription.startDate,
            endDate: subscription.endDate,
            amount: subscription.amount,
            isExpired: subscription.checkExpirationStatus ? subscription.checkExpirationStatus().isExpired : (subscription.endDate ? new Date(subscription.endDate) < new Date() : false),
            daysUntilExpiry: subscription.checkExpirationStatus ? subscription.checkExpirationStatus().daysRemaining : null
        } : null;

        res.status(200).json(ApiResponse.success(user, 'Profile updated successfully'));
    } catch (error) {
        next(error);
    }
};

// Check if user exists by email (for guest booking flow)
const checkUserExists = async (req, res, next) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json(ApiResponse.error('Email is required'));
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json(ApiResponse.error('Invalid email format'));
        }
        
        // Check if user exists
        const user = await User.findOne({ email }).select('-password');
        
        if (user) {
            // User exists - return user info and token for auto-login
            const token = generateToken({ 
                userId: user._id.toString(), 
                role: user.role 
            });
            
            return res.status(200).json(ApiResponse.success({
                exists: true,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    role: user.role
                },
                token
            }, 'User exists'));
        } else {
            // User doesn't exist
            return res.status(200).json(ApiResponse.success({
                exists: false
            }, 'User does not exist'));
        }
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAllUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
    getUserProfile,
    updateUserProfile,
    checkUserExists
};
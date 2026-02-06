const User = require('../models/User.model');
const Booking = require('../models/Booking.model');
const Subscription = require('../models/Subscription.model');
const ApiResponse = require('../utils/apiResponse');

// Get all users (admin only)
const getAllUsers = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const filter = { role: 'patient' }; // Only return patient users, not admins
        if (req.query.search) {
            filter.$or = [
                { name: { $regex: req.query.search, $options: 'i' } },
                { email: { $regex: req.query.search, $options: 'i' } }
            ];
        }

        if (req.query.status) {
            filter.status = req.query.status;
        }
        
        // Handle subscription filter
        if (req.query.subscription) {
            // This will be handled separately after fetching users since subscription data is in a different collection
        }

        const users = await User.find(filter)
            .select('-password')
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        // First, get all users based on initial filter
        const allFilteredUsers = await User.find(filter)
            .select('-password')
            .sort({ createdAt: -1 });

        // Apply subscription filtering if requested
        let filteredUsers = allFilteredUsers;
        if (req.query.subscription) {
            filteredUsers = [];
            for (let user of allFilteredUsers) {
                const subscription = await Subscription.findOne({ userId: user._id }).sort({ createdAt: -1 });
                
                if (req.query.subscription === 'active') {
                    // Filter for users who have an active subscription
                    if (subscription && ['active', 'paid'].includes(subscription.status)) {
                        filteredUsers.push(user);
                    }
                } else if (req.query.subscription === 'none') {
                    // Filter for users who have no subscription
                    if (!subscription) {
                        filteredUsers.push(user);
                    }
                }
            }
        }

        // Apply pagination to the filtered users
        const paginatedUsers = filteredUsers.slice(skip, skip + limit);

        // Now populate the service and subscription information for the paginated users
        const resultUsers = [];
        for (let user of paginatedUsers) {
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

        // Count total users that match all criteria (for pagination)
        let total;
        if (req.query.subscription) {
            // Need to count all users matching the subscription criteria
            const allUsersWithSubFilter = [];
            for (let user of allFilteredUsers) {
                const subscription = await Subscription.findOne({ userId: user._id }).sort({ createdAt: -1 });
                
                if (req.query.subscription === 'active') {
                    if (subscription && ['active', 'paid'].includes(subscription.status)) {
                        allUsersWithSubFilter.push(user);
                    }
                } else if (req.query.subscription === 'none') {
                    if (!subscription) {
                        allUsersWithSubFilter.push(user);
                    }
                }
            }
            total = allUsersWithSubFilter.length;
        } else {
            total = await User.countDocuments(filter);
        }

        res.status(200).json(
            ApiResponse.success({
                users: resultUsers,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
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

module.exports = {
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser,
    getUserProfile,
    updateUserProfile
};
const User = require('../models/User.model');
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

        const users = await User.find(filter)
            .select('-password')
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        // Convert profile picture paths to full URLs
        users.forEach(user => {
            if (user.profilePicture && user.profilePicture.startsWith('/uploads/')) {
                const baseUrl = `${req.protocol}://${req.get('host')}`;
                user.profilePicture = `${baseUrl}${user.profilePicture}`;
            }
        });

        const total = await User.countDocuments(filter);

        res.status(200).json(
            ApiResponse.success({
                users,
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
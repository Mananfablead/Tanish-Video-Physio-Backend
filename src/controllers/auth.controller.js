const User = require('../models/User.model');
const { generateToken } = require('../config/jwt');
const { hashPassword, comparePassword } = require('../utils/auth.utils');
const ApiResponse = require('../utils/apiResponse');

// Register a new user
const register = async (req, res, next) => {
    try {
        const { name, email, password, phone } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json(ApiResponse.error('User already exists with this email'));
        }

        // Hash password
        const hashedPassword = await hashPassword(password);

        // Create new user
        const user = new User({
            name,
            email,
            password, // 👈 use hashed password
            phone
            // role will default to 'patient' as per schema
        });


        await user.save();

        // Generate token
        const token = generateToken({ userId: user._id, role: user.role });

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

        const { email, password } = req.body;

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res
                .status(401)
                .json(ApiResponse.error("Invalid email or password", 401));
        }


        // Check if password is properly hashed
        if (!user.password || typeof user.password !== 'string' || user.password.length < 10) {
            return res
                .status(401)
                .json(ApiResponse.error("Invalid email or password", 401));
        }

        const isMatch = await comparePassword(password, user.password);

        if (!isMatch) {
            return res
                .status(401)
                .json(ApiResponse.error("Invalid email or password", 401));
        }

        // Generate token
        const token = generateToken({
            userId: user._id,
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

// Get user profile
const getProfile = async (req, res, next) => {
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

// Update user profile
const updateProfile = async (req, res, next) => {
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

// Create admin user (accessible by existing admins, or anyone when no admin exists yet)
const createAdminUser = async (req, res, next) => {
    try {
        // Check if any admin already exists
        const adminExists = await User.exists({ role: 'admin' });

        // Only allow if the requesting user is an admin, or if no admin exists yet
        if (adminExists && req.user.role !== 'admin') {
            return res.status(403).json(ApiResponse.error('Access denied. Admin privileges required.', 403));
        }

        const { name, email, password, phone } = req.body;

        // Validate required fields
        if (!name || !email || !password) {
            return res.status(400).json(ApiResponse.error('Name, email, and password are required.'));
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json(ApiResponse.error('User already exists with this email'));
        }

        // Hash password
        const hashedPassword = await hashPassword(password);

        // Create new admin user
        const user = new User({
            name,
            email,
            password: hashedPassword,
            phone,
            role: 'admin' // Explicitly set role to admin
        });

        await user.save();

        res.status(201).json(
            ApiResponse.success({
                user: {
                    id: user._id,
                    email: user.email,
                    name: user.name,
                    role: user.role
                }
            }, 'Admin user created successfully')
        );
    } catch (error) {
        next(error);
    }
};

module.exports = {
    register,
    login,
    logout,
    getProfile,
    updateProfile,
    createAdminUser
};
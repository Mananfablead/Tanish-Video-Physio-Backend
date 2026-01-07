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
            password, // 👈 plain password
            phone
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
// const login = async (req, res, next) => {
//     try {
//         const { email, password } = req.body;

//         // Find user by email
//         const user = await User.findOne({ email });
//         if (!user) {
//             return res.status(401).json(ApiResponse.error('Invalid email or password', 401));
//         }

//         // Compare password
//         const isMatch = await comparePassword(password, user.password);
//         if (!isMatch) {
//             return res.status(401).json(ApiResponse.error('Invalid email or password', 401));
//         }

//         // Generate token
//         const token = generateToken({ userId: user._id, role: user.role });

//         res.status(200).json(
//             ApiResponse.success({
//                 token,
//                 user: {
//                     id: user._id,
//                     email: user.email,
//                     name: user.name,
//                     role: user.role
//                 }
//             }, 'Login successful')
//         );
//     } catch (error) {
//         next(error);
//     }
// };

// Login user
const login = async (req, res, next) => {
    try {
        console.log("🔐 Login attempt start");

        const { email, password } = req.body;
        console.log("📩 Login request received for email:", email);

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            console.warn("❌ Login failed: User not found:", email);
            return res
                .status(401)
                .json(ApiResponse.error("Invalid email or password", 401));
        }

        console.log("✅ User found:", {
            id: user._id.toString(),
            role: user.role,
        });

        // Check if password is properly hashed
        if (!user.password || typeof user.password !== 'string' || user.password.length < 10) {
            console.error('❌ Password validation failed - password might not be properly hashed:', user.password);
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

module.exports = {
    register,
    login,
    logout,
    getProfile,
    updateProfile
};
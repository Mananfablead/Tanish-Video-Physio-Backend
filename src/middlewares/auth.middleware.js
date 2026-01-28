const { verifyToken } = require('../config/jwt');
const User = require('../models/User.model');
const ApiResponse = require('../utils/apiResponse');

// Middleware to authenticate token
const authenticateToken = async (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json(ApiResponse.error('Access token required'));
        }

        // Verify token
        const decoded = verifyToken(token);

        // Check if user exists
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json(ApiResponse.error('User not found'));
        }

        // Attach user info to request
        req.user = {
            userId: decoded.userId,
            role: decoded.role
        };

        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(403).json(ApiResponse.error('Invalid or expired token'));
        }
        next(error);
    }
};

// Middleware to authorize roles
const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json(ApiResponse.error('Authentication required'));
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json(ApiResponse.error('Insufficient permissions'));
        }

        next();
    };
};

// Middleware to authorize admin only
const authorizeAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json(ApiResponse.error('Authentication required'));
    }

    if (req.user.role !== 'admin') {
        return res.status(403).json(ApiResponse.error('Admin access required'));
    }

    next();
};

module.exports = {
    authenticateToken,
    authorizeRoles,
    authorizeAdmin
};
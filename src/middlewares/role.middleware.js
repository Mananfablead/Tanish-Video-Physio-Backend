const User = require('../models/User.model');
const ApiResponse = require('../utils/apiResponse');

// Middleware to check user role
const checkRole = (requiredRole) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json(ApiResponse.error('Authentication required'));
            }

            // Check if user's role matches required role
            if (req.user.role !== requiredRole) {
                return res.status(403).json(ApiResponse.error('Insufficient permissions'));
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};

// Middleware to check if user is admin
const isAdmin = checkRole('admin');

// Middleware to check if user is patient
const isPatient = checkRole('patient');

// Middleware to check if user is therapist
const isTherapist = checkRole('admin'); // Therapists are now managed by admin users

module.exports = {
    checkRole,
    isAdmin,
    isPatient,
    isTherapist
};
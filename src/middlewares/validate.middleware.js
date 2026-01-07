const { body, validationResult } = require('express-validator');
const ApiResponse = require('../utils/apiResponse');

// Validation middleware
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json(
            ApiResponse.error(errors.array().map(error => error.msg).join(', '))
        );
    }
    next();
};

// Validation rules for user registration
const validateRegister = [
    body('name')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Name must be between 2 and 50 characters'),
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long'),
    body('phone')
        .optional()
        .isMobilePhone(['en-IN'])
        .withMessage('Please provide a valid Indian phone number'),
    validate
];

// Validation rules for user login
const validateLogin = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email'),
    body('password')
        .exists()
        .withMessage('Password is required'),
    validate
];

// Validation rules for creating a booking
const validateBooking = [
    body('serviceId')
        .isMongoId()
        .withMessage('Service ID must be a valid MongoDB ObjectId'),
    body('therapistId')
        .isMongoId()
        .withMessage('Therapist ID must be a valid MongoDB ObjectId'),
    body('date')
        .isISO8601()
        .withMessage('Date must be in ISO 8601 format'),
    body('time')
        .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
        .withMessage('Time must be in HH:MM format'),
    body('notes')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Notes must not exceed 500 characters'),
    validate
];

// Validation rules for updating user profile
const validateUpdateProfile = [
    body('name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Name must be between 2 and 50 characters'),
    body('phone')
        .optional()
        .isMobilePhone(['en-IN'])
        .withMessage('Please provide a valid Indian phone number'),
    validate
];

module.exports = {
    validateRegister,
    validateLogin,
    validateBooking,
    validateUpdateProfile
};
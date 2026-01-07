const ApiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');

// Error handling middleware
const errorHandler = (err, req, res, next) => {
    // Log the error
    logger.error(err);

    // Set default error status
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';

    // Handle specific error types
    if (err.name === 'ValidationError') {
        // Mongoose validation error
        statusCode = 400;
        message = Object.values(err.errors).map(error => error.message).join(', ');
    } else if (err.name === 'CastError') {
        // Mongoose cast error (invalid ObjectId)
        statusCode = 400;
        message = 'Invalid data format';
    } else if (err.code === 11000) {
        // MongoDB duplicate key error
        statusCode = 400;
        message = 'Duplicate field value entered';
    }

    res.status(statusCode).json(
        ApiResponse.error(message, statusCode)
    );
};

module.exports = errorHandler;
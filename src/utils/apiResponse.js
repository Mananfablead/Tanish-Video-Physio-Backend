// Success response
const success = (data, message = 'Success', statusCode = 200) => {
    return {
        success: true,
        message,
        data,
        statusCode
    };
};

// Error response
const error = (message, statusCode = 400, error = null) => {
    return {
        success: false,
        message,
        error,
        statusCode
    };
};

// Not found response
const notFound = (message = 'Resource not found') => {
    return {
        success: false,
        message,
        statusCode: 404
    };
};

// Unauthorized response
const unauthorized = (message = 'Unauthorized') => {
    return {
        success: false,
        message,
        statusCode: 401
    };
};

// Forbidden response
const forbidden = (message = 'Forbidden') => {
    return {
        success: false,
        message,
        statusCode: 403
    };
};

module.exports = {
    success,
    error,
    notFound,
    unauthorized,
    forbidden
};
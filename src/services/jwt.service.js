const jwt = require('jsonwebtoken');
const config = require('../config/env');

// Generate JWT token
const generateToken = (payload, expiresIn = config.JWT_EXPIRE) => {
    return jwt.sign(payload, config.JWT_SECRET, {
        expiresIn: expiresIn,
    });
};

// Verify JWT token
const verifyToken = (token) => {
    return jwt.verify(token, config.JWT_SECRET);
};

// Refresh token (generate a new token with the same payload)
const refreshTokens = (token) => {
    try {
        const decoded = verifyToken(token);
        // Generate a new token with the same payload
        const newToken = generateToken({ userId: decoded.userId, role: decoded.role });
        return newToken;
    } catch (error) {
        throw new Error('Invalid token');
    }
};

module.exports = {
    generateToken,
    verifyToken,
    refreshTokens
};
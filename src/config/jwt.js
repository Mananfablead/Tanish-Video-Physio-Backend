const jwt = require('jsonwebtoken');
const config = require('./env');

const generateToken = (payload) => {
    return jwt.sign(payload, config.JWT_SECRET, {
        expiresIn: config.JWT_EXPIRE,
    });
};

const verifyToken = (token) => {
    return jwt.verify(token, config.JWT_SECRET);
};

module.exports = {
    generateToken,
    verifyToken,
};
// Load environment variables
require('dotenv').config();

// Log environment variables for debugging (remove sensitive data)
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('RAZORPAY_KEY_ID exists:', !!process.env.RAZORPAY_KEY_ID);
console.log('RAZORPAY_KEY_SECRET exists:', !!process.env.RAZORPAY_KEY_SECRET);

const config = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: process.env.PORT || 5000,
    BASE_URL: process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`,
    mongodb_uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/tanish-physio',
    JWT_SECRET: process.env.JWT_SECRET || 'your_jwt_secret_here',
    JWT_EXPIRE: process.env.JWT_EXPIRE || '24h',
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || 'your_razorpay_key_id_here',
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || 'your_razorpay_key_secret_here',
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:8000', 'http://localhost:8081'],
    EMAIL_HOST: process.env.EMAIL_HOST,
    EMAIL_PORT: process.env.EMAIL_PORT,
    EMAIL_USER: process.env.EMAIL_USER,
    EMAIL_PASS: process.env.EMAIL_PASS,
};

// Validate required environment variables
const requiredEnvVars = ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'];
const missingEnvVars = requiredEnvVars.filter(envVar => !config[envVar]);

if (missingEnvVars.length > 0) {
    console.warn('Warning: Missing required environment variables:', missingEnvVars);
    console.warn('Payment functionality will be disabled until these are set.');
}

module.exports = config;
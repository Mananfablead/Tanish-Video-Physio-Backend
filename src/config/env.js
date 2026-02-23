// Load environment variables
// Note: Email, WhatsApp, and Razorpay credentials are now managed via database (credentialsManager.js)
require('dotenv').config();
const path = require('path');

const config = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: process.env.PORT || 5000,
    BASE_URL: process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`,
    UPLOAD_PATH: process.env.UPLOAD_PATH || path.join(__dirname, '..', 'public', 'uploads'),
    mongodb_uri: process.env.MONGODB_URI || 'mongodb+srv://mananfablead_db_user:sgwePKwn0j1gt4eY@cluster0.pmssk5e.mongodb.net/tanish_physio_live?retryWrites=true&w=majority',
    JWT_SECRET: process.env.JWT_SECRET || 'your_jwt_secret_here',
    JWT_EXPIRE: process.env.JWT_EXPIRE || '24h',
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:8000', 'http://localhost:8081', 'https://tanishvideo.fableadtech.in', 'https://tanishvideo.fableadtech.in/', 'https://apitanishvideo.fableadtech.in', 'https://apitanishvideo.fableadtech.in/'],
    
};

// Note: Razorpay validation is now handled via credentialsManager.js
// Validate required environment variables
// const requiredEnvVars = ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'];
// const missingEnvVars = requiredEnvVars.filter(envVar => !config[envVar]);

// if (missingEnvVars.length > 0) {
//     console.warn('Warning: Missing required environment variables:', missingEnvVars);
//     console.warn('Payment functionality will be disabled until these are set.');
// }

module.exports = config;
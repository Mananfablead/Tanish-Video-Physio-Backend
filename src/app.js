const express = require('express');
const path = require('path');
const multer = require('multer');
const app = express();

// Import all middleware
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');

// Import configuration
const config = require('./config/env');

// Security middleware
app.use(helmet());
app.use(cors({
    origin: config.ALLOWED_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));

// Logging
if (config.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Body parsing middleware (MUST come before CSRF)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));

// CSRF is now handled in server.js - removed from app.js to avoid conflicts

// Handle CSRF errors globally
app.use((err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
        console.error('CSRF token validation failed:', err.message);
        return res.status(403).json({
            success: false,
            message: 'Invalid or missing CSRF token'
        });
    }
    // Handle other errors
    if (err) {
        console.error('Server error:', err);
    }
    next(err);
});

module.exports = app;
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
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Logging
if (config.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure upload directory
const uploadDir = path.join(__dirname, '..', 'uploads');

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Create directory if it doesn't exist
        const dir = path.join(uploadDir, 'recordings');
        require('fs').mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        // Generate unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Make upload middleware available globally or export it for use in routes
app.locals.upload = upload;

module.exports = app;
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { validationResult } = require('express-validator');

// Create directory if it doesn't exist
function createDirIfNotExists(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

// Set up storage for recording-related files (videos only)
const recordingStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Store all recording files in the same directory
        const dir = 'public/uploads/recording-videos/';
        createDirIfNotExists(dir);
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        // Create a unique filename using timestamp and original name
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'recording-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter to allow only video files for recordings
const fileFilter = (req, file, cb) => {
    // Allow only video files
    if (file.mimetype.startsWith('video/')) {
        cb(null, true);
    } else {
        cb(new Error('Only video files are allowed for recordings!'), false);
    }
};

// Multer upload instance for recordings
const recordingUpload = multer({
    storage: recordingStorage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit for recordings to accommodate videos
    }
});

// Validation middleware for recording uploads
const validateRecordingUpload = [
    (req, res, next) => {
        // Check if callLogId is provided
        if (!req.body.callLogId && !req.query.callLogId && !req.params.callLogId) {
            return res.status(400).json({
                success: false,
                message: 'callLogId is required for recording upload'
            });
        }

        // Check if file is provided
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Recording file is required'
            });
        }

        // Validate file size (in case limit wasn't caught by multer)
        if (req.file.size > 100 * 1024 * 1024) { // 100MB
            return res.status(400).json({
                success: false,
                message: 'File size exceeds 100MB limit'
            });
        }

        // Validate file type
        if (!req.file.mimetype.startsWith('video/')) {
            return res.status(400).json({
                success: false,
                message: 'Invalid file type. Only video files are allowed for recordings.'
            });
        }

        next();
    }
];

// Middleware to check if recording exists
const checkRecordingExists = (req, res, next) => {
    const recordingId = req.params.id || req.body.recordingId;

    if (!recordingId) {
        return res.status(400).json({
            success: false,
            message: 'Recording ID is required'
        });
    }

    // You can add additional checks here to verify the recording exists in the database
    // For now, we'll just pass through
    next();
};

// Middleware to validate recording metadata
const validateRecordingMetadata = (req, res, next) => {
    const { callLogId } = req.body;

    if (!callLogId) {
        return res.status(400).json({
            success: false,
            message: 'callLogId is required for recording metadata'
        });
    }

    // Validate callLogId format (assuming MongoDB ObjectId format)
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    if (!objectIdRegex.test(callLogId)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid callLogId format'
        });
    }

    next();
};

// Middleware to sanitize recording data
const sanitizeRecordingData = (req, res, next) => {
    // Sanitize and validate request body
    if (req.body && typeof req.body === 'object') {
        // Remove any potentially dangerous fields
        delete req.body.__proto__;
        delete req.body.constructor;

        // Ensure only allowed fields are processed
        const allowedFields = ['callLogId', 'duration', 'size', 'format', 'metadata'];
        const sanitizedBody = {};

        for (const field of allowedFields) {
            if (req.body.hasOwnProperty(field)) {
                sanitizedBody[field] = req.body[field];
            }
        }

        req.body = sanitizedBody;
    }

    next();
};

module.exports = {
    recordingUpload,
    validateRecordingUpload,
    checkRecordingExists,
    validateRecordingMetadata,
    sanitizeRecordingData
};
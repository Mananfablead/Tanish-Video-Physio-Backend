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

// Set up storage for recording-related files (videos)
const recordingVideoStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Store recording videos in the video directory
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

// Set up storage for recording-related images
const recordingImageStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Store recording images in the image directory
        const dir = 'public/uploads/recording-images/';
        createDirIfNotExists(dir);
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        // Create a unique filename using timestamp and original name
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'recording-image-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Combined file filter for recordings (both videos and images)
const recordingFileFilter = (req, file, cb) => {
    // Allow video and image files for recordings
    if (file.mimetype.startsWith('video/') || file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only video and image files are allowed for recordings!'), false);
    }
};

// Multer upload instances for recordings
const recordingUpload = multer({
    storage: recordingVideoStorage, // Use video storage as default for recordings
    fileFilter: recordingFileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB
    }
});

const recordingImageUpload = multer({
    storage: recordingImageStorage,
    fileFilter: recordingFileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB
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

        // Validate file size based on file type
        const isVideo = req.file.mimetype.startsWith('video/');
        const maxSize = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024; // 100MB for videos, 10MB for images

        if (req.file.size > maxSize) {
            return res.status(400).json({
                success: false,
                message: isVideo ? 'Video file size exceeds 100MB limit' : 'Image file size exceeds 10MB limit'
            });
        }

        // Validate file type
        if (!req.file.mimetype.startsWith('video/') && !req.file.mimetype.startsWith('image/')) {
            return res.status(400).json({
                success: false,
                message: 'Invalid file type. Only video and image files are allowed for recordings.'
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
    recordingImageUpload,
    validateRecordingUpload,
    checkRecordingExists,
    validateRecordingMetadata,
    sanitizeRecordingData
};
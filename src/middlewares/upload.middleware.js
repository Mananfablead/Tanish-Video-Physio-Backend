const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure storage for recordings
const recordingStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Create directory if it doesn't exist
        const dir = path.join(__dirname, '..', '..', 'uploads', 'recordings');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        // Generate unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'recording-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter to only allow video files
const fileFilter = (req, file, cb) => {
    // Accept video files
    if (file.mimetype.startsWith('video/') ||
        file.originalname.endsWith('.webm') ||
        file.originalname.endsWith('.mp4') ||
        file.originalname.endsWith('.mov') ||
        file.originalname.endsWith('.avi')) {
        cb(null, true);
    } else {
        cb(new Error('Only video files are allowed!'), false);
    }
};

// Create upload instances
const upload = multer({ 
    storage: recordingStorage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    }
});

module.exports = {
    uploadRecording: upload.single('recording'),
    recordingsUpload: upload.single('recording')
};
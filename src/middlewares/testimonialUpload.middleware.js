const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create directory if it doesn't exist
function createDirIfNotExists(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

// Set up storage for testimonial videos
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let dir;
        if (file.mimetype.startsWith('video/')) {
            dir = 'public/uploads/testimonial-videos/';
        } else {
            return cb(new Error('Unsupported file type'), false);
        }
        createDirIfNotExists(dir);
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        // Create a unique filename using timestamp and original name
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'testimonial-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter to allow video files
const fileFilter = (req, file, cb) => {
    // Allow video files
    if (file.mimetype.startsWith('video/')) {
        cb(null, true);
    } else {
        cb(new Error('Only video files are allowed for testimonials!'), false);
    }
};

// Multer upload instance for testimonials
const testimonialUpload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 200 * 1024 * 1024 // 200MB for videos
    }
});

module.exports = testimonialUpload;
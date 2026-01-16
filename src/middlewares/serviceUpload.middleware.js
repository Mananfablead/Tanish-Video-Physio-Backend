const multer = require('multer');
const path = require('path');

// Set up storage for service images and videos
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Store in different directories based on file type
        if (file.mimetype.startsWith('image/')) {
            cb(null, 'public/uploads/service-images/');
        } else if (file.mimetype.startsWith('video/')) {
            cb(null, 'public/uploads/service-videos/');
        } else {
            cb(new Error('Unsupported file type'), false);
        }
    },
    filename: function (req, file, cb) {
        // Create a unique filename using timestamp and original name
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'service-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter to allow both images and videos
const fileFilter = (req, file, cb) => {
    // Allow both image and video files
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image and video files are allowed!'), false);
    }
};

// Create multer instance with storage and file filter
const serviceUpload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024 // Limit file size to 50MB to accommodate videos
    }
});

module.exports = serviceUpload;
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create directory if it doesn't exist
function createDirIfNotExists(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

// Set up storage for service images and videos
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Store in different directories based on file type
        let dest;
        if (file.mimetype.startsWith('image/')) {
            dest = 'public/uploads/service-images/';
        } else if (file.mimetype.startsWith('video/')) {
            dest = 'public/uploads/service-videos/';
        } else {
            cb(new Error('Unsupported file type'), false);
            return;
        }

        // Create directory if it doesn't exist
        createDirIfNotExists(dest);
        cb(null, dest);
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
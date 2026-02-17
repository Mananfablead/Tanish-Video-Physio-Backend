const multer = require('multer');
const path = require('path');
const fs = require('fs');

// File filter to allow images and videos
const fileFilter = (req, file, cb) => {
    // Accept image files
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    }
    // Accept video files
    else if (file.mimetype.startsWith('video/')) {
        cb(null, true);
    }
    // Accept common video file extensions
    else if (
        file.originalname.endsWith('.mp4') ||
        file.originalname.endsWith('.mov') ||
        file.originalname.endsWith('.avi') ||
        file.originalname.endsWith('.wmv') ||
        file.originalname.endsWith('.flv') ||
        file.originalname.endsWith('.webm') ||
        file.originalname.endsWith('.mkv')
    ) {
        cb(null, true);
    }
    // Accept common image file extensions
    else if (
        file.originalname.endsWith('.jpg') ||
        file.originalname.endsWith('.jpeg') ||
        file.originalname.endsWith('.png') ||
        file.originalname.endsWith('.gif') ||
        file.originalname.endsWith('.bmp') ||
        file.originalname.endsWith('.webp')
    ) {
        cb(null, true);
    }
    else {
        cb(new Error('Only image and video files are allowed!'), false);
    }
};

// Create upload instance for chat attachments
const upload = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            const dir = path.join(__dirname, '..', 'public', 'uploads', 'chat');
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            cb(null, dir);
        },
        filename: function (req, file, cb) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, 'chat-' + uniqueSuffix + path.extname(file.originalname));
        }
    }),
    fileFilter: fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit for chat attachments
    }
});

module.exports = {
    chatUpload: upload.single('file')
};
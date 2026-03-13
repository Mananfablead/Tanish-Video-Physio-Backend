const multer = require('multer');
const path = require('path');
const fs = require('fs');

// File filter to allow images, videos, and documents
const fileFilter = (req, file, cb) => {
    // Accept image files
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    }
    // Accept video files
    else if (file.mimetype.startsWith('video/')) {
        cb(null, true);
    }
        // Accept common document file types
    else if (
        file.mimetype === 'application/pdf' ||
        file.mimetype === 'application/msword' ||
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.mimetype === 'application/vnd.ms-excel' ||
        file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-powerpoint' ||
        file.mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
        file.mimetype === 'text/plain' ||
        file.mimetype === 'text/csv'
    ) {
        cb(null, true);
    }
    // Accept common file extensions
    else if (
        // Video extensions
        file.originalname.endsWith('.mp4') ||
        file.originalname.endsWith('.mov') ||
        file.originalname.endsWith('.avi') ||
        file.originalname.endsWith('.wmv') ||
        file.originalname.endsWith('.flv') ||
        file.originalname.endsWith('.webm') ||
        file.originalname.endsWith('.mkv') ||
        // Image extensions
        file.originalname.endsWith('.jpg') ||
        file.originalname.endsWith('.jpeg') ||
        file.originalname.endsWith('.png') ||
        file.originalname.endsWith('.gif') ||
        file.originalname.endsWith('.bmp') ||
        file.originalname.endsWith('.webp') ||
        // Document extensions
        file.originalname.endsWith('.pdf') ||
        file.originalname.endsWith('.doc') ||
        file.originalname.endsWith('.docx') ||
        file.originalname.endsWith('.xls') ||
        file.originalname.endsWith('.xlsx') ||
        file.originalname.endsWith('.ppt') ||
        file.originalname.endsWith('.pptx') ||
        file.originalname.endsWith('.txt') ||
        file.originalname.endsWith('.csv')
    ) {
        cb(null, true);
    }
    else {
        cb(new Error('This file type is not supported. Supported types: images, videos, and documents (PDF, Word, Excel, PowerPoint, TXT, CSV).'), false);
    }
};

// Create upload instance for chat attachments
const upload = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            const dir = path.join(__dirname, '..', '..', 'public', 'uploads', 'chat');
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            cb(null, dir);
        },
        filename: function (req, file, cb) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const filename = 'chat-' + uniqueSuffix + path.extname(file.originalname);
            console.log('📝 Generated filename:', filename);
            console.log('📝 Original name:', file.originalname);
            console.log('📝 Extension:', path.extname(file.originalname));
            cb(null, filename);
        }
    }),
    fileFilter: fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit for chat attachments
    }
});

// Add error handling middleware
const handleUploadError = (err, req, res, next) => {
    console.error('❌ Multer error:', err);
    if (err instanceof multer.MulterError) {
        console.error('❌ Multer specific error:', err.code);
        return res.status(400).json({
            success: false,
            message: `Multer error: ${err.message}`
        });
    } else if (err) {
        console.error('❌ General upload error:', err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
    next();
};

module.exports = {
    chatUpload: upload.single('file'),
    handleUploadError
};
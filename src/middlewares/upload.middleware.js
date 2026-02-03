const multer = require('multer');
const path = require('path');
const fs = require('fs');

// File filter to only allow image files (for general uploads)
const fileFilter = (req, file, cb) => {
    // Accept image files
    if (file.mimetype.startsWith('image/') ||
        file.originalname.endsWith('.jpg') ||
        file.originalname.endsWith('.jpeg') ||
        file.originalname.endsWith('.png') ||
        file.originalname.endsWith('.gif') ||
        file.originalname.endsWith('.bmp')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

// Create upload instance for general purposes
const upload = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            const dir = path.join(__dirname, '..', 'public', 'uploads', 'general');
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            cb(null, dir);
        },
        filename: function (req, file, cb) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, 'upload-' + uniqueSuffix + path.extname(file.originalname));
        }
    }),
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

module.exports = {
    upload: upload.single('file'),
    uploadMultiple: upload.array('files', 5) // Up to 5 files
};
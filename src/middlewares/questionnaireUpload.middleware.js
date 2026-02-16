const multer = require('multer');
const path = require('path');
const fs = require('fs');

// File filter to allow both documents and images
const questionnaireFileFilter = (req, file, cb) => {
    // Allow images
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
        return;
    }
    
    // Allow documents
    const allowedDocTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ];
    
    // Allow by extension as well
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.jpg', '.jpeg', '.png', '.gif', '.bmp'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedDocTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Only document and image files are allowed (PDF, Word, Excel, PowerPoint, Images, etc.)'), false);
    }
};

// Create upload instance for questionnaire files
const questionnaireUpload = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            const dir = path.join(__dirname, '..', '..', 'public', 'uploads', 'questionnaire-responses');
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            cb(null, dir);
        },
        filename: function (req, file, cb) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
            cb(null, 'questionnaire-' + uniqueSuffix + path.extname(sanitizedFilename));
        }
    }),
    fileFilter: questionnaireFileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB
    }
});

module.exports = {
    questionnaireUpload: questionnaireUpload.single('file')
};

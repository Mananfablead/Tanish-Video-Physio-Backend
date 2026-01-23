const multer = require('multer');
const path = require('path');

// Set up storage for profile pictures and certifications
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        if (file.fieldname === 'profilePicture') {
            cb(null, 'public/uploads/profile-pictures/');
        } else if (file.fieldname === 'certifications') {
            cb(null, 'public/uploads/certifications/');
        } else {
            cb(null, 'public/uploads/temp/');
        }
    },
    filename: function (req, file, cb) {
        // Create a unique filename using timestamp and original name
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fieldName = file.fieldname === 'certifications' ? 'cert-' : 'profile-';
        cb(null, fieldName + uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter to allow images and PDFs
const fileFilter = (req, file, cb) => {
    // Allow image files and PDFs
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(new Error('Only image files and PDF documents are allowed!'), false);
    }
};

// Create multer instance with storage and file filter
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // Limit file size to 10MB
    }
});

// Middleware to handle multiple file uploads
const profileUpload = upload.fields([
    { name: 'profilePicture', maxCount: 1 },
    { name: 'certifications', maxCount: 10 } // Allow up to 10 certification files
]);

module.exports = profileUpload;
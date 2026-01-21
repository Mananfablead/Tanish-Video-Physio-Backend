const multer = require('multer');
const path = require('path');

// Set up storage for CMS images
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Store in different directories based on the field name
        const fieldname = file.fieldname;
        
        if (fieldname === 'image') {
            // For general image fields like hero, about, etc.
            cb(null, 'public/uploads/cms-images/');
        } else if (fieldname.includes('conditions[') && fieldname.includes('].image')) {
            // For condition images
            cb(null, 'public/uploads/cms-condition-images/');
        } else if (fieldname === 'conditions.image') {
            // For condition images in some formats
            cb(null, 'public/uploads/cms-condition-images/');
        } else {
            // Default for other image fields
            cb(null, 'public/uploads/cms-images/');
        }
    },
    filename: function (req, file, cb) {
        // Create a unique filename using timestamp and original name
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'cms-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter to allow only images
const fileFilter = (req, file, cb) => {
    // Allow only image files
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

// Create multer instance with storage and file filter
const cmsUpload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // Limit file size to 10MB
    }
});

module.exports = cmsUpload;
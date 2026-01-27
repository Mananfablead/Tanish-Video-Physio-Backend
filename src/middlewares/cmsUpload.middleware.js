const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create directory if it doesn't exist
function createDirIfNotExists(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

// Set up storage for CMS images
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Store in different directories based on the field name
        const fieldname = file.fieldname;
        let dest;
        
        if (fieldname === 'image') {
            // For general image fields like hero, about, etc.
            dest = 'public/uploads/cms-images/';
        } else if (fieldname.includes('conditions[') && fieldname.includes('].image')) {
            // For condition images
            dest = 'public/uploads/cms-condition-images/';
        } else if (fieldname === 'conditions.image') {
            // For condition images in some formats
            dest = 'public/uploads/cms-condition-images/';
        } else if (fieldname.includes('condition') && fieldname.includes('.image')) {
            // For various condition image field formats
            dest = 'public/uploads/cms-condition-images/';
        } else {
            // Default for other image fields
            dest = 'public/uploads/cms-images/';
        }

        // Create directory if it doesn't exist
        createDirIfNotExists(dest);
        cb(null, dest);
    },
    filename: function (req, file, cb) {
        // Create a unique filename using timestamp and original name
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname).toLowerCase();
        // Ensure we have a proper extension, fallback to .jpg if unknown
        const finalExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif'].includes(ext) ? ext : '.jpg';
        cb(null, 'cms-' + uniqueSuffix + finalExt);
    }
});

// File filter to allow only images including AVIF
const fileFilter = (req, file, cb) => {
    // Allow common image file types including AVIF
    const allowedTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml',
        'image/avif'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Invalid file type: ${file.mimetype}. Only image files are allowed!`), false);
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
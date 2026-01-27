const fs = require('fs');
const path = require('path');

/**
 * Creates upload directories if they don't exist
 */
const initUploadDirectories = () => {
    const uploadDirs = [
        'public/uploads/profile-pictures/',
        'public/uploads/certifications/',
        'public/uploads/temp/',
        'public/uploads/cms-images/',
        'public/uploads/cms-condition-images/',
        'public/uploads/service-images/',
        'public/uploads/service-videos/'
    ];

    uploadDirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`Created directory: ${dir}`);
        }
    });
};

module.exports = initUploadDirectories;
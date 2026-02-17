const path = require('path');
const config = require('../config/env');

// Controller for handling chat file uploads
const uploadFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        // Determine file type based on mimetype
        let fileType = 'document'; // default
        if (req.file.mimetype.startsWith('image/')) {
            fileType = 'image';
        } else if (req.file.mimetype.startsWith('video/')) {
            fileType = 'video';
        }

        const baseUrl = config.BASE_URL || `http://${req.headers.host}`;
        const fileUrl = `${baseUrl}/uploads/chat/${req.file.filename}`;

        const fileData = {
            type: fileType,
            url: fileUrl,
            originalName: req.file.originalname,
            size: req.file.size,
            mimeType: req.file.mimetype
        };

        res.status(200).json({
            success: true,
            message: 'File uploaded successfully',
            data: {
                file: fileData,
                filename: req.file.filename
            }
        });
    } catch (error) {
        console.error('Error uploading chat file:', error);
        res.status(500).json({
            success: false,
            message: 'Error uploading file',
            error: error.message
        });
    }
};

module.exports = {
    uploadFile
};
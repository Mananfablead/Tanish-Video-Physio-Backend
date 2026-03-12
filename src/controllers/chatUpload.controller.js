const path = require('path');
const config = require('../config/env');

// Controller for handling chat file uploads
const uploadFile = async (req, res) => {
    try {
        console.log('📂 Upload request received');
        console.log('📂 Request file:', req.file);
        console.log('📂 File exists:', !!req.file);

        if (!req.file) {
            console.error('❌ No file in request');
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        console.log('✅ File received:', req.file.originalname);
        console.log('✅ File path:', req.file.path);
        console.log('✅ File size:', req.file.size);
        console.log('✅ File mimetype:', req.file.mimetype);

        // Determine file type based on mimetype
        let fileType = 'document'; // default
        if (req.file.mimetype.startsWith('image/')) {
            fileType = 'image';
        } else if (req.file.mimetype.startsWith('video/')) {
            fileType = 'video';
        } else if (
            req.file.mimetype === 'application/pdf' ||
            req.file.mimetype === 'application/msword' ||
            req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            req.file.mimetype === 'application/vnd.ms-excel' ||
            req.file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            req.file.mimetype === 'application/vnd.ms-powerpoint' ||
            req.file.mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
            req.file.mimetype === 'text/plain' ||
            req.file.mimetype === 'text/csv'
        ) {
            fileType = 'document';
        }


        const baseUrl = config.BASE_URL || `http://${req.headers.host}`;
        const fileUrl = `${baseUrl}/uploads/chat/${req.file.filename}`;

        console.log('📎 Generated file URL:', fileUrl);

        const fileData = {
            type: fileType,
            url: fileUrl,
            originalName: req.file.originalname,
            size: req.file.size,
            mimeType: req.file.mimetype
        };

        console.log('✅ Upload successful, sending response');

        res.status(200).json({
            success: true,
            message: 'File uploaded successfully',
            data: {
                file: fileData,
                filename: req.file.filename
            }
        });
    } catch (error) {
        console.error('❌ Error uploading chat file:', error);
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
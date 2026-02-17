const express = require('express');
const { authenticateToken } = require('../middlewares/auth.middleware');
const { chatUpload } = require('../middlewares/chatUpload.middleware');
const { uploadFile } = require('../controllers/chatUpload.controller');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Upload a file for chat
router.post('/upload-file', chatUpload, uploadFile);

module.exports = router;
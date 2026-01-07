const express = require('express');
const { getChatMessages, sendMessage } = require('../controllers/chat.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/:sessionId', authenticateToken, getChatMessages);
router.post('/:sessionId', authenticateToken, sendMessage);

module.exports = router;
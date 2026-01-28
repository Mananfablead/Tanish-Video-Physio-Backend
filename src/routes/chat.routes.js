const express = require('express');
const { getChatMessages, sendMessage } = require('../controllers/chat.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Join a chat room
router.post('/join', (req, res) => {
    // This would typically be handled via socket.io
    // For REST API, we just return success
    res.json({ message: 'Joined chat room successfully' });
});

// Leave a chat room
router.post('/leave', (req, res) => {
    // This would typically be handled via socket.io
    // For REST API, we just return success
    res.json({ message: 'Left chat room successfully' });
});

// Send a chat message
router.post('/send', sendMessage);

// Get chat messages for a session
router.get('/:sessionId', getChatMessages);

// Typing indicator
router.post('/typing', (req, res) => {
    // This would typically be handled via socket.io
    // For REST API, we just return success
    res.json({ message: 'Typing indicator sent' });
});

// Stop typing indicator
router.post('/stop-typing', (req, res) => {
    // This would typically be handled via socket.io
    // For REST API, we just return success
    res.json({ message: 'Stop typing indicator sent' });
});

module.exports = router;
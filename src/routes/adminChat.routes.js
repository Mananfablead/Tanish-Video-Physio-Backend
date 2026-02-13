const express = require('express');
const {
    getAdminChatMessages,
    sendAdminReply,
    getUnreadMessagesCount,
    markMessagesAsRead,
    getActiveChats,
    getChatStats,
    getAdminOnlineStatus
} = require('../controllers/adminChat.controller');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth.middleware');

const router = express.Router();

// All routes require authentication and admin role
router.use(authenticateToken);
router.use(authorizeRoles('admin'));

// Get all chat messages for admin view
router.get('/', getAdminChatMessages);

// Get chat messages for a specific user
router.get('/user/:userId', getAdminChatMessages);

// Get unread messages count
router.get('/unread-count', getUnreadMessagesCount);

// Mark messages as read
router.put('/mark-read', markMessagesAsRead);

// Send admin reply
router.post('/reply', sendAdminReply);

// Get active chats (chats with unread messages)
router.get('/active-chats', getActiveChats);

// Get chat statistics
router.get('/stats', getChatStats);

// Get admin online status
router.get('/admin-status', getAdminOnlineStatus);

module.exports = router;
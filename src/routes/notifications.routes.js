const express = require('express');
const {
    getAllNotifications,
    getAdminNotifications,
    sendNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications
} = require('../controllers/notifications.controller');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth.middleware');

const router = express.Router();

// Get notifications for authenticated user (client/therapist/admin)
router.get('/', authenticateToken, getAllNotifications);

// Get admin-specific notifications (admin only)
router.get('/admin', authenticateToken, authorizeRoles('admin'), getAdminNotifications);

// Send notification (admin only)
router.post('/', authenticateToken, authorizeRoles('admin'), sendNotification);

// Mark single notification as read
router.put('/:id/read', authenticateToken, markAsRead);

// Mark all notifications as read
router.put('/read-all', authenticateToken, markAllAsRead);

// Delete single notification (authenticated users can delete their own)
router.delete('/:id', authenticateToken, deleteNotification);

// Delete all notifications (admin only)
router.delete('/', authenticateToken, authorizeRoles('admin'), deleteAllNotifications);

module.exports = router;
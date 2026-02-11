const express = require('express');
const { getAllNotifications, sendNotification, markAsRead, deleteNotification, deleteAllNotifications } = require('../controllers/notifications.controller');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', authenticateToken, getAllNotifications);
router.post('/', authenticateToken, authorizeRoles('admin'), sendNotification);
router.put('/:id/read', authenticateToken, markAsRead);
router.delete('/:id', authenticateToken, authorizeRoles('admin'), deleteNotification);
router.delete('/', authenticateToken, authorizeRoles('admin'), deleteAllNotifications);

module.exports = router;
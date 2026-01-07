const express = require('express');
const { getAllNotifications, sendNotification, markAsRead } = require('../controllers/notifications.controller');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', authenticateToken, getAllNotifications);
router.post('/', authenticateToken, authorizeRoles('admin'), sendNotification);
router.put('/:id/read', authenticateToken, markAsRead);

module.exports = router;
const express = require('express');
const { getUserReport, getSessionReport, getRevenueReport, getTherapistReport, getAdminDashboard } = require('../controllers/reports.controller');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/users', authenticateToken, authorizeRoles('admin'), getUserReport);
router.get('/sessions', authenticateToken, authorizeRoles('admin'), getSessionReport);
router.get('/revenue', authenticateToken, authorizeRoles('admin'), getRevenueReport);
router.get('/therapists', authenticateToken, authorizeRoles('admin'), getTherapistReport);
router.get('/admin/dashboard', authenticateToken, authorizeRoles('admin'), getAdminDashboard);

module.exports = router;
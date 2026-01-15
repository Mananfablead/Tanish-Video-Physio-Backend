const express = require('express');
const { getAllServices, getServiceById, createService, updateService, deleteService, getAllServicesAdmin, getServiceByIdAdmin } = require('../controllers/services.controller');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth.middleware');

const router = express.Router();

// Public routes
router.get('/', getAllServices);
router.get('/:id', getServiceById);

// admin only
router.get('/admin/all', authenticateToken, authorizeRoles('admin'), getAllServicesAdmin);
router.get('/admin/:id', authenticateToken, authorizeRoles('admin'), getServiceByIdAdmin);
router.post('/', authenticateToken, authorizeRoles('admin'), createService);
router.put('/:id', authenticateToken, authorizeRoles('admin'), updateService);
router.delete('/:id', authenticateToken, authorizeRoles('admin'), deleteService);

module.exports = router;
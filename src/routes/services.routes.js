const express = require('express');
const { getAllServices, getServiceById, getServiceBySlug, getServiceBySlugAdmin, getAllServicesSlugAdmin, createService, updateService, deleteService, getAllServicesAdmin, getServiceByIdAdmin, removeMediaFromService } = require('../controllers/services.controller');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth.middleware');
const serviceUpload = require('../middlewares/serviceUpload.middleware');

const router = express.Router();

// Public routes
router.get('/', getAllServices);
router.get('/:id', getServiceById);
router.get('/slug/:slug', getServiceBySlug);

// admin only
router.get('/admin/all', authenticateToken, authorizeRoles('admin'), getAllServicesAdmin);
router.get('/admin/:id', authenticateToken, authorizeRoles('admin'), getServiceByIdAdmin);
router.get('/admin/slug/:slug', authenticateToken, authorizeRoles('admin'), getServiceBySlugAdmin);
router.post('/', authenticateToken, authorizeRoles('admin'), serviceUpload.fields([{ name: 'images', maxCount: 10 }, { name: 'videos', maxCount: 5 }]), createService);
router.put('/:id', authenticateToken, authorizeRoles('admin'), serviceUpload.fields([{ name: 'images', maxCount: 10 }, { name: 'videos', maxCount: 5 }]), updateService);
router.delete('/:id', authenticateToken, authorizeRoles('admin'), deleteService);

// Remove media from service
router.put('/:id/remove-media', authenticateToken, authorizeRoles('admin'), removeMediaFromService);

module.exports = router;
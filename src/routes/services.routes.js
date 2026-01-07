const express = require('express');
const { getAllServices, getServiceById, createService, updateService, deleteService } = require('../controllers/services.controller');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', getAllServices);
router.get('/:id', getServiceById);
router.post('/', authenticateToken, authorizeRoles('admin'), createService);
router.put('/:id', authenticateToken, authorizeRoles('admin'), updateService);
router.delete('/:id', authenticateToken, authorizeRoles('admin'), deleteService);

module.exports = router;
const express = require('express');
const { getAvailability, getAvailabilityByTherapist, createAvailability, updateAvailability, deleteAvailability, bulkUpdateAvailability } = require('../controllers/availability.controller');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', getAvailability);
router.get('/therapist/:therapistId', getAvailabilityByTherapist);
router.post('/', authenticateToken, authorizeRoles('admin'), createAvailability);
router.put('/:id', authenticateToken, authorizeRoles('admin'), updateAvailability);
router.delete('/:id', authenticateToken, authorizeRoles('admin'), deleteAvailability);
router.post('/bulk-update', authenticateToken, authorizeRoles('admin'), bulkUpdateAvailability);

module.exports = router;
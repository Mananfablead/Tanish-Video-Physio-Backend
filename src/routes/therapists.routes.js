const express = require('express');
const { getAllTherapists, getTherapistById, createTherapist, updateTherapist, deleteTherapist } = require('../controllers/therapists.controller');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', getAllTherapists);
router.get('/:id', getTherapistById);
router.post('/', authenticateToken, authorizeRoles('admin'), createTherapist);
router.put('/:id', authenticateToken, authorizeRoles('admin'), updateTherapist);
router.delete('/:id', authenticateToken, authorizeRoles('admin'), deleteTherapist);

module.exports = router;
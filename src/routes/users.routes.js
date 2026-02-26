const express = require('express');
const { getAllUsers, getUserById, createUser, updateUser, deleteUser, getUserProfile, updateUserProfile, checkUserExists } = require('../controllers/users.controller');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/', authenticateToken, authorizeRoles('admin'), createUser);
router.get('/', authenticateToken, authorizeRoles('admin'), getAllUsers);
router.get('/profile', authenticateToken, getUserProfile);
router.get('/:id', authenticateToken, getUserById);
router.put('/profile', authenticateToken, updateUserProfile);
router.put('/:id', authenticateToken, authorizeRoles('admin'), updateUser);
router.delete('/:id', authenticateToken, authorizeRoles('admin'), deleteUser);
router.post('/check-exists', checkUserExists); // Public endpoint to check if user exists

module.exports = router;
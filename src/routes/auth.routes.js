const express = require('express');
const { register, login, logout, getProfile, updateProfile, createAdminUser, forgotPassword, resetPassword, updatePassword } = require('../controllers/auth.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');
const { validateLogin } = require('../middlewares/validate.middleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', validateLogin, login);
router.post('/logout', authenticateToken, logout);
router.get('/profile', authenticateToken, getProfile);
router.put('/profile', authenticateToken, updateProfile);
router.post('/admin/create', createAdminUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);
router.put('/update-password', authenticateToken, updatePassword);

module.exports = router;
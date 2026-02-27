const express = require('express');
const { register, login, logout, validateToken, getProfile, getPublicProfile, getAllAdminProfiles, updateProfile, createAdminUser, forgotPassword, resetPassword, updatePassword, refreshToken } = require('../controllers/auth.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');
const { validateLogin } = require('../middlewares/validate.middleware');
const { detectAppType } = require('../middlewares/appType.middleware');
const upload = require('../middlewares/upload.middleware');
const profileUpload = require('../middlewares/profileUpload.middleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', detectAppType, validateLogin, login);
router.post('/logout', authenticateToken, logout);
router.post('/validate-token', authenticateToken, validateToken);
router.get('/profile', authenticateToken, getProfile);
router.get('/profile/:userId', getPublicProfile); // Public profile endpoint for individual admin access
router.get('/admins/public', getAllAdminProfiles); // Public endpoint to get all admin profiles
router.put('/profile', authenticateToken, profileUpload, updateProfile);
router.post('/admin/create', createAdminUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);
router.put('/update-password', authenticateToken, updatePassword);
router.post('/refresh-token', refreshToken);

module.exports = router;
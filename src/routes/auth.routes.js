const express = require('express');
const { register, login, logout, getProfile, updateProfile, createAdminUser } = require('../controllers/auth.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');
const { validateLogin } = require('../middlewares/validate.middleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', validateLogin, login);
router.post('/logout', authenticateToken, logout);
router.get('/profile', authenticateToken, getProfile);
router.put('/profile', authenticateToken, updateProfile);
// Route for creating first admin (no auth required if no admin exists)
router.post('/admin/create-first', createAdminUser);

// Route for creating additional admins (auth required if admin exists)
router.post('/admin/create-user', authenticateToken, createAdminUser);

module.exports = router;
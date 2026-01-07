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
router.post('/admin/create-first', createAdminUser);

module.exports = router;
const express = require('express');
const { getAllSessions, getSessionById, getUpcomingSessions, createSession, updateSession, deleteSession } = require('../controllers/sessions.controller');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', authenticateToken, getAllSessions);
router.get('/upcoming', authenticateToken, getUpcomingSessions);
router.get('/:id', authenticateToken, getSessionById);
router.post('/', authenticateToken, createSession);
router.put('/:id', authenticateToken, updateSession);
router.delete('/:id', authenticateToken, deleteSession);

module.exports = router;
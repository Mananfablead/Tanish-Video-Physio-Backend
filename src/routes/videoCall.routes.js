const express = require('express');
const { authenticateToken } = require('../middlewares/auth.middleware');
const {
    createCallLog,
    getCallLogs,
    getCallLogById,
    updateCallLog,
    deleteCallLog,
    getSessionParticipants
} = require('../controllers/videoCall.controller');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Create a new call log
router.post('/', createCallLog);

// Get all call logs (admin only)
router.get('/', getCallLogs);

// Get call logs for current user
router.get('/my-calls', (req, res, next) => {
    req.query.userId = req.user.userId;
    next();
}, getCallLogs);

// Get call log by ID
router.get('/:id', getCallLogById);

// Update call log
router.put('/:id', updateCallLog);

// Delete call log (admin only)
router.delete('/:id', deleteCallLog);

// Get participants for a session
router.get('/session/:sessionId/participants', getSessionParticipants);

module.exports = router;
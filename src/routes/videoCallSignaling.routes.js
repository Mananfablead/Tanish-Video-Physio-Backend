const express = require('express');
const { authenticateToken, authorizeAdmin } = require('../middlewares/auth.middleware');
const {
    generateCallToken,
    verifyCallToken,
    getCallDetails,
    getCallHistory,
    reportCallIssue,
    getCallLogs,
    getCallQualityMetrics,
    getActiveCalls,
    forceEndCall,
    muteParticipant,
    getSessionParticipants
} = require('../controllers/videoCallSignaling.controller');

const router = express.Router();

// Public route for token verification (no auth required)
router.post('/verify-join-link', verifyCallToken);

// All other routes require authentication
router.use(authenticateToken);

// User routes
router.post('/generate-join-link', generateCallToken);
router.get('/info/:sessionId', getCallDetails);
router.get('/history', getCallHistory);
router.post('/report-issue', reportCallIssue);

// Admin routes
router.get('/logs', authorizeAdmin, getCallLogs);
router.get('/logs/:sessionId/metrics', authorizeAdmin, getCallQualityMetrics);
router.get('/active', authorizeAdmin, getActiveCalls);
router.post('/force-end', authorizeAdmin, forceEndCall);
router.post('/mute-participant', authorizeAdmin, muteParticipant);

// Get participants for a session
router.get('/session/:sessionId/participants', getSessionParticipants);

module.exports = router;
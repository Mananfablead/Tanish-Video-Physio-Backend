const express = require('express');
const { authenticateToken, authorizeAdmin } = require('../middlewares/auth.middleware');
const { recordingUpload, validateRecordingUpload } = require('../middlewares/recording.middleware');
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
    getSessionParticipants,
    startRecording,
    stopRecording,
    uploadRecording,
    getUserRecordings,
    getAllRecordings,
    getRecordingById
} = require('../controllers/videoCallSignaling.controller');

const {
    createCallLog,
    getCallLogById,
    updateCallLog,
    deleteCallLog
} = require('../controllers/videoCallSignaling.controller');

const router = express.Router();

// Public route for token verification (no auth required)
router.post('/verify-join-link', verifyCallToken);

// All other routes require authentication
router.use(authenticateToken);


// Get all call logs (admin only)
router.get('/', getCallLogs);

// Create a new call log
router.post('/logs', createCallLog);

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

// Recording routes
router.post('/recording/start', startRecording);
router.post('/recording/stop', stopRecording);
router.post('/recording/upload', recordingUpload.single('recording'), validateRecordingUpload, uploadRecording);
router.get('/recordings/user', getUserRecordings);
router.get('/recordings', getAllRecordings);
router.get('/recordings/:id', getRecordingById);

module.exports = router;
const express = require('express');
const { authenticateToken, authorizeAdmin } = require('../middlewares/auth.middleware');
const { recordingUpload, recordingImageUpload, validateRecordingUpload } = require('../middlewares/recording.middleware');
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
    uploadRecordingImage,
    getUserRecordings,
    getAllRecordings,
    getRecordingById,
    getRecordingUsers
} = require('../controllers/videoCallSignaling.controller');

const {
    createCallLog,
    getCallLogById,
    updateCallLog,
    deleteCallLog,
    generateGoogleMeetLink,
    updateGoogleMeetLink
} = require('../controllers/videoCallSignaling.controller');

const router = express.Router();

// Public route for token verification (no auth required)
router.post('/verify-join-link', verifyCallToken);

// All other routes require authentication
router.use(authenticateToken);

// Specific routes should be defined before generic ones

// Recording routes (must be before /:id route)
router.post('/recording/start', startRecording);
router.post('/recording/stop', stopRecording);
router.post('/recording/upload', recordingUpload.single('recording-videos'), validateRecordingUpload, uploadRecording);
router.post('/recording/image', recordingImageUpload.single('recordingImage'), validateRecordingUpload, uploadRecordingImage);
router.get('/recordings/user', getUserRecordings);
router.get('/recordings', getAllRecordings);
router.get('/recordings/:id', getRecordingById);
router.get('/recordings/:id/users', getRecordingUsers);

// User routes
router.post('/generate-join-link', generateCallToken);
router.get('/info/:sessionId', getCallDetails);
router.get('/history', getCallHistory);
router.post('/report-issue', reportCallIssue);

// Generate Google Meet link for session
router.post('/generate-google-meet', generateGoogleMeetLink);

// Update Google Meet link for session (Admin only)
router.put('/update-google-meet/:sessionId', authorizeAdmin, updateGoogleMeetLink);

// Get participants for a session
router.get('/session/:sessionId/participants', getSessionParticipants);

// Admin routes
router.get('/logs', authorizeAdmin, getCallLogs);
router.get('/logs/:sessionId/metrics', authorizeAdmin, getCallQualityMetrics);
router.get('/active', authorizeAdmin, getActiveCalls);
router.post('/force-end', authorizeAdmin, forceEndCall);
router.post('/mute-participant', authorizeAdmin, muteParticipant);

// Generic routes (these should be last)

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

module.exports = router;
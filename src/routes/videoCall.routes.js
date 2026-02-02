const express = require('express');
const { authenticateToken } = require('../middlewares/auth.middleware');
const {
    createCallLog,
    getCallLogs,
    getCallLogById,
    updateCallLog,
    deleteCallLog,
    getSessionParticipants,
    startRecording,
    stopRecording,
    uploadRecording,
    getUserRecordings,
    getAllRecordings,
    getRecordingById
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

// Recording routes
router.post('/recording/start', startRecording);
router.post('/recording/stop', stopRecording);
router.post('/recording/upload', (req, res, next) => {
    // Dynamically require multer here to access the app configuration
    const multer = require('multer');
    const path = require('path');

    const storage = multer.diskStorage({
        destination: function (req, file, cb) {
            // Create directory if it doesn't exist
            const dir = path.join(__dirname, '..', '..', 'uploads', 'recordings');
            require('fs').mkdirSync(dir, { recursive: true });
            cb(null, dir);
        },
        filename: function (req, file, cb) {
            // Generate unique filename
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
        }
    });

    const upload = multer({ storage: storage });
    upload.single('recording')(req, res, next);
}, uploadRecording);
router.get('/recordings/user', getUserRecordings);
router.get('/recordings', getAllRecordings);
router.get('/recordings/:id', getRecordingById);

module.exports = router;
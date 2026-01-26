const express = require('express');
const {
    // User functions
    getUserSessions,
    getUserUpcomingSessions,
    getSessionById,
    createSession,
    updateSession,
    deleteSession,
    rescheduleUserSession,
    // Admin functions
    getAllSessions,
    getAllUpcomingSessions,
    getAdminSessionById,
    createAdminSession,
    updateAdminSession,
    deleteAdminSession,
    rescheduleAdminSession,
    // Session approval functions
    acceptSession,
    rejectSession
} = require('../controllers/sessions.controller');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth.middleware');

const router = express.Router();

// User routes (accessible by regular users for their own data)
router.get('/', authenticateToken, getUserSessions);
router.get('/upcoming', authenticateToken, getUserUpcomingSessions);

// Admin routes (accessible by admin and therapist roles)
router.get('/all', authenticateToken, authorizeRoles('admin', 'therapist'), getAllSessions);
router.get('/all/upcoming', authenticateToken, authorizeRoles('admin', 'therapist'), getAllUpcomingSessions);

// Individual session routes - separate user and admin versions
router.get('/:id', authenticateToken, getSessionById); // User can access their own session
router.get('/admin/:id', authenticateToken, authorizeRoles('admin', 'therapist'), getAdminSessionById); // Admin can access any session

// User can create their own session
router.post('/', authenticateToken, createSession);

// Admin can create sessions for any user
router.post('/admin', authenticateToken, authorizeRoles('admin', 'therapist'), createAdminSession);

// User can update their own session
router.put('/:id', authenticateToken, updateSession);

// Admin can update any session
router.put('/admin/:id', authenticateToken, authorizeRoles('admin', 'therapist'), updateAdminSession);

// User can reschedule their own session
router.put('/:id/reschedule', authenticateToken, rescheduleUserSession);

// Admin can reschedule any session
router.put('/admin/:id/reschedule', authenticateToken, authorizeRoles('admin', 'therapist'), rescheduleAdminSession);

// User can delete their own session
router.delete('/:id', authenticateToken, deleteSession);

// Admin can delete any session
router.delete('/admin/:id', authenticateToken, authorizeRoles('admin', 'therapist'), deleteAdminSession);

// Admin session approval routes
router.put('/accept/:id', authenticateToken, authorizeRoles('admin', 'therapist'), acceptSession);
router.put('/reject/:id', authenticateToken, authorizeRoles('admin', 'therapist'), rejectSession);

module.exports = router;
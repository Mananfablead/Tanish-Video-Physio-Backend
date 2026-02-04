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
const { requirePatientRole, requireAdminRole } = require('../middlewares/role.middleware');

const router = express.Router();

// User routes (accessible by regular users for their own data)
router.get('/', authenticateToken, requirePatientRole, getUserSessions);
router.get('/upcoming', authenticateToken, requirePatientRole, getUserUpcomingSessions);

// Admin routes (accessible by admin and therapist roles)
router.get('/all', authenticateToken, requireAdminRole, getAllSessions);
router.get('/all/upcoming', authenticateToken, requireAdminRole, getAllUpcomingSessions);

// Individual session routes - separate user and admin versions
router.get('/:id', authenticateToken, getSessionById); // User can access their own session
router.get('/admin/:id', authenticateToken, authorizeRoles('admin', 'therapist'), getAdminSessionById); // Admin can access any session

// User can create their own session
router.post('/', authenticateToken, requirePatientRole, createSession);

// Admin can create sessions for any user
router.post('/admin', authenticateToken, authorizeRoles('admin', 'therapist'), createAdminSession);

// User can update their own session
router.put('/:id', authenticateToken, requirePatientRole, updateSession);

// Admin can update any session
router.put('/admin/:id', authenticateToken, authorizeRoles('admin', 'therapist'), updateAdminSession);

// User can reschedule their own session
router.put('/:id/reschedule', authenticateToken, requirePatientRole, rescheduleUserSession);

// Admin can reschedule any session
router.put('/admin/:id/reschedule', authenticateToken, authorizeRoles('admin', 'therapist'), rescheduleAdminSession);

// User can delete their own session
router.delete('/:id', authenticateToken, requirePatientRole, deleteSession);

// Admin can delete any session
router.delete('/admin/:id', authenticateToken, authorizeRoles('admin', 'therapist'), deleteAdminSession);

// Admin session approval routes
router.put('/accept/:id', authenticateToken, authorizeRoles('admin', 'therapist'), acceptSession);
router.put('/reject/:id', authenticateToken, authorizeRoles('admin', 'therapist'), rejectSession);

module.exports = router;
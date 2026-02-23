const express = require('express');
const { getAllBookings, getBookingById, createBooking, createGuestBooking, updateBooking, updateBookingStatus, updateGuestBookingStatus, deleteBooking, getBookingsByStatus, getAllBookingsForAdmin, getBookingDetails, checkSlotAvailability, updateBookingWithSchedule, createBookingWithSubscription, checkSubscriptionBookingEligibility } = require('../controllers/bookings.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');
const { requirePatientRole, requireAdminRole } = require('../middlewares/role.middleware');

const router = express.Router();

router.get('/', authenticateToken, requirePatientRole, getAllBookings);
router.get('/admin/all', authenticateToken, getAllBookingsForAdmin);
router.get('/status/:status', authenticateToken, requirePatientRole, getBookingsByStatus);
router.get('/:id', authenticateToken, getBookingById);
router.post('/', authenticateToken, requirePatientRole, createBooking);
// Public route for guest bookings
router.post('/guest', createGuestBooking);
router.put('/:id', authenticateToken, updateBooking);
router.put('/:id/status', authenticateToken, updateBookingStatus);
// Public route for guest users to update booking status
router.put('/guest-status/:id', updateGuestBookingStatus);
router.delete('/:id', authenticateToken, deleteBooking);
// Unified route for booking details (works for both guest and authenticated users)
router.post('/details/:id', getBookingDetails);

// Routes for scheduling functionality
router.post('/check-slot-availability', checkSlotAvailability);
router.put('/:id/schedule', authenticateToken, updateBookingWithSchedule);

// Route for subscription-based bookings
router.post('/subscription', authenticateToken, createBookingWithSubscription);

// Route to check subscription booking eligibility
router.get('/subscription/eligibility', authenticateToken, checkSubscriptionBookingEligibility);

module.exports = router;
const express = require('express');
const { getAllBookings, getBookingById, createBooking, createGuestBooking, updateBooking, updateBookingStatus, updateGuestBookingStatus, deleteBooking, getBookingsByStatus, getAllBookingsForAdmin } = require('../controllers/bookings.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', authenticateToken, getAllBookings);
router.get('/admin/all', authenticateToken, getAllBookingsForAdmin);
router.get('/status/:status', authenticateToken, getBookingsByStatus);
router.get('/:id', authenticateToken, getBookingById);
router.post('/', authenticateToken, createBooking);
// Public route for guest bookings
router.post('/guest', createGuestBooking);
router.put('/:id', authenticateToken, updateBooking);
router.put('/:id/status', authenticateToken, updateBookingStatus);
// Public route for guest users to update booking status
router.put('/:id/guest-status', updateGuestBookingStatus);
router.delete('/:id', authenticateToken, deleteBooking);

module.exports = router;
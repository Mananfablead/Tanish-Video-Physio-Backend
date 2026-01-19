const express = require('express');
const { getAllBookings, getBookingById, createBooking, createGuestBooking, updateBooking, updateBookingStatus, deleteBooking, getBookingsByStatus } = require('../controllers/bookings.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', authenticateToken, getAllBookings);
router.get('/status/:status', authenticateToken, getBookingsByStatus);
router.get('/:id', authenticateToken, getBookingById);
router.post('/', authenticateToken, createBooking);
// Public route for guest bookings
router.post('/guest', createGuestBooking);
router.put('/:id', authenticateToken, updateBooking);
router.put('/:id/status', authenticateToken, updateBookingStatus);
router.delete('/:id', authenticateToken, deleteBooking);

module.exports = router;
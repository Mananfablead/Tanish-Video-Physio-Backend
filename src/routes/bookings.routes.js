const express = require('express');
const { getAllBookings, getBookingById, createBooking, updateBooking, deleteBooking } = require('../controllers/bookings.controller');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', authenticateToken, getAllBookings);
router.get('/:id', authenticateToken, getBookingById);
router.post('/', authenticateToken, createBooking);
router.put('/:id', authenticateToken, updateBooking);
router.delete('/:id', authenticateToken, deleteBooking);

module.exports = router;
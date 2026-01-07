const Booking = require('../models/Booking.model');
const Service = require('../models/Service.model');
const Therapist = require('../models/Therapist.model');
const ApiResponse = require('../utils/apiResponse');

// Get all bookings for authenticated user
const getAllBookings = async (req, res, next) => {
    try {
        const bookings = await Booking.find({ userId: req.user.userId })
            .populate('serviceId', 'name price duration')
            .populate('therapistId', 'name specialty rating');

        res.status(200).json(ApiResponse.success({ bookings }, 'Bookings retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Get booking by ID
const getBookingById = async (req, res, next) => {
    try {
        const booking = await Booking.findOne({ _id: req.params.id, userId: req.user.userId })
            .populate('serviceId', 'name price duration')
            .populate('therapistId', 'name specialty rating');

        if (!booking) {
            return res.status(404).json(ApiResponse.error('Booking not found'));
        }

        res.status(200).json(ApiResponse.success({ booking }, 'Booking retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Create a new booking
const createBooking = async (req, res, next) => {
    try {
        const { serviceId, therapistId, date, time, notes } = req.body;

        // Validate service and therapist exist
        const service = await Service.findById(serviceId);
        const therapist = await Therapist.findById(therapistId);

        if (!service || service.status !== 'active') {
            return res.status(404).json(ApiResponse.error('Service not found or not active'));
        }

        if (!therapist || therapist.status !== 'active') {
            return res.status(404).json(ApiResponse.error('Therapist not found or not active'));
        }

        // Check if booking already exists for this date/time
        const existingBooking = await Booking.findOne({
            therapistId,
            date,
            time,
            status: { $ne: 'cancelled' }
        });

        if (existingBooking) {
            return res.status(400).json(ApiResponse.error('Slot already booked'));
        }

        const booking = new Booking({
            serviceId,
            therapistId,
            userId: req.user.userId, // Assign current user
            date,
            time,
            notes
        });

        await booking.save();

        // Populate the response
        await booking.populate('serviceId', 'name price duration');
        await booking.populate('therapistId', 'name specialty rating');

        res.status(201).json(ApiResponse.success({ booking }, 'Booking created successfully'));
    } catch (error) {
        next(error);
    }
};

// Update booking by ID
const updateBooking = async (req, res, next) => {
    try {
        const { date, time, notes } = req.body;

        // Check if booking belongs to user
        const booking = await Booking.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.userId },
            { date, time, notes },
            { new: true, runValidators: true }
        )
            .populate('serviceId', 'name price duration')
            .populate('therapistId', 'name specialty rating');

        if (!booking) {
            return res.status(404).json(ApiResponse.error('Booking not found'));
        }

        res.status(200).json(ApiResponse.success({ booking }, 'Booking updated successfully'));
    } catch (error) {
        next(error);
    }
};

// Delete/cancel booking by ID
const deleteBooking = async (req, res, next) => {
    try {
        const booking = await Booking.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.userId },
            { status: 'cancelled' },
            { new: true }
        )
            .populate('serviceId', 'name price duration')
            .populate('therapistId', 'name specialty rating');

        if (!booking) {
            return res.status(404).json(ApiResponse.error('Booking not found'));
        }

        res.status(200).json(ApiResponse.success({ booking }, 'Booking cancelled successfully'));
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAllBookings,
    getBookingById,
    createBooking,
    updateBooking,
    deleteBooking
};
const Session = require('../models/Session.model');
const Booking = require('../models/Booking.model');
const ApiResponse = require('../utils/apiResponse');

// Get all sessions for authenticated user
const getAllSessions = async (req, res, next) => {
    try {
        const sessions = await Session.find({ userId: req.user.userId })
            .populate('bookingId', 'serviceName therapistName date time')
            .populate('therapistId', 'name specialty');

        res.status(200).json(ApiResponse.success({ sessions }, 'Sessions retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Get upcoming sessions for authenticated user
const getUpcomingSessions = async (req, res, next) => {
    try {
        const now = new Date();
        const sessions = await Session.find({
            userId: req.user.userId,
            date: { $gte: now },
            status: { $in: ['scheduled', 'live'] }
        })
            .populate('bookingId', 'serviceName therapistName date time')
            .populate('therapistId', 'name specialty');

        res.status(200).json(ApiResponse.success({ sessions }, 'Upcoming sessions retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Get session by ID
const getSessionById = async (req, res, next) => {
    try {
        const session = await Session.findOne({ _id: req.params.id, userId: req.user.userId })
            .populate('bookingId', 'serviceName therapistName date time')
            .populate('therapistId', 'name specialty');

        if (!session) {
            return res.status(404).json(ApiResponse.error('Session not found'));
        }

        res.status(200).json(ApiResponse.success({ session }, 'Session retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Create a new session
const createSession = async (req, res, next) => {
    try {
        const { bookingId, therapistId, date, time, type, status } = req.body;

        // Verify the booking belongs to the user
        const booking = await Booking.findOne({ _id: bookingId, userId: req.user.userId });
        if (!booking) {
            return res.status(404).json(ApiResponse.error('Booking not found'));
        }

        const session = new Session({
            bookingId,
            therapistId,
            userId: req.user.userId, // Assign current user
            date,
            time,
            type,
            status
        });

        await session.save();

        // Populate the response
        await session.populate('bookingId', 'serviceName therapistName date time');
        await session.populate('therapistId', 'name specialty');

        res.status(201).json(ApiResponse.success({ session }, 'Session created successfully'));
    } catch (error) {
        next(error);
    }
};

// Update session by ID
const updateSession = async (req, res, next) => {
    try {
        const { status, notes } = req.body;

        // Check if session belongs to user
        const session = await Session.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.userId },
            { status, notes },
            { new: true, runValidators: true }
        )
            .populate('bookingId', 'serviceName therapistName date time')
            .populate('therapistId', 'name specialty');

        if (!session) {
            return res.status(404).json(ApiResponse.error('Session not found'));
        }

        res.status(200).json(ApiResponse.success({ session }, 'Session updated successfully'));
    } catch (error) {
        next(error);
    }
};

// Delete session by ID
const deleteSession = async (req, res, next) => {
    try {
        const session = await Session.findOneAndDelete({ _id: req.params.id, userId: req.user.userId })
            .populate('bookingId', 'serviceName therapistName date time')
            .populate('therapistId', 'name specialty');

        if (!session) {
            return res.status(404).json(ApiResponse.error('Session not found'));
        }

        res.status(200).json(ApiResponse.success({ session }, 'Session deleted successfully'));
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAllSessions,
    getUpcomingSessions,
    getSessionById,
    createSession,
    updateSession,
    deleteSession
};
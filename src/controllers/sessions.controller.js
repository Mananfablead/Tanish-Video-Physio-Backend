const Session = require('../models/Session.model');
const Booking = require('../models/Booking.model');
const ApiResponse = require('../utils/apiResponse');

// Get all sessions for authenticated user
const getAllSessions = async (req, res, next) => {
    try {
        const sessions = await Session.find({ userId: req.user.userId })
            .populate('bookingId', 'serviceName therapistName date time')
            .populate('therapistId', 'name email role')

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
            .populate('therapistId', 'name email role')

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
            .populate('therapistId', 'name email role')

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
        const { bookingId, date, time, type, status } = req.body;

        // Verify the booking belongs to the user and has been paid
        const booking = await Booking.findOne({ _id: bookingId, userId: req.user.userId });
        if (!booking) {
            return res.status(404).json(ApiResponse.error('Booking not found'));
        }

        // Check if the booking has been paid
        if (booking.paymentStatus !== 'paid') {
            return res.status(400).json(ApiResponse.error('Cannot create session: Booking payment status is not paid'));
        }

        // Auto-generate startTime from date and time
        const startTime = new Date(`${date}T${time}:00`);

        // Generate a unique sessionId
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const session = new Session({
            bookingId,
            therapistId: booking.therapistId, // Use therapist from the booking
            userId: req.user.userId, // Assign current user
            sessionId, // Add the unique sessionId
            date,
            time,
            startTime, // Add the required startTime field
            type,
            status
        });

        await session.save();

        // Populate the response
        await session.populate('bookingId', 'serviceName therapistName date time');
        await session.populate('therapistId', 'name email role');

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
            .populate('therapistId', 'name email role')

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
            .populate('therapistId', 'name email role')

        if (!session) {
            return res.status(404).json(ApiResponse.error('Session not found'));
        }

        res.status(200).json(ApiResponse.success({ session }, 'Session deleted successfully'));
    } catch (error) {
        next(error);
    }
};

// Reschedule session
const rescheduleSession = async (req, res, next) => {
    try {
        const { date, time } = req.body;

        // Find the session and verify ownership
        const session = await Session.findOne({ _id: req.params.id, userId: req.user.userId });
        if (!session) {
            return res.status(404).json(ApiResponse.error('Session not found'));
        }

        // Check if session can be rescheduled (should not be live or completed)
        if (session.status === 'live' || session.status === 'completed') {
            return res.status(400).json(ApiResponse.error('Cannot reschedule live or completed session'));
        }

        // Auto-generate new startTime from date and time
        const startTime = new Date(`${date}T${time}:00`);

        // Update session with new date, time, and startTime
        const updatedSession = await Session.findByIdAndUpdate(
            req.params.id,
            {
                date,
                time,
                startTime,
                status: 'scheduled' // Reset status to scheduled
            },
            { new: true, runValidators: true }
        ).populate('bookingId', 'serviceName therapistName date time')
            .populate('therapistId', 'name email role');

        res.status(200).json(ApiResponse.success({ session: updatedSession }, 'Session rescheduled successfully'));
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
    deleteSession,
    rescheduleSession
};
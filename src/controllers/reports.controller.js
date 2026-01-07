const User = require('../models/User.model');
const Session = require('../models/Session.model');
const Booking = require('../models/Booking.model');
const Payment = require('../models/Payment.model');
const Therapist = require('../models/Therapist.model');
const ApiResponse = require('../utils/apiResponse');

// Get user reports
const getUserReport = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.query;

        const filters = {};
        if (startDate || endDate) {
            filters.createdAt = {};
            if (startDate) filters.createdAt.$gte = new Date(startDate);
            if (endDate) filters.createdAt.$lte = new Date(endDate);
        }

        const newUsers = await User.countDocuments(filters);
        const activeUsers = await User.countDocuments({ ...filters, status: 'active' });
        const inactiveUsers = await User.countDocuments({ ...filters, status: 'inactive' });

        // Calculate user growth rate (comparing with previous period)
        const now = new Date();
        const previousPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        const currentPeriodUsers = await User.countDocuments({
            createdAt: { $gte: new Date(now.getFullYear(), now.getMonth(), 1) }
        });
        const previousPeriodUsers = await User.countDocuments({
            createdAt: {
                $gte: previousPeriodStart,
                $lt: new Date(now.getFullYear(), now.getMonth(), 1)
            }
        });

        const userGrowthRate = previousPeriodUsers > 0
            ? ((currentPeriodUsers - previousPeriodUsers) / previousPeriodUsers) * 100
            : currentPeriodUsers > 0 ? 100 : 0;

        res.status(200).json(ApiResponse.success({
            report: {
                newUsers,
                activeUsers,
                inactiveUsers,
                userGrowthRate: parseFloat(userGrowthRate.toFixed(2))
            }
        }, 'User report retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Get session reports
const getSessionReport = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.query;

        const filters = {};
        if (startDate || endDate) {
            filters.createdAt = {};
            if (startDate) filters.createdAt.$gte = new Date(startDate);
            if (endDate) filters.createdAt.$lte = new Date(endDate);
        }

        const totalSessions = await Session.countDocuments(filters);
        const completedSessions = await Session.countDocuments({ ...filters, status: 'completed' });
        const cancelledSessions = await Session.countDocuments({ ...filters, status: 'cancelled' });

        const sessionCompletionRate = totalSessions > 0
            ? (completedSessions / totalSessions) * 100
            : 0;

        res.status(200).json(ApiResponse.success({
            report: {
                totalSessions,
                completedSessions,
                cancelledSessions,
                sessionCompletionRate: parseFloat(sessionCompletionRate.toFixed(2))
            }
        }, 'Session report retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Get revenue reports
const getRevenueReport = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.query;

        const filters = {};
        if (startDate || endDate) {
            filters.createdAt = {};
            if (startDate) filters.createdAt.$gte = new Date(startDate);
            if (endDate) filters.createdAt.$lte = new Date(endDate);
        }

        const payments = await Payment.find({ ...filters, status: 'paid' });
        const totalRevenue = payments.reduce((sum, payment) => sum + payment.amount, 0);

        // Calculate revenue from bookings and subscriptions separately
        const bookingPayments = payments.filter(payment => payment.bookingId);
        const subscriptionPayments = payments.filter(payment => payment.subscriptionId);

        const revenueFromBookings = bookingPayments.reduce((sum, payment) => sum + payment.amount, 0);
        const revenueFromSubscriptions = subscriptionPayments.reduce((sum, payment) => sum + payment.amount, 0);

        // Calculate revenue growth rate
        const now = new Date();
        const previousPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        const currentPeriodPayments = await Payment.find({
            createdAt: { $gte: new Date(now.getFullYear(), now.getMonth(), 1) },
            status: 'paid'
        });
        const currentPeriodRevenue = currentPeriodPayments.reduce((sum, payment) => sum + payment.amount, 0);

        const previousPeriodPayments = await Payment.find({
            createdAt: {
                $gte: previousPeriodStart,
                $lt: new Date(now.getFullYear(), now.getMonth(), 1)
            },
            status: 'paid'
        });
        const previousPeriodRevenue = previousPeriodPayments.reduce((sum, payment) => sum + payment.amount, 0);

        const revenueGrowthRate = previousPeriodRevenue > 0
            ? ((currentPeriodRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100
            : currentPeriodRevenue > 0 ? 100 : 0;

        res.status(200).json(ApiResponse.success({
            report: {
                totalRevenue,
                revenueFromBookings,
                revenueFromSubscriptions,
                revenueGrowthRate: parseFloat(revenueGrowthRate.toFixed(2))
            }
        }, 'Revenue report retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Get therapist reports
const getTherapistReport = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.query;

        const filters = {};
        if (startDate || endDate) {
            filters.createdAt = {};
            if (startDate) filters.createdAt.$gte = new Date(startDate);
            if (endDate) filters.createdAt.$lte = new Date(endDate);
        }

        // Get all therapists
        const therapists = await Therapist.find({ status: 'active' });

        // For each therapist, calculate their stats
        const therapistReports = await Promise.all(therapists.map(async (therapist) => {
            const sessions = await Session.find({
                therapistId: therapist._id,
                ...filters
            });

            const completedSessions = sessions.filter(session => session.status === 'completed').length;
            const totalSessions = sessions.length;

            // Calculate average rating (assuming we have a way to track ratings)
            // This is a simplified calculation - in a real app, you'd have actual ratings
            const averageRating = 4.5; // Placeholder - you'd calculate this from actual feedback

            const revenueGenerated = await Payment.aggregate([
                {
                    $match: {
                        bookingId: { $in: sessions.map(s => s.bookingId) },
                        status: 'paid'
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$amount' }
                    }
                }
            ]);

            return {
                therapistId: therapist._id,
                therapistName: therapist.name,
                totalSessions,
                completionRate: totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0,
                averageRating: parseFloat(averageRating.toFixed(2)),
                revenueGenerated: revenueGenerated[0] ? revenueGenerated[0].total : 0
            };
        }));

        res.status(200).json(ApiResponse.success(therapistReports, 'Therapist reports retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getUserReport,
    getSessionReport,
    getRevenueReport,
    getTherapistReport
};
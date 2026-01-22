const User = require('../models/User.model');
const Session = require('../models/Session.model');
const Booking = require('../models/Booking.model');
const Payment = require('../models/Payment.model');
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

        // Get all therapists (admin users)
        const therapists = await User.find({ role: 'admin', status: 'active' });

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

// Get admin dashboard data
const getAdminDashboard = async (req, res, next) => {
    try {
        // Get today's date for daily stats
        const today = new Date();
        const todayStart = new Date(today.setHours(0, 0, 0, 0));
        const todayEnd = new Date(today.setHours(23, 59, 59, 999));

        // Get user statistics
        const totalUsers = await User.countDocuments({ role: 'patient' });
        
        // Get subscription statistics
        const Subscription = require('../models/Subscription.model');
        const activeSubscriptions = await Subscription.countDocuments({ status: 'active' });

        // Get revenue statistics
        const payments = await Payment.find({ status: 'paid' });
        const totalRevenue = payments.reduce((sum, payment) => sum + payment.amount, 0);

        // Get upcoming sessions
        const upcomingSessions = await Session.countDocuments({ 
            status: { $in: ['scheduled', 'pending'] },
            startTime: { $gte: new Date() }
        });

        // Get completed sessions today
        const completedToday = await Session.countDocuments({ 
            status: 'completed',
            updatedAt: { $gte: todayStart, $lte: todayEnd }
        });

        // Get service statistics
        const Service = require('../models/Service.model');
        const totalServices = await Service.countDocuments({ status: 'active' });

        // Generate chart data (last 6 months)
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const currentMonth = new Date().getMonth();
        
        // Revenue chart data
        const revenueChart = [];
        for (let i = 5; i >= 0; i--) {
            const monthIndex = (currentMonth - i + 12) % 12;
            const year = new Date().getFullYear() - (currentMonth - i < 0 ? 1 : 0);
            
            const startDate = new Date(year, monthIndex, 1);
            const endDate = new Date(year, monthIndex + 1, 0);
            
            const monthPayments = await Payment.find({
                status: 'paid',
                createdAt: { $gte: startDate, $lte: endDate }
            });
            
            const revenue = monthPayments.reduce((sum, payment) => sum + payment.amount, 0);
            
            revenueChart.push({
                month: months[monthIndex],
                revenue
            });
        }

        // Sessions chart data (last 7 days)
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const sessionsChart = [];
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dayStart = new Date(date.setHours(0, 0, 0, 0));
            const dayEnd = new Date(date.setHours(23, 59, 59, 999));
            
            const completed = await Session.countDocuments({
                status: 'completed',
                updatedAt: { $gte: dayStart, $lte: dayEnd }
            });
            
            const cancelled = await Session.countDocuments({
                status: 'cancelled',
                updatedAt: { $gte: dayStart, $lte: dayEnd }
            });
            
            // For demo purposes, assuming some no-shows
            const noShow = Math.floor(completed * 0.05);
            
            sessionsChart.push({
                day: days[date.getDay()],
                completed,
                cancelled,
                noShow
            });
        }

        // User growth chart (last 6 months)
        const userGrowthChart = [];
        for (let i = 5; i >= 0; i--) {
            const monthIndex = (currentMonth - i + 12) % 12;
            const year = new Date().getFullYear() - (currentMonth - i < 0 ? 1 : 0);
            
            const startDate = new Date(year, monthIndex, 1);
            const endDate = new Date(year, monthIndex + 1, 0);
            
            const users = await User.countDocuments({
                role: 'patient',
                createdAt: { $gte: startDate, $lte: endDate }
            });
            
            // Get therapists created in this period (for comparison)
            const therapists = await User.countDocuments({
                role: 'admin',
                createdAt: { $gte: startDate, $lte: endDate }
            });
            
            userGrowthChart.push({
                month: months[monthIndex],
                users,
                therapists
            });
        }

        // Recent activity (mock data for demo)
        const recentActivity = [
            {
                type: 'session_complete',
                title: 'Session completed',
                description: 'Admin completed session with Rohit',
                time: '2 min ago'
            },
            {
                type: 'new_booking',
                title: 'New booking',
                description: 'Priya Sharma booked Back Pain Therapy',
                time: '15 min ago'
            },
            {
                type: 'payment_received',
                title: 'Payment received',
                description: '₹2500 received for Knee Rehabilitation',
                time: '1 hour ago'
            },
            {
                type: 'new_user',
                title: 'New user registered',
                description: 'Amit Patel joined the platform',
                time: '2 hours ago'
            }
        ];

        // Upcoming sessions (sample data)
        const upcomingSessionsData = [
            {
                _id: '69707303dc9e1df5e808c567',
                user: 'Rohit Kumar',
                therapist: 'Admin',
                time: '11:00 AM',
                type: '1-on-1',
                status: 'live'
            },
            {
                _id: '69707303dc9e1df5e808c568',
                user: 'Priya Sharma',
                therapist: 'Dr. Johnson',
                time: '2:30 PM',
                type: '1-on-1',
                status: 'upcoming'
            },
            {
                _id: '69707303dc9e1df5e808c569',
                user: 'Amit Patel',
                therapist: 'Dr. Smith',
                time: '4:00 PM',
                type: '1-on-1',
                status: 'upcoming'
            }
        ];

        res.status(200).json({
            success: true,
            data: {
                stats: {
                    totalUsers,
                    activeSubscriptions,
                    totalRevenue,
                    upcomingSessions,
                    completedToday,
                    avgRating: 4.8,
                    conversionRate: 68,
                    totalServices
                },
                revenueChart,
                sessionsChart,
                userGrowthChart,
                recentActivity,
                upcomingSessions: upcomingSessionsData
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getUserReport,
    getSessionReport,
    getRevenueReport,
    getTherapistReport,
    getAdminDashboard
};
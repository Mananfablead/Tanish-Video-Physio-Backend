// Reminder Service - Cron-based scheduling system
// Uses existing status fields and timestamps

const cron = require('node-cron');
const Booking = require('../models/Booking.model');
const Payment = require('../models/Payment.model');
const Session = require('../models/Session.model');
const NotificationService = require('./notificationService');
const BookingStatusHandler = require('./bookingStatusHandler');

class ReminderService {
    constructor() {
        this.cronJobs = new Map();
        this.isRunning = false;
    }

    // Initialize all reminder cron jobs
    initialize() {
        if (this.isRunning) {
            console.log('Reminder service already running');
            return;
        }

        console.log('Initializing reminder service...');

        // Payment reminder job - runs every hour
        this.schedulePaymentReminders();

        // Session reminder job - runs every 30 minutes
        this.scheduleSessionReminders();

        // Daily summary job - runs at 9 AM
        this.scheduleDailySummary();

        this.isRunning = true;
        console.log('Reminder service initialized successfully');
    }

    // Schedule payment reminders (every hour)
    schedulePaymentReminders() {
        const job = cron.schedule('0 * * * *', async () => {
            console.log('Running payment reminder job...');
            await this.processPaymentReminders();
        });

        this.cronJobs.set('paymentReminders', job);
    }

    // Schedule session reminders (every 30 minutes)
    scheduleSessionReminders() {
        const job = cron.schedule('*/30 * * * *', async () => {
            console.log('Running session reminder job...');
            await this.processSessionReminders();
        });

        this.cronJobs.set('sessionReminders', job);
    }

    // Schedule daily summary (9 AM daily)
    scheduleDailySummary() {
        const job = cron.schedule('0 9 * * *', async () => {
            console.log('Running daily summary job...');
            await this.processDailySummary();
        });

        this.cronJobs.set('dailySummary', job);
    }

    // Process payment reminders
    async processPaymentReminders() {
        try {
            // Find bookings with pending payments older than 24 hours
            const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

            const pendingBookings = await Booking.find({
                status: BookingStatusHandler.BOOKING_STATUS.PENDING,
                paymentStatus: BookingStatusHandler.PAYMENT_STATUS.PENDING,
                createdAt: { $lte: cutoffTime }
            }).populate('userId', 'name email phone');

            console.log(`Found ${pendingBookings.length} bookings for payment reminders`);

            for (const booking of pendingBookings) {
                try {
                    // Check if we should send reminder (based on last reminder sent)
                    const shouldSend = await this.shouldSendPaymentReminder(booking);

                    if (shouldSend) {
                        await this.sendPaymentReminder(booking);
                        await this.updateLastReminderSent(booking, 'payment');
                    }
                } catch (error) {
                    console.error(`Error processing payment reminder for booking ${booking._id}:`, error);
                }
            }
        } catch (error) {
            console.error('Error in payment reminder processing:', error);
        }
    }

    // Process session reminders
    async processSessionReminders() {
        try {
            console.log('Running session reminder job...');
            
            // Find upcoming sessions that need reminders
            const now = new Date();
            const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            const in1Hour = new Date(now.getTime() + 60 * 60 * 1000);
            
            // Find sessions that are starting within the next 24-25 hours (for 24-hour reminder)
            const sessionsFor24HourReminder = await Session.find({
                startTime: { 
                    $gte: in24Hours,
                    $lt: new Date(in24Hours.getTime() + 60 * 60 * 1000) // 1 hour window
                },
                status: { $in: ['scheduled', 'pending'] },
                last24HourReminderSent: { $exists: false }
            }).populate('userId', 'name email phone')
              .populate('therapistId', 'name email phone')
              .populate('bookingId');
            
            // Find sessions that are starting within the next 1-2 hours (for 1-hour reminder)
            const sessionsFor1HourReminder = await Session.find({
                startTime: { 
                    $gte: in1Hour,
                    $lt: new Date(in1Hour.getTime() + 60 * 60 * 1000) // 1 hour window
                },
                status: { $in: ['scheduled', 'pending'] },
                last1HourReminderSent: { $exists: false }
            }).populate('userId', 'name email phone')
              .populate('therapistId', 'name email phone')
              .populate('bookingId');
            
            console.log(`Found ${sessionsFor24HourReminder.length} sessions for 24-hour reminders`);
            console.log(`Found ${sessionsFor1HourReminder.length} sessions for 1-hour reminders`);
            
            // Send 24-hour reminders
            for (const session of sessionsFor24HourReminder) {
                try {
                    await this.sendSessionReminder(session, '24hour');
                    await this.updateSessionReminderSent(session, '24hour');
                    console.log(`✅ 24-hour reminder sent for session ${session._id}`);
                } catch (error) {
                    console.error(`❌ Error sending 24-hour reminder for session ${session._id}:`, error);
                }
            }
            
            // Send 1-hour reminders
            for (const session of sessionsFor1HourReminder) {
                try {
                    await this.sendSessionReminder(session, '1hour');
                    await this.updateSessionReminderSent(session, '1hour');
                    console.log(`✅ 1-hour reminder sent for session ${session._id}`);
                } catch (error) {
                    console.error(`❌ Error sending 1-hour reminder for session ${session._id}:`, error);
                }
            }
            
        } catch (error) {
            console.error('Error in session reminder processing:', error);
        }
    }

    // Process daily summary for admins
    async processDailySummary() {
        try {
            // Get today's statistics
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            const stats = {
                newBookings: await Booking.countDocuments({
                    createdAt: { $gte: today, $lt: tomorrow }
                }),
                confirmedBookings: await Booking.countDocuments({
                    status: BookingStatusHandler.BOOKING_STATUS.CONFIRMED,
                    date: { $gte: today, $lt: tomorrow }
                }),
                completedPayments: await Payment.countDocuments({
                    status: BookingStatusHandler.PAYMENT_MODEL_STATUS.PAID,
                    createdAt: { $gte: today, $lt: tomorrow }
                }),
                totalRevenue: await Payment.aggregate([
                    {
                        $match: {
                            status: BookingStatusHandler.PAYMENT_MODEL_STATUS.PAID,
                            createdAt: { $gte: today, $lt: tomorrow }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            total: { $sum: '$amount' }
                        }
                    }
                ])
            };

            // Send summary to admins
            await this.sendDailySummary(stats);
        } catch (error) {
            console.error('Error in daily summary processing:', error);
        }
    }

    // Helper methods for reminder logic
    async shouldSendPaymentReminder(booking) {
        // Check if 24 hours have passed since last reminder
        const lastReminder = booking.lastPaymentReminderSent;
        if (!lastReminder) return true; // First reminder

        const hoursSinceLast = (Date.now() - new Date(lastReminder).getTime()) / (1000 * 60 * 60);
        return hoursSinceLast >= 24;
    }

    async shouldSendSessionReminder(booking) {
        // Check if reminder already sent today
        const lastReminder = booking.lastSessionReminderSent;
        if (!lastReminder) return true;

        const today = new Date().toDateString();
        const lastReminderDate = new Date(lastReminder).toDateString();

        return today !== lastReminderDate;
    }

    async sendPaymentReminder(booking) {
        const recipient = {
            email: booking.userId?.email,
            phone: booking.userId?.phone
        };

        const data = {
            clientName: booking.clientName,
            serviceName: booking.serviceName,
            amount: booking.amount,
            bookingId: booking._id,
            paymentLink: `${process.env.FRONTEND_URL}/payment/${booking._id}`
        };

        await NotificationService.sendNotification(recipient, 'payment_reminder', data);
    }

    async sendSessionReminder(session, reminderType) {
        const recipient = {
            email: session.userId?.email,
            phone: session.userId?.phone
        };
        
        // Get booking information if available
        const booking = session.bookingId;
        const serviceName = booking?.serviceName || 'Physiotherapy Session';
        const therapistName = session.therapistId?.name || 'Your Therapist';
        
        // Format session time
        const sessionDate = session.startTime.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        const sessionTime = session.startTime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
        
        const data = {
            clientName: session.userId?.name || 'Valued Patient',
            serviceName: serviceName,
            date: sessionDate,
            time: sessionTime,
            therapistName: therapistName,
            meetLink: session.joinLink || session.googleMeetLink,
            sessionLink: session.joinLink || session.googleMeetLink,
            sessionId: session._id,
            reminderType: reminderType
        };
        
        // Use different template based on reminder type
        let templateName = 'session_reminder';
        if (reminderType === '24hour') {
            templateName = 'session_reminder_24h';
        } else if (reminderType === '1hour') {
            templateName = 'session_reminder_1h';
        }
        
        await NotificationService.sendNotification(recipient, templateName, data);
    }
    
    async updateSessionReminderSent(session, reminderType) {
        const updateField = reminderType === '24hour' 
            ? 'last24HourReminderSent' 
            : 'last1HourReminderSent';
        
        await Session.findByIdAndUpdate(session._id, {
            [updateField]: new Date()
        });
    }

    async sendDailySummary(stats) {
        // Get all admin users
        const User = require('../models/User.model');
        const admins = await User.find({ role: 'admin' }).select('email phone name');

        const data = {
            date: new Date().toDateString(),
            newBookings: stats.newBookings,
            confirmedSessions: stats.confirmedBookings,
            completedPayments: stats.completedPayments,
            totalRevenue: stats.totalRevenue[0]?.total || 0
        };

        // Send to all admins
        for (const admin of admins) {
            const recipient = {
                email: admin.email,
                phone: admin.phone
            };

            await NotificationService.sendNotification(recipient, 'daily_summary', data);
        }
    }

    async updateLastReminderSent(booking, reminderType) {
        const updateField = reminderType === 'payment'
            ? 'lastPaymentReminderSent'
            : 'lastSessionReminderSent';

        await Booking.findByIdAndUpdate(booking._id, {
            [updateField]: new Date()
        });
    }

    // Manual trigger methods (for testing/admin)
    async triggerPaymentReminders() {
        await this.processPaymentReminders();
    }

    async triggerSessionReminders() {
        await this.processSessionReminders();
    }

    async triggerDailySummary() {
        await this.processDailySummary();
    }

    // Status and monitoring
    getStatus() {
        return {
            isRunning: this.isRunning,
            scheduledJobs: Array.from(this.cronJobs.keys()),
            nextRuns: this.getNextRunTimes()
        };
    }

    getNextRunTimes() {
        const nextRuns = {};
        for (const [name, job] of this.cronJobs) {
            // This is a simplified approach - actual next run times would require
            // parsing the cron expression
            nextRuns[name] = 'Next scheduled run';
        }
        return nextRuns;
    }

    // Cleanup method
    stop() {
        console.log('Stopping reminder service...');
        for (const [name, job] of this.cronJobs) {
            job.stop();
            console.log(`Stopped ${name} job`);
        }
        this.cronJobs.clear();
        this.isRunning = false;
        console.log('Reminder service stopped');
    }
}

module.exports = new ReminderService();
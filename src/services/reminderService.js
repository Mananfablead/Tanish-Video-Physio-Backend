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

    // Schedule payment reminders (every hour) - DISABLED
    schedulePaymentReminders() {
        // PAYMENT REMINDERS DISABLED
        /*
        const job = cron.schedule('0 * * * *', async () => {
            console.log('Running payment reminder job...');
            await this.processPaymentReminders();
        });

        this.cronJobs.set('paymentReminders', job);
        */
    }

    // Schedule session reminders (every 15 minutes instead of every minute)
    scheduleSessionReminders() {
        console.log('📅 Scheduling session reminders: Every 15 minutes');
        const job = cron.schedule('*/15 * * * *', async () => {
            const startTime = Date.now();
            console.log(`\n⏰ [${new Date().toISOString()}] Running session reminder job...`);
            await this.processSessionReminders();
            console.log(`✅ Session reminder job completed in ${Date.now() - startTime}ms`);
        });

        this.cronJobs.set('sessionReminders', job);
    }

    // Daily summary disabled as requested
    scheduleDailySummary() {
        console.log('Daily summary scheduling disabled');
        // No job scheduled
    }

    // Process session reminders
    async processSessionReminders() {
        const startTime = Date.now();
        try {
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

            // Send 24-hour reminders
            if (sessionsFor24HourReminder.length > 0) {
                console.log(`Sending ${sessionsFor24HourReminder.length} 24-hour reminders`);
                for (const session of sessionsFor24HourReminder) {
                    try {
                        await this.sendSessionReminder(session, '24hour');
                        await this.updateSessionReminderSent(session, '24hour');
                    } catch (error) {
                        logger.error(`Error sending 24-hour reminder for session ${session._id}:`, error);
                    }
                }
            }

            // Send 1-hour reminders
            if (sessionsFor1HourReminder.length > 0) {
                console.log(`Sending ${sessionsFor1HourReminder.length} 1-hour reminders`);
                for (const session of sessionsFor1HourReminder) {
                    try {
                        await this.sendSessionReminder(session, '1hour');
                        await this.updateSessionReminderSent(session, '1hour');
                    } catch (error) {
                        logger.error(`Error sending 1-hour reminder for session ${session._id}:`, error);
                    }
                }
            }

            logger.info(`\n📊 Session Reminder Summary:`);
            logger.info(`   ✅ 24-hour reminders sent: ${sessionsFor24HourReminder.length}`);
            logger.info(`   ✅ 1-hour reminders sent: ${sessionsFor1HourReminder.length}`);
            logger.info(`   ⏱️ Total time: ${Date.now() - startTime}ms\n`);

        } catch (error) {
            logger.error('Error in session reminder processing:', error);
        }
    }

    // Daily summary processing disabled as requested
    async processDailySummary() {
        console.log('Daily summary processing disabled');
        // No processing performed
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
        // PAYMENT REMINDER DISABLED
        /*
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
        */
    }

    async sendSessionReminder(session, reminderType) {
        // Send to user/patient
        const userRecipient = {
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

        const userData = {
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

        // Send to user/patient
        await NotificationService.sendNotification(userRecipient, templateName, userData);

        // Send to admin as well - using admin_session_reminder for both 24h and 1h reminders
        const adminData = {
            ...userData,
            patientName: session.userId?.name || 'Patient',
            phone: session.userId?.phone || 'N/A',
            serviceName: serviceName,
            date: sessionDate,
            time: sessionTime,
            therapistName: therapistName,
            sessionLink: session.joinLink || session.googleMeetLink,
            sessionId: session._id,
            reminderType: reminderType
        };

        // Send admin-specific notification with admin_session_reminder template
        await NotificationService.sendNotification({}, 'admin_session_reminder', adminData);
    }

    async updateSessionReminderSent(session, reminderType) {
        const updateField = reminderType === '24hour'
            ? 'last24HourReminderSent'
            : 'last1HourReminderSent';

        await Session.findByIdAndUpdate(session._id, {
            [updateField]: new Date()
        });
    }

    // Daily summary sending disabled as requested
    async sendDailySummary(stats) {
        console.log('Daily summary sending disabled');
        // No emails sent
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

    // Daily summary trigger disabled as requested
    async triggerDailySummary() {
        console.log('Daily summary trigger disabled');
        // No action performed
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
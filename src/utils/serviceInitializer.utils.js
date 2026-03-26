const { initializeGoogleCalendar } = require('../utils/googleMeet.utils');
const { initializeTransporter } = require('../services/email.service');
const { initializeTransporter: initializeContactTransporter } = require('../utils/email.utils');
const ReminderService = require('../services/reminderService');
const logger = require('../utils/logger');

/**
 * Initialize all external services when server starts
 */
const initializeServices = async () => {
    try {
        logger.info('Initializing external services...');

        // Initialize Google Calendar API
        const googleCalendarSuccess = await initializeGoogleCalendar();
        if (googleCalendarSuccess) {
            logger.info('✓ Google Calendar API initialized successfully');
        } else {
            logger.warn('⚠ Google Calendar API initialization failed - fallback to simple Google Meet links');
        }

        // Initialize email service transporter
        try {
            await initializeTransporter();
            logger.info('✓ Email service transporter initialized successfully');
        } catch (emailError) {
            logger.warn('⚠ Email service initialization failed - email functionality may be unavailable');
        }

        // Initialize contact email service transporter
        try {
            await initializeContactTransporter();
            logger.info('✓ Contact email service transporter initialized successfully');
        } catch (contactEmailError) {
        }
        
        // Initialize reminder service - ENABLED
        try {
            ReminderService.initialize();
            logger.info('✓ Reminder service initialized successfully');
            logger.info('📅 Session reminders: Every 15 minutes (24h & 1h before session)');
            logger.info('📊 Daily summary: Every day at 9:00 AM IST');
        } catch (reminderError) {
            logger.error('❌ Reminder service initialization error:', reminderError.message);
        }
    } catch (error) {
        logger.error('Error initializing services:', error);
    }
};

module.exports = {
    initializeServices
};
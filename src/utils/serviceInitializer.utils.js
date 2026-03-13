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
        
        // Initialize reminder service - TEMPORARILY DISABLED
        logger.warn('⚠ Reminder service initialization is temporarily disabled');
        // try {
        //     ReminderService.initialize();
        //     logger.info('✓ Reminder service initialized successfully');
        // } catch (reminderError) {
        //      logger.error('Reminder service error details:', reminderError.message);
        // }
    } catch (error) {
        logger.error('Error initializing services:', error);
    }
};

module.exports = {
    initializeServices
};
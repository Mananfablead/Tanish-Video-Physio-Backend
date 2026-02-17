const { initializeGoogleCalendar } = require('../utils/googleMeet.utils');
const { initializeTransporter } = require('../services/email.service');
const { initializeTransporter: initializeContactTransporter } = require('../utils/email.utils');
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
            logger.warn('⚠ Contact email service initialization failed - contact functionality may be unavailable');
            logger.error('Contact email error details:', contactEmailError.message);
        }

        logger.info('External services initialization completed');
    } catch (error) {
        logger.error('Error initializing services:', error);
    }
};

module.exports = {
    initializeServices
};
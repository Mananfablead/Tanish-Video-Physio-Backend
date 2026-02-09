const { initializeGoogleCalendar } = require('../utils/googleMeet.utils');
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

        logger.info('External services initialization completed');
    } catch (error) {
        logger.error('Error initializing services:', error);
    }
};

module.exports = {
    initializeServices
};
const crypto = require('crypto');
const googleCalendarService = require('../services/googleCalendar.service');
const logger = require('./logger');
const { getGoogleCalendarCredentials, isGoogleCalendarConfigured } = require('../config/googleCalendar.config');

/**
 * Initialize Google Calendar API with credentials
 * @returns {Promise<boolean>} Success status
 */
const initializeGoogleCalendar = async () => {
    try {
        if (!isGoogleCalendarConfigured()) {
            logger.warn('Google Calendar API not configured');
            return false;
        }

        const credentials = getGoogleCalendarCredentials();
        const success = await googleCalendarService.initialize(credentials);
        return success;
    } catch (error) {
        logger.error('Failed to initialize Google Calendar:', error);
        return false;
    }
};

/**
 * Generate a Google Meet event through Google Calendar API
 * @param {Object} sessionData - Session information
 * @returns {Object} Google Meet event details
 */
const createGoogleMeetEvent = async (sessionData) => {
    try {
        // Convert session data to calendar event format
        const eventData = {
            summary: sessionData.summary || `Physiotherapy Session - ${sessionData.therapistName || 'Therapist'}`,
            description: sessionData.description || `Online physiotherapy session with ${sessionData.therapistName || 'therapist'}

Session ID: ${sessionData.sessionId}
Patient: ${sessionData.userName || 'Patient'}`,
            startDateTime: sessionData.startTime,
            endDateTime: sessionData.endTime,
            timeZone: sessionData.timeZone || 'Asia/Kolkata',
            attendees: [
                {
                    email: sessionData.userEmail,
                    displayName: sessionData.userName || 'Patient'
                },
                {
                    email: sessionData.therapistEmail,
                    displayName: sessionData.therapistName || 'Therapist'
                }
            ]
        };

        const result = await googleCalendarService.createCalendarEvent(eventData);

        logger.info('Google Meet event created successfully:', result.eventId);

        return {
            googleMeetEventId: result.eventId,
            googleMeetLink: result.meetLink,
            googleMeetCode: result.meetCode,
            googleMeetExpiresAt: new Date(sessionData.endTime) // Link expires when session ends
        };
    } catch (error) {
        logger.error('Error creating Google Meet event:', error);
        throw new Error(`Failed to create Google Meet event: ${error.message}`);
    }
};

/**
 * Delete Google Meet event from calendar
 * @param {string} eventId - Google Calendar event ID
 */
const deleteGoogleMeetEvent = async (eventId) => {
    try {
        await googleCalendarService.deleteCalendarEvent(eventId);
        logger.info('Google Meet event deleted:', eventId);
        return true;
    } catch (error) {
        logger.error('Error deleting Google Meet event:', error);
        return false;
    }
};

/**
 * Generate a Google Meet-like meeting code (for validation/format checking)
 * @returns {string} A 10-character meeting code in 3-4-3 format
 */
const generateGoogleMeetCode = () => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let part1 = '';
    let part2 = '';
    let part3 = '';

    // Generate 3-4-3 format (e.g., NYH-ZOR-QFX)
    for (let i = 0; i < 3; i++) {
        part1 += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    for (let i = 0; i < 4; i++) {
        part2 += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    for (let i = 0; i < 3; i++) {
        part3 += letters.charAt(Math.floor(Math.random() * letters.length));
    }

    return `${part1}-${part2}-${part3}`;
};

/**
 * Check if Google Meet link is expired
 * @param {Date} expiresAt - Expiration date
 * @returns {boolean} True if expired
 */
const isGoogleMeetExpired = (expiresAt) => {
    if (!expiresAt) return true;
    return new Date() > new Date(expiresAt);
};

module.exports = {
    initializeGoogleCalendar,
    createGoogleMeetEvent,
    deleteGoogleMeetEvent,
    generateGoogleMeetCode,
    isGoogleMeetExpired
};
const { google } = require('googleapis');
const logger = require('../utils/logger');

// Google Calendar API configuration
const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const GOOGLE_CALENDAR_ID = 'primary'; // or specific calendar ID

class GoogleCalendarService {
    constructor() {
        this.oauth2Client = null;
        this.calendar = null;
        this.isInitialized = false;
    }

    /**
     * Initialize Google Calendar API client
     * You'll need to set up OAuth2 credentials in your .env file
     */
    async initialize(credentials) {
        try {
            // Create OAuth2 client
            this.oauth2Client = new google.auth.OAuth2(
                credentials.clientId,
                credentials.clientSecret,
                'http://localhost:5000/auth/google/callback' // Default redirect URI
            );

            // Set credentials
            this.oauth2Client.setCredentials({
                access_token: credentials.accessToken,
                refresh_token: credentials.refreshToken
            });

            // Create Calendar API client
            this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
            this.isInitialized = true;

            logger.info('Google Calendar API initialized successfully');
            return true;
        } catch (error) {
            logger.error('Failed to initialize Google Calendar API:', error);
            return false;
        }
    }

    /**
     * Create a Google Calendar event with Google Meet conferencing
     * @param {Object} eventData - Event details
     * @returns {Object} Created event with Google Meet link
     */
    async createCalendarEvent(eventData) {
        if (!this.isInitialized || !this.calendar) {
            throw new Error('Google Calendar API not initialized');
        }

        try {
            const event = {
                summary: eventData.summary || 'Physiotherapy Session',
                description: eventData.description || 'Online physiotherapy session',
                start: {
                    dateTime: eventData.startDateTime,
                    timeZone: eventData.timeZone || 'Asia/Kolkata'
                },
                end: {
                    dateTime: eventData.endDateTime,
                    timeZone: eventData.timeZone || 'Asia/Kolkata'
                },
                attendees: eventData.attendees || [],
                conferenceData: {
                    createRequest: {
                        requestId: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        conferenceSolutionKey: {
                            type: 'hangoutsMeet'
                        }
                    }
                },
                reminders: {
                    useDefault: false,
                    overrides: [
                        { method: 'email', minutes: 24 * 60 }, // 24 hours before
                        { method: 'popup', minutes: 10 }       // 10 minutes before
                    ]
                }
            };

            const response = await this.calendar.events.insert({
                calendarId: GOOGLE_CALENDAR_ID,
                resource: event,
                conferenceDataVersion: 1,
                sendUpdates: 'all'
            });

            logger.info('Google Calendar event created:', response.data.id);

            // Extract REAL Google Meet link from hangoutLink (THIS IS THE CORRECT WAY)
            let meetLink = response.data.hangoutLink;
            let meetCode = null;

            if (meetLink) {
                // Extract code from the real Google Meet link
                const urlParts = meetLink.split('/');
                meetCode = urlParts[urlParts.length - 1];
                // Remove any query parameters
                meetCode = meetCode.split('?')[0];
            } else {
                // Fallback: try to extract from conferenceData
                if (response.data.conferenceData?.entryPoints) {
                    const videoEntryPoint = response.data.conferenceData.entryPoints.find(
                        entry => entry.entryPointType === 'video'
                    );

                    if (videoEntryPoint?.uri) {
                        meetLink = videoEntryPoint.uri;
                        const urlParts = meetLink.split('/');
                        meetCode = urlParts[urlParts.length - 1].split('?')[0];
                    }
                }

                // Last resort: try to construct from conference ID
                if (!meetLink && response.data.conferenceData?.conferenceId) {
                    meetLink = `https://meet.google.com/${response.data.conferenceData.conferenceId}`;
                    meetCode = response.data.conferenceData.conferenceId;
                }
            }

            // Validate we got a proper Google Meet link
            if (!meetLink || !meetLink.includes('meet.google.com')) {
                throw new Error('Failed to get valid Google Meet link from Calendar API');
            }

            return {
                eventId: response.data.id,
                meetLink: meetLink,
                meetCode: meetCode,
                event: response.data
            };
        } catch (error) {
            logger.error('Error creating Google Calendar event:', error);
            throw new Error(`Failed to create Google Calendar event: ${error.message}`);
        }
    }

    /**
     * Delete a Google Calendar event
     * @param {string} eventId - Google Calendar event ID
     */
    async deleteCalendarEvent(eventId) {
        if (!this.isInitialized || !this.calendar) {
            throw new Error('Google Calendar API not initialized');
        }

        try {
            await this.calendar.events.delete({
                calendarId: GOOGLE_CALENDAR_ID,
                eventId: eventId
            });

            logger.info('Google Calendar event deleted:', eventId);
            return true;
        } catch (error) {
            logger.error('Error deleting Google Calendar event:', error);
            throw new Error(`Failed to delete Google Calendar event: ${error.message}`);
        }
    }

    /**
     * Get Google Calendar event details
     * @param {string} eventId - Google Calendar event ID
     */
    async getCalendarEvent(eventId) {
        if (!this.isInitialized || !this.calendar) {
            throw new Error('Google Calendar API not initialized');
        }

        try {
            const response = await this.calendar.events.get({
                calendarId: GOOGLE_CALENDAR_ID,
                eventId: eventId
            });

            return response.data;
        } catch (error) {
            logger.error('Error getting Google Calendar event:', error);
            throw new Error(`Failed to get Google Calendar event: ${error.message}`);
        }
    }

    /**
     * Update Google Calendar event
     * @param {string} eventId - Google Calendar event ID
     * @param {Object} updates - Event updates
     */
    async updateCalendarEvent(eventId, updates) {
        if (!this.isInitialized || !this.calendar) {
            throw new Error('Google Calendar API not initialized');
        }

        try {
            const response = await this.calendar.events.patch({
                calendarId: GOOGLE_CALENDAR_ID,
                eventId: eventId,
                resource: updates
            });

            logger.info('Google Calendar event updated:', eventId);
            return response.data;
        } catch (error) {
            logger.error('Error updating Google Calendar event:', error);
            throw new Error(`Failed to update Google Calendar event: ${error.message}`);
        }
    }
}

// Export singleton instance
module.exports = new GoogleCalendarService();
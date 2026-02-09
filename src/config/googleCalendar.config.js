// Google Calendar API Configuration
// You need to set up OAuth2 credentials from Google Cloud Console

const googleCalendarConfig = {
    // These should be set in your .env file
    clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET || '',

    // Access tokens (required for API access)
    accessToken: process.env.GOOGLE_CALENDAR_ACCESS_TOKEN || '',
    refreshToken: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN || '',

    // Calendar settings
    calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
    timeZone: process.env.GOOGLE_CALENDAR_TIMEZONE || 'Asia/Kolkata'
};

// Function to get credentials object
const getGoogleCalendarCredentials = () => {
    return {
        clientId: googleCalendarConfig.clientId,
        clientSecret: googleCalendarConfig.clientSecret,
        accessToken: googleCalendarConfig.accessToken,
        refreshToken: googleCalendarConfig.refreshToken
    };
};

// Function to check if credentials are configured
const isGoogleCalendarConfigured = () => {
    return googleCalendarConfig.clientId &&
        googleCalendarConfig.clientSecret &&
        googleCalendarConfig.accessToken;
};

module.exports = {
    googleCalendarConfig,
    getGoogleCalendarCredentials,
    isGoogleCalendarConfigured
};
const logger = require('../utils/logger');

// Generate a unique session ID for video calls
const generateSessionId = () => {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Generate a unique participant ID
const generateParticipantId = () => {
    return `participant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Validate session parameters
const validateSession = (sessionData) => {
    const { therapistId, userId, startTime } = sessionData;

    if (!therapistId || !userId) {
        throw new Error('Therapist ID and User ID are required');
    }

    if (startTime && new Date(startTime) < new Date()) {
        throw new Error('Start time cannot be in the past');
    }

    return true;
};

// Format session data for response
const formatSessionData = (session) => {
    return {
        id: session._id,
        sessionId: session.sessionId,
        therapist: session.therapist,
        user: session.user,
        startTime: session.startTime,
        status: session.status,
        duration: session.duration,
        joinLink: `/video-call/${session.sessionId}`
    };
};

// Check if a session is ready to start
const isSessionReadyToStart = (session) => {
    const now = new Date();
    const startTime = new Date(session.startTime);
    const timeUntilStart = startTime - now;

    // Session is ready to start if it's within 5 minutes of scheduled time
    return timeUntilStart <= 5 * 60 * 1000 && timeUntilStart >= 0;
};

// Calculate session duration
const calculateDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return 0;

    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationInMs = end - start;

    // Return duration in minutes
    return Math.round(durationInMs / (1000 * 60));
};

module.exports = {
    generateSessionId,
    generateParticipantId,
    validateSession,
    formatSessionData,
    isSessionReadyToStart,
    calculateDuration
};
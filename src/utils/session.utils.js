/**
 * Utility functions for session management
 */

/**
 * Parse duration string to minutes
 * @param {string} durationString - Duration in format like "30 mins", "60 minutes", "45 min"
 * @returns {number|null} - Duration in minutes or null if invalid format
 */
const parseDurationString = (durationString) => {
    if (!durationString || typeof durationString !== 'string') {
        return null;
    }

    // Match patterns like "30 mins", "60 minutes", "45 min"
    const durationMatch = durationString.trim().match(/^([0-9]+)\s*(min|mins|minutes)$/i);

    if (durationMatch) {
        return parseInt(durationMatch[1], 10);
    }

    return null;
};

/**
 * Format minutes to duration string
 * @param {number} minutes - Duration in minutes
 * @returns {string} - Formatted duration string like "30 mins"
 */
const formatDurationString = (minutes) => {
    if (!minutes || minutes <= 0) {
        return "0 mins";
    }

    return `${minutes} mins`;
};

module.exports = {
    parseDurationString,
    formatDurationString
};
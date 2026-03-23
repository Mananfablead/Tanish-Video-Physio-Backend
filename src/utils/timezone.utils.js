const config = require('../config/env');

/**
 * Convert local datetime to UTC Date object
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} time - Time in HH:MM format
 * @param {string} timezone - Source timezone (default from env)
 * @returns {Date} - UTC Date object
 */
const getUTCFromLocal = (date, time, timezone = 'Asia/Kolkata') => {
    if (!timezone || timezone === 'UTC') {
        return new Date(`${date}T${time}:00Z`);
    }

    // Parse the local time
    const localDate = new Date(`${date}T${time}:00`);
    
    // Get what this time would be in the specified timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    const parts = formatter.formatToParts(localDate);
    const partMap = {};
    parts.forEach(part => {
        if (part.type !== 'literal') {
            partMap[part.type] = part.value;
        }
    });

    // Create UTC date from interpreted components
    const interpretedDate = new Date(Date.UTC(
        parseInt(partMap.year),
        parseInt(partMap.month) - 1,
        parseInt(partMap.day),
        parseInt(partMap.hour),
        parseInt(partMap.minute)
    ));

    // Calculate and apply timezone offset
    const diffMs = localDate.getTime() - interpretedDate.getTime();
    return new Date(localDate.getTime() - diffMs);
};

/**
 * Convert UTC Date to local time string
 * @param {Date} utcDate - UTC Date object
 * @param {string} timezone - Target timezone
 * @returns {Object} - { date: 'YYYY-MM-DD', time: 'HH:MM' }
 */
const getLocalFromUTC = (utcDate, timezone = 'Asia/Kolkata') => {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    const parts = formatter.formatToParts(utcDate);
    const partMap = {};
    parts.forEach(part => {
        if (part.type !== 'literal') {
            partMap[part.type] = part.value;
        }
    });

    return {
        date: `${partMap.year}-${partMap.month}-${partMap.day}`,
        time: `${partMap.hour}:${partMap.minute}`
    };
};

module.exports = {
    getUTCFromLocal,
    getLocalFromUTC
};

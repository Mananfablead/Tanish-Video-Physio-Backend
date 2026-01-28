const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config/env');

/**
 * Generate a secure join link for video calls
 * @param {string} sessionId - The session ID
 * @param {string} userId - The user ID
 * @param {string} role - The user role ('user' or 'therapist')
 * @returns {string} The secure join link
 */
const generateJoinLink = (sessionId, userId, role) => {
    // Create a JWT token containing session and user info
    const token = jwt.sign(
        {
            sessionId,
            userId,
            role,
            exp: Math.floor(Date.now() / 1000) + (48 * 60 * 60) // Token expires in 48 hours
        },
        config.JWT_SECRET
    );

    // Generate a unique path for the video call
    const callPath = `/video-call/${sessionId}/${role}`;
    
    // Return the full join link with token as query param
    return `${callPath}?token=${token}`;
};

/**
 * Verify a join link token
 * @param {string} token - The JWT token from the URL
 * @returns {object|null} Decoded token data or null if invalid
 */
const verifyJoinLink = (token) => {
    try {
        return jwt.verify(token, config.JWT_SECRET);
    } catch (error) {
        console.error('Invalid join link token:', error);
        return null;
    }
};

/**
 * Generate a meeting ID for the video call
 * @param {string} sessionId - The session ID
 * @returns {string} A unique meeting ID
 */
const generateMeetingId = (sessionId) => {
    // Create a deterministic meeting ID based on session ID
    const hash = crypto.createHash('sha256').update(sessionId).digest('hex');
    return hash.substring(0, 12); // Take first 12 characters
};

/**
 * Generate a unique room ID for the video call
 * @param {string} sessionId - The session ID
 * @param {string} userId - The user ID
 * @returns {string} A unique room ID
 */
const generateRoomId = (sessionId, userId) => {
    const timestamp = Date.now();
    const salt = crypto.randomBytes(4).toString('hex');
    const roomData = `${sessionId}-${userId}-${timestamp}-${salt}`;
    return crypto.createHash('sha256').update(roomData).digest('hex').substring(0, 16);
};

/**
 * Create a secure video call invitation
 * @param {string} sessionId - The session ID
 * @param {object} userInfo - User information
 * @param {string} baseUrl - Base URL of the application
 * @returns {object} Invitation details
 */
const createVideoCallInvitation = (sessionId, userInfo, baseUrl) => {
    const { userId, role, userName } = userInfo;
    
    const joinLink = generateJoinLink(sessionId, userId, role);
    const meetingId = generateMeetingId(sessionId);
    const roomId = generateRoomId(sessionId, userId);
    
    return {
        sessionId,
        meetingId,
        roomId,
        joinLink: `${baseUrl}/video-call/${joinLink}`,
        role,
        invitedUser: userName,
        validUntil: new Date(Date.now() + 60 * 60 * 1000), // Valid for 1 hour
        securityLevel: 'high'
    };
};

module.exports = {
    generateJoinLink,
    verifyJoinLink,
    generateMeetingId,
    generateRoomId,
    createVideoCallInvitation
};
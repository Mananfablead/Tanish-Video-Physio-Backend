const ChatMessage = require('../models/ChatMessage.model');
const Session = require('../models/Session.model');
const GroupSession = require('../models/GroupSession.model');
const ApiResponse = require('../utils/apiResponse');

// Get chat messages for a session (supports both regular sessions and group sessions)
const getChatMessages = async (req, res, next) => {
    try {
        const { sessionId } = req.params;

        // Debug logging
        console.log('Chat request debug info:');
        console.log('- Session ID from params:', sessionId);
        console.log('- User ID from token:', req.user.userId);
        console.log('- User role:', req.user.role);

        let session = null;
        let isGroupSession = false;

        // First, try to find as a regular session
        session = await Session.findById(sessionId);
        if (session) {
            console.log('- Found regular session in DB');
            console.log('- Session userId:', session.userId);
            console.log('- Session therapistId:', session.therapistId);
            console.log('- Session status:', session.status);
        } else {
            // Try to find as a group session
            session = await GroupSession.findById(sessionId);
            if (session) {
                console.log('- Found group session in DB');
                isGroupSession = true;
                console.log('- Group session participants:', session.participants?.length || 0);
            }
        }

        if (!session) {
            return res.status(404).json(ApiResponse.error('Session not found'));
        }

        // Verify user has access to this session
        let hasAccess = false;
        
        if (isGroupSession) {
            // For group sessions, check if user is a participant or admin
            const isParticipant = session.participants && 
                session.participants.some(p => p.userId.toString() === req.user.userId);
            hasAccess = isParticipant || req.user.role === 'admin';
            console.log('- User is group session participant:', isParticipant);
        } else {
            // For regular sessions, check if user is owner or therapist
            hasAccess = 
                session.userId.toString() === req.user.userId ||
                session.therapistId.toString() === req.user.userId ||
                req.user.role === 'admin';
            console.log('- User has access to regular session:', hasAccess);
        }

        if (!hasAccess) {
            return res.status(403).json(ApiResponse.error('Unauthorized access to session'));
        }

        const messages = await ChatMessage.find({ sessionId })
            .populate('senderId', 'name email role')
            .sort({ timestamp: 1 });

        console.log(`- Retrieved ${messages.length} messages for ${isGroupSession ? 'group' : 'regular'} session`);

        res.status(200).json(ApiResponse.success({ messages }, 'Chat messages retrieved successfully'));
    } catch (error) {
        console.error('Chat controller error:', error);
        next(error);
    }
};

// Message sending is handled via socket events only
// This function is deprecated and should not be used
const sendMessage = async (req, res) => {
    res.status(400).json({
        success: false,
        message: 'Message sending is disabled. Please use socket events instead.',
        error: 'Use socket.emit("send-message", data) for real-time messaging'
    });
};

module.exports = {
    getChatMessages,
    sendMessage
};
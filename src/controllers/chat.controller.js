const ChatMessage = require('../models/ChatMessage.model');
const Session = require('../models/Session.model');
const ApiResponse = require('../utils/apiResponse');

// Get chat messages for a session
const getChatMessages = async (req, res, next) => {
    try {
        const { sessionId } = req.params;

        // Verify the session belongs to the user
        const session = await Session.findOne({ _id: sessionId, userId: req.user.userId });
        if (!session) {
            return res.status(404).json(ApiResponse.error('Session not found'));
        }

        const messages = await ChatMessage.find({ sessionId })
            .populate('senderId', 'name')
            .sort({ timestamp: 1 });

        res.status(200).json(ApiResponse.success({ messages }, 'Chat messages retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Send a chat message
const sendMessage = async (req, res, next) => {
    try {
        const { sessionId } = req.params;
        const { message } = req.body;

        // Verify the session belongs to the user
        const session = await Session.findOne({ _id: sessionId, userId: req.user.userId });
        if (!session) {
            return res.status(404).json(ApiResponse.error('Session not found'));
        }

        const chatMessage = new ChatMessage({
            sessionId,
            senderId: req.user.userId, // Current user is the sender
            message,
            senderType: 'user' // Could be 'user' or 'therapist'
        });

        await chatMessage.save();

        await chatMessage.populate('senderId', 'name');

        res.status(201).json(ApiResponse.success({ message: chatMessage }, 'Message sent successfully'));
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getChatMessages,
    sendMessage
};
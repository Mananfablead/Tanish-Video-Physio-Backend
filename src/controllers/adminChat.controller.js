const ChatMessage = require('../models/ChatMessage.model');
const Session = require('../models/Session.model');
const User = require('../models/User.model');
const ApiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');

// Get all chat messages for admin view
const getAdminChatMessages = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, messageType, senderId, sessionId, sortBy = 'timestamp', sortOrder = 'desc' } = req.query;

        // Build filter object
        const filter = {};
        if (messageType) {
            filter.messageType = messageType;
        }
        if (req.params.userId) {
            filter.senderId = req.params.userId;
        }
        // Handle sessionId filtering - include null sessionId for default-chat messages
        if (sessionId) {
            if (sessionId === 'null' || sessionId === 'undefined') {
                filter.sessionId = null;
            } else {
                filter.sessionId = sessionId;
            }
        }

        // For video call chats, only show messages from completed sessions
        if (messageType === 'video-call-chat') {
            // Find completed sessions
            const completedSessions = await Session.find({ status: 'completed' }).select('_id');
            const completedSessionIds = completedSessions.map(session => session._id);
            
            // Update filter to only include messages from completed sessions
            if (completedSessionIds.length > 0) {
                if (filter.sessionId) {
                    // If a specific sessionId was requested, check if it's in completed sessions
                    if (!completedSessionIds.some(id => id.equals(filter.sessionId))) {
                        // If specific sessionId is not completed, return empty results
                        return res.status(200).json(
                            ApiResponse.success({
                                messages: [],
                                pagination: {
                                    currentPage: 1,
                                    totalPages: 0,
                                    totalMessages: 0,
                                    hasNextPage: false,
                                    hasPrevPage: false
                                }
                            }, 'Admin chat messages retrieved successfully')
                        );
                    }
                } else {
                    // Only show messages that have a sessionId (not default-chat) and are from completed sessions
                    filter.sessionId = { $in: completedSessionIds };
                }
            } else {
                // If no completed sessions exist, return empty results
                return res.status(200).json(
                    ApiResponse.success({
                        messages: [],
                        pagination: {
                            currentPage: 1,
                            totalPages: 0,
                            totalMessages: 0,
                            hasNextPage: false,
                            hasPrevPage: false
                        }
                    }, 'Admin chat messages retrieved successfully')
                );
            }
        }

        // Convert page and limit to integers
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

        // Query messages with pagination and sorting
        const messages = await ChatMessage.find(filter)
            .populate('senderId', 'name email role')
            .populate('sessionId', 'date time type')
            .populate('replyTo', 'message')
            .sort(sort)
            .skip(skip)
            .limit(limitNum);

        // Count total messages for pagination
        const total = await ChatMessage.countDocuments(filter);

        res.status(200).json(
            ApiResponse.success({
                messages,
                pagination: {
                    currentPage: pageNum,
                    totalPages: Math.ceil(total / limitNum),
                    totalMessages: total,
                    hasNextPage: skip + limitNum < total,
                    hasPrevPage: pageNum > 1
                }
            }, 'Admin chat messages retrieved successfully')
        );
    } catch (error) {
        logger.error('Error getting admin chat messages:', error);
        next(error);
    }
};

// Send admin reply
const sendAdminReply = async (req, res, next) => {
    try {
        const { sessionId, message, replyTo, messageType = 'live-chat' } = req.body;
        const adminId = req.user.userId;

        // Validate required fields
        if (!message) {
            return res.status(400).json(
                ApiResponse.error('Message is required')
            );
        }

        // For default-chat messageType, sessionId can be null
        // For other message types, sessionId is required
        if (messageType !== 'default-chat' && !sessionId) {
            return res.status(400).json(
                ApiResponse.error('Session ID is required for this message type')
            );
        }

        // Check if session exists (only for non-default-chat messages)
        let session = null;
        if (sessionId && messageType !== 'default-chat') {
            session = await Session.findById(sessionId);
            if (!session) {
                return res.status(404).json(
                    ApiResponse.error('Session not found')
                );
            }
        }

        // Create admin reply message
        const adminMessage = new ChatMessage({
            sessionId,
            senderId: adminId,
            senderType: 'admin',
            message,
            messageType,
            replyTo: replyTo || null
        });

        await adminMessage.save();
        await adminMessage.populate('senderId', 'name email');

        // Emit real-time notification to connected clients
        const io = req.app.get('io'); // Assuming socket.io instance is attached to app
        if (io) {
            // Notify all users in the session room (only if session exists)
            if (sessionId) {
                io.to(sessionId).emit('admin-reply-received', {
                    message: adminMessage,
                    senderName: adminMessage.senderId.name
                });

                // Also emit to user specifically if they're connected and session exists
                if (session && session.userId) {
                    io.emit('admin-reply-to-user', {
                        userId: session.userId,
                        message: adminMessage
                    });
                }
            } else {
                // For default chat (no session), emit to all users in default chat room
                io.to('default-live-chat').emit('admin-reply-received', {
                    message: adminMessage,
                    senderName: adminMessage.senderId.name
                });

                // Also emit to all connected users for default chat
                io.emit('admin-reply-to-user', {
                    message: adminMessage
                });
            }
        }

        res.status(201).json(
            ApiResponse.success(
                { message: adminMessage },
                'Admin reply sent successfully'
            )
        );
    } catch (error) {
        logger.error('Error sending admin reply:', error);
        next(error);
    }
};

// Get unread messages count
const getUnreadMessagesCount = async (req, res, next) => {
    try {
        const unreadCount = await ChatMessage.countDocuments({
            read: false,
            senderType: { $ne: 'admin' } // Exclude admin messages
        });

        res.status(200).json(
            ApiResponse.success(
                { count: unreadCount },
                'Unread messages count retrieved successfully'
            )
        );
    } catch (error) {
        logger.error('Error getting unread messages count:', error);
        next(error);
    }
};

// Mark messages as read
const markMessagesAsRead = async (req, res, next) => {
    try {
        const { messageIds } = req.body;

        if (!messageIds || !Array.isArray(messageIds)) {
            return res.status(400).json(
                ApiResponse.error('Message IDs array is required')
            );
        }

        // Update messages to mark as read
        await ChatMessage.updateMany(
            { _id: { $in: messageIds } },
            { $set: { read: true } }
        );

        res.status(200).json(
            ApiResponse.success(null, 'Messages marked as read successfully')
        );
    } catch (error) {
        logger.error('Error marking messages as read:', error);
        next(error);
    }
};

// Get active chats (chats with unread messages)
const getActiveChats = async (req, res, next) => {
    try {
        console.log("Getting active chats...");

        // Simple approach: Get distinct users with unread messages
        const usersWithUnread = await ChatMessage.aggregate([
            {
                $match: {
                    read: false,
                    senderType: { $ne: 'admin' }
                }
            },
            {
                $group: {
                    _id: {
                        $cond: {
                            if: { $ne: ["$sessionId", null] },
                            then: "$sessionId",
                            else: "$senderId"
                        }
                    },
                    userId: { $first: "$senderId" },
                    sessionId: { $first: "$sessionId" },
                    unreadCount: { $sum: 1 },
                    lastMessage: { $first: "$message" },
                    lastMessageTime: { $first: "$createdAt" },
                    messageType: { $first: "$messageType" }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'userInfo'
                }
            },
            {
                $lookup: {
                    from: 'sessions',
                    localField: 'sessionId',
                    foreignField: '_id',
                    as: 'sessionInfo'
                }
            },
            {
                $project: {
                    userId: 1,
                    sessionId: 1,
                    unreadCount: 1,
                    lastMessage: 1,
                    lastMessageTime: 1,
                    messageType: 1,
                    userInfo: { $arrayElemAt: ['$userInfo', 0] },
                    sessionInfo: { $arrayElemAt: ['$sessionInfo', 0] }
                }
            }
        ]);

        console.log("Found users with unread messages:", usersWithUnread.length);

        // Now group by actual user to eliminate duplicates
        const finalChats = new Map();

        for (const chat of usersWithUnread) {
            const actualUserId = chat.sessionInfo?.userId || chat.userId;
            const userKey = actualUserId.toString();

            if (!finalChats.has(userKey)) {
                finalChats.set(userKey, {
                    userId: actualUserId,
                    sessionId: chat.sessionId,
                    unreadCount: chat.unreadCount,
                    lastMessage: chat.lastMessage,
                    lastMessageTime: chat.lastMessageTime,
                    messageType: chat.messageType,
                    userInfo: chat.userInfo
                });
            } else {
                // Combine counts and keep latest message
                const existing = finalChats.get(userKey);
                existing.unreadCount += chat.unreadCount;
                if (chat.lastMessageTime > existing.lastMessageTime) {
                    existing.lastMessage = chat.lastMessage;
                    existing.lastMessageTime = chat.lastMessageTime;
                }
            }
        }

        const activeChats = Array.from(finalChats.values());
        console.log("Final active chats count:", activeChats.length);

        res.status(200).json(
            ApiResponse.success(
                { activeChats: activeChats },
                'Active chats retrieved successfully'
            )
        );
    } catch (error) {
        logger.error('Error getting active chats:', error);
        next(error);
    }
};

// Get chat statistics
const getChatStats = async (req, res, next) => {
    try {
        const totalMessages = await ChatMessage.countDocuments();
        const unreadMessages = await ChatMessage.countDocuments({
            read: false,
            senderType: { $ne: 'admin' }
        });
        const todayMessages = await ChatMessage.countDocuments({
            createdAt: {
                $gte: new Date(new Date().setHours(0, 0, 0, 0))
            }
        });

        // Get message count by type
        const messagesByType = await ChatMessage.aggregate([
            {
                $group: {
                    _id: '$messageType',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Get message count by sender type
        const messagesBySender = await ChatMessage.aggregate([
            {
                $group: {
                    _id: '$senderType',
                    count: { $sum: 1 }
                }
            }
        ]);

        res.status(200).json(
            ApiResponse.success({
                totalMessages,
                unreadMessages,
                todayMessages,
                messagesByType,
                messagesBySender
            }, 'Chat statistics retrieved successfully')
        );
    } catch (error) {
        logger.error('Error getting chat stats:', error);
        next(error);
    }
};

module.exports = {
    getAdminChatMessages,
    sendAdminReply,
    getUnreadMessagesCount,
    markMessagesAsRead,
    getActiveChats,
    getChatStats
};
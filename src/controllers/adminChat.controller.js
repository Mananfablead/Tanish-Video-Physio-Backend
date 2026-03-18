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

        // Handle multiple message types
        if (messageType) {
            filter.messageType = messageType;
        } else if (req.query.messageTypes) {
            // Handle array of message types
            let messageTypesArray;
            if (Array.isArray(req.query.messageTypes)) {
                messageTypesArray = req.query.messageTypes;
            } else {
                // Handle comma-separated string
                messageTypesArray = req.query.messageTypes.split(',');
            }
            filter.messageType = { $in: messageTypesArray };
        }
        if (req.params.userId) {
            filter.senderId = req.params.userId;
        }
        // Handle sessionId filtering - include null sessionId for default-chat messages
        if (sessionId) {
            if (sessionId === 'null' || sessionId === 'undefined') {
                filter.sessionId = null;
            } else {
                // Check if it's a valid ObjectId before adding to filter
                const mongoose = require('mongoose');
                if (mongoose.Types.ObjectId.isValid(sessionId)) {
                    filter.sessionId = new mongoose.Types.ObjectId(sessionId);
                } else {
                    // If not a valid ObjectId, it might be a custom ID - search by messageId or skip
                    console.log(`Invalid ObjectId format for sessionId: ${sessionId}`);
                    // Don't add to filter, will return empty or we could search other fields
                }
            }
        }

        // For video call chats, only show messages from completed sessions
        // Only apply this filter when specifically requesting video-call-chat and not including live-chat
        if ((messageType === 'video-call-chat') ||
            (req.query.messageTypes &&
                req.query.messageTypes.includes('video-call-chat') &&
                !req.query.messageTypes.includes('live-chat'))) {
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
        // For support rooms, sessionId is in format "support-<userId>"
        // For other message types, sessionId is required
        if (messageType !== 'default-chat' && !sessionId) {
            return res.status(400).json(
                ApiResponse.error('Session ID is required for this message type')
            );
        }

        // Determine if this is a support room (1-on-1 private chat)
        const isSupportRoom = typeof sessionId === 'string' && sessionId.startsWith('support-');

        // Check if session exists (only for regular sessions, not support rooms or default chat)
        let session = null;
        if (sessionId && messageType !== 'default-chat' && !isSupportRoom) {
            session = await Session.findById(sessionId);
            if (!session) {
                return res.status(404).json(
                    ApiResponse.error('Session not found')
                );
            }
        }

        // Create admin reply message
        const chatMessageData = {
            senderId: adminId,
            senderType: 'admin',
            message,
            messageType: isSupportRoom ? 'default-chat' : messageType,
            replyTo: replyTo || null
        };

        // For support rooms and default chat, don't store sessionId
        if (!isSupportRoom && sessionId && messageType !== 'default-chat') {
            chatMessageData.sessionId = sessionId;
        }

        // Store the chatRoom for support messages
        if (isSupportRoom) {
            chatMessageData.chatRoom = sessionId;
        }

        const adminMessage = new ChatMessage(chatMessageData);

        await adminMessage.save();
        await adminMessage.populate('senderId', 'name email');

        // Emit real-time notification to connected clients
        const io = req.app.get('io'); // Assuming socket.io instance is attached to app
        if (io) {
            if (isSupportRoom) {
                // For support rooms, emit to the specific support room and user
                io.to(sessionId).emit('message-received', {
                    messageId: adminMessage.messageId,
                    _id: adminMessage._id,
                    content: adminMessage.message,
                    senderId: adminMessage.senderId._id,
                    senderName: adminMessage.senderId.name,
                    timestamp: adminMessage.createdAt,
                    senderType: 'admin',
                    chatRoom: sessionId
                });

                // Also emit to admin_notifications so admin sees it in real-time
                io.to('admin_notifications').emit('message-received', {
                    messageId: adminMessage.messageId,
                    _id: adminMessage._id,
                    content: adminMessage.message,
                    senderId: adminMessage.senderId._id,
                    senderName: adminMessage.senderId.name,
                    timestamp: adminMessage.createdAt,
                    senderType: 'admin',
                    chatRoom: sessionId
                });

                // Also emit to admin notifications
                io.to('admin_notifications').emit('new-support-message', {
                    content: adminMessage.message,
                    senderId: adminMessage.senderId._id,
                    senderName: adminMessage.senderId.name,
                    timestamp: adminMessage.createdAt,
                    senderType: 'admin',
                    chatRoom: sessionId,
                    message: adminMessage
                });
            } else if (sessionId) {
                // Notify all users in the session room (for regular sessions)
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
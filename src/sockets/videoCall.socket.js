const Session = require('../models/Session.model');
const User = require('../models/User.model');
const GroupSession = require('../models/GroupSession.model');
const CallLog = require('../models/CallLog.model');
const logger = require('../utils/logger');

// Function to setup video call socket handlers
const setupVideoCallHandlers = (io, socket) => {
    // Join a video call room (both 1-on-1 and group)
    socket.on('join-room', async (data) => {
        try {
            const { sessionId, groupSessionId } = data;
            const userId = socket.user.userId;
            
            let roomType, roomInfo;
            let isUser = false, isTherapist = false, isParticipant = false;

            // Determine if it's a 1-on-1 or group session
            if (sessionId) {
                // 1-on-1 session
                roomType = 'session';

                // Verify session exists and user has access
                const session = await Session.findById(sessionId)
                    .populate('userId')
                    .populate('therapistId');

                if (!session) {
                    socket.emit('error', { message: 'Session not found' });
                    return;
                }

                // Check if user has permission to join the call
                isUser = session.userId && session.userId._id.toString() === userId;
                isTherapist = session.therapistId && session.therapistId._id.toString() === userId;
                const isAdmin = socket.user.role === 'admin';

                // Allow admins to join for monitoring purposes
                if (!isUser && !isTherapist && !isAdmin) {
                    socket.emit('error', { message: 'Unauthorized to join this session' });
                    return;
                }

                roomInfo = session;

                // Check session status first
                if (session.status !== 'scheduled' && session.status !== 'live' && session.status !== 'pending') {
                    socket.emit('error', { message: 'Session is not active at this time' });
                    return;
                }

                // Check if call has started within the valid time frame
                const now = new Date();
                // Use the startTime field which is already in the correct timezone
                const sessionTime = new Date(session.startTime);

                // Allow joining 24 hours before and 60 minutes after session start time
                // Development mode: Extended window for testing
                if (now < new Date(sessionTime.getTime() - 24 * 60 * 60000) || now > new Date(sessionTime.getTime() + 60 * 60000)) {
                    socket.emit('error', { message: 'Session is not active at this time' });
                    return;
                }
            } else if (groupSessionId) {
                // Group session
                roomType = 'group';

                // Verify group session exists and user has access
                const groupSession = await GroupSession.findById(groupSessionId)
                    .populate('therapistId')
                    .populate('participants.userId');

                if (!groupSession) {
                    socket.emit('error', { message: 'Group session not found' });
                    return;
                }

                // Check if user has permission to join the group call
                isTherapist = groupSession.therapistId._id.toString() === userId;
                isParticipant = groupSession.participants.some(
                    p => p.userId._id.toString() === userId && p.status === 'accepted'
                );
                const isAdmin = socket.user.role === 'admin';

                // Allow admins to join for monitoring purposes
                if (!isTherapist && !isParticipant && !isAdmin) {
                    socket.emit('error', { message: 'Unauthorized to join this group session' });
                    return;
                }

                // Check if max participants reached
                const activeParticipants = Array.from(io.sockets.adapter.rooms.get(groupSessionId) || []).length;
                if (activeParticipants >= groupSession.maxParticipants && !isTherapist) {
                    socket.emit('error', { message: 'Maximum participants reached for this group session' });
                    return;
                }

                // Check group session status
                if (groupSession.status !== 'scheduled' && groupSession.status !== 'live' && groupSession.status !== 'pending') {
                    socket.emit('error', { message: 'Group session is not active at this time' });
                    return;
                }

                // Check if call has started within the valid time frame
                const now = new Date();
                // Use the startTime field which is already in the correct timezone
                const sessionTime = new Date(groupSession.startTime);

                // Allow joining 24 hours before and 60 minutes after session start time
                if (now < new Date(sessionTime.getTime() - 24 * 60 * 60000) || now > new Date(sessionTime.getTime() + 60 * 60000)) {
                    socket.emit('error', { message: 'Group session is not active at this time' });
                    return;
                }

                roomInfo = groupSession;
            } else {
                socket.emit('error', { message: 'Either sessionId or groupSessionId is required' });
                return;
            }

            // Add user to the video call room
            const roomId = sessionId || groupSessionId;
            socket.join(roomId);
            logger.info(`User ${userId} joined ${roomType} room ${roomId}`);

            // Notify others in the room
            socket.to(roomId).emit('participant-joined', {
                userId: userId,
                socketId: socket.id,
                roomId: roomId,
                roomType: roomType,
                isTherapist: isTherapist || (roomInfo.therapistId && roomInfo.therapistId._id.toString() === userId),
                isUser: isUser || isParticipant
            });

            // Update call log if call is active - execute as promise to avoid blocking
            (async () => {
                try {
                    const activeCallLog = await CallLog.findOne({
                        [roomType === 'group' ? 'groupSessionId' : 'sessionId']: roomId,
                        status: 'active'
                    }).sort({ callStartedAt: -1 });

                    if (activeCallLog) {
                        const existingParticipant = activeCallLog.participants.find(
                            p => p.userId.toString() === userId
                        );

                        if (!existingParticipant) {
                            activeCallLog.participants.push({
                                userId: userId,
                                joinedAt: new Date()
                            });
                            await activeCallLog.save();
                        }
                    }
                } catch (error) {
                    logger.error('Error updating call log on join:', error);
                }
            })();

            // Emit success event
            socket.emit('joined-call', {
                success: true,
                roomId: roomId,
                roomType: roomType,
                message: `Successfully joined ${roomType} video call`
            });
        } catch (error) {
            logger.error('Error joining video call:', error);
            socket.emit('error', { message: 'Failed to join video call' });
        }
    });

    // Leave a video call room
    socket.on('leave-room', async (data) => {
        try {
            const { roomId, roomType } = data;
            const userId = socket.user.userId;
            
            socket.leave(roomId);
            logger.info(`User ${userId} left ${roomType} room ${roomId}`);

            socket.to(roomId).emit('participant-left', {
                userId: userId,
                roomId: roomId,
                roomType: roomType
            });

            // Update call log if call is active - execute as promise to avoid blocking
            (async () => {
                try {
                    const activeCallLog = await CallLog.findOne({
                        [roomType === 'group' ? 'groupSessionId' : 'sessionId']: roomId,
                        status: 'active'
                    }).sort({ callStartedAt: -1 });

                    if (activeCallLog) {
                        const participantIndex = activeCallLog.participants.findIndex(
                            p => p.userId.toString() === userId
                        );

                        if (participantIndex !== -1) {
                            activeCallLog.participants[participantIndex].leftAt = new Date();
                            activeCallLog.participants[participantIndex].duration =
                                (new Date() - activeCallLog.participants[participantIndex].joinedAt) / 1000;
                            await activeCallLog.save();
                        }
                    }
                } catch (error) {
                    logger.error('Error updating call log on leave:', error);
                }
            })();

            socket.emit('left-call', {
                success: true,
                message: 'Successfully left video call'
            });
        } catch (error) {
            logger.error('Error leaving video call:', error);
            socket.emit('error', { message: 'Failed to leave video call' });
        }
    });

    // Start a call
    socket.on('call-start', async (data) => {
        try {
            const { roomId, roomType } = data;
            const userId = socket.user.userId;

            // Only therapist can start the call
            if (roomType === 'session') {
                const session = await Session.findById(roomId);
                if (session && session.therapistId.toString() !== userId) {
                    socket.emit('error', { message: 'Only therapist can start the call' });
                    return;
                }
            } else if (roomType === 'group') {
                const groupSession = await GroupSession.findById(roomId);
                if (groupSession && groupSession.therapistId.toString() !== userId) {
                    socket.emit('error', { message: 'Only therapist can start the call' });
                    return;
                }
            }

            // Create call log entry
            const callLog = new CallLog({
                [roomType === 'group' ? 'groupSessionId' : 'sessionId']: roomId,
                type: roomType === 'group' ? 'group' : 'one-on-one',
                callStartedAt: new Date(),
                status: 'active',
                participants: []
            });

            // Add participants to call log
            const room = io.sockets.adapter.rooms.get(roomId);
            if (room) {
                for (const participantId of room) {
                    const participantSocket = io.sockets.sockets.get(participantId);
                    if (participantSocket && participantSocket.user) {
                        callLog.participants.push({
                            userId: participantSocket.user.userId,
                            joinedAt: new Date()
                        });
                    }
                }
            }

            await callLog.save();

            io.to(roomId).emit('call-started', {
                roomId: roomId,
                startedBy: userId,
                callLogId: callLog._id
            });
        } catch (error) {
            logger.error('Error starting call:', error);
            socket.emit('error', { message: 'Failed to start call' });
        }
    });

    // Accept a call
    socket.on('call-accept', (data) => {
        try {
            const { roomId, roomType } = data;
            const userId = socket.user.userId;

            socket.to(roomId).emit('call-accepted', {
                acceptedBy: userId,
                roomId: roomId
            });
        } catch (error) {
            logger.error('Error accepting call:', error);
            socket.emit('error', { message: 'Failed to accept call' });
        }
    });

    // Reject a call
    socket.on('call-reject', (data) => {
        try {
            const { roomId, roomType } = data;
            const userId = socket.user.userId;

            socket.to(roomId).emit('call-rejected', {
                rejectedBy: userId,
                roomId: roomId
            });
        } catch (error) {
            logger.error('Error rejecting call:', error);
            socket.emit('error', { message: 'Failed to reject call' });
        }
    });

    // Handle WebRTC signaling - offer
    socket.on('offer', (data) => {
        try {
            const { roomId, offer, senderId, targetSocketId } = data;
            
            // Broadcast offer to other participants in the room
            socket.to(roomId).emit('offer', {
                offer,
                senderId
            });
            // Also emit to specific WebRTC event
            socket.to(roomId).emit('webrtc-offer-received', {
                offer,
                senderId
            });
        } catch (error) {
            logger.error('Error handling offer:', error);
            socket.emit('error', { message: 'Failed to send offer' });
        }
    });

    // Handle WebRTC signaling - answer
    socket.on('answer', (data) => {
        try {
            const { roomId, answer, senderId, targetSocketId } = data;
            
            // Send answer to the specific target participant
            socket.to(targetSocketId).emit('answer', {
                answer,
                senderId
            });
            // Also emit to specific WebRTC event
            socket.to(targetId).emit('webrtc-answer-received', {
                answer,
                senderId
            });
        } catch (error) {
            logger.error('Error handling answer:', error);
            socket.emit('error', { message: 'Failed to send answer' });
        }
    });

    // Handle ICE candidates
    socket.on('ice-candidate', (data) => {
        try {
            const { roomId, candidate, senderId, targetSocketId } = data;
            
            // Forward ICE candidate to target participant
            if (targetSocketId) {
                socket.to(targetSocketId).emit('ice-candidate', {
                    candidate,
                    senderId
                });
                // Also emit to specific WebRTC event
                socket.to(targetId).emit('webrtc-ice-candidate-received', {
                    candidate,
                    senderId
                });
            } else {
                // Broadcast to all other participants in the room
                socket.to(roomId).emit('ice-candidate', {
                    candidate,
                    senderId
                });
                // Also emit to specific WebRTC event
                socket.to(roomId).emit('webrtc-ice-candidate-received', {
                    candidate,
                    senderId
                });
            }
        } catch (error) {
            logger.error('Error handling ICE candidate:', error);
            socket.emit('error', { message: 'Failed to send ICE candidate' });
        }
    });

    // Handle mute/unmute events
    socket.on('audio-toggle', (data) => {
        try {
            const { roomId, muted } = data;
            const userId = socket.user.userId;
            
            socket.to(roomId).emit('audio-toggle', {
                userId,
                muted
            });
        } catch (error) {
            logger.error('Error handling audio toggle:', error);
        }
    });

    socket.on('video-toggle', (data) => {
        try {
            const { roomId, videoEnabled } = data;
            const userId = socket.user.userId;
            
            socket.to(roomId).emit('video-toggle', {
                userId,
                videoEnabled
            });
        } catch (error) {
            logger.error('Error handling video toggle:', error);
        }
    });

    // Handle screen sharing toggle
    socket.on('screen-share-toggle', (data) => {
        try {
            const { roomId, sharing } = data;
            const userId = socket.user.userId;
            
            socket.to(roomId).emit('screen-share-toggle', {
                userId,
                sharing
            });
        } catch (error) {
            logger.error('Error handling screen share toggle:', error);
        }
    });

    // Handle mute participant (therapist only)
    socket.on('mute-user', async (data) => {
        try {
            const { roomId, userIdToMute, roomType } = data;
            const userId = socket.user.userId;

            // Only therapist can mute users
            if (roomType === 'session') {
                const session = await Session.findById(roomId);
                if (session && session.therapistId.toString() !== userId) {
                    socket.emit('error', { message: 'Only therapist can mute participants' });
                    return;
                }
            } else if (roomType === 'group') {
                const groupSession = await GroupSession.findById(roomId);
                if (groupSession && groupSession.therapistId.toString() !== userId) {
                    socket.emit('error', { message: 'Only therapist can mute participants' });
                    return;
                }
            }

            socket.to(userIdToMute).emit('mute-request', {
                muted: true
            });

            socket.to(roomId).emit('user-muted', {
                userId: userIdToMute,
                mutedBy: userId
            });
        } catch (error) {
            logger.error('Error muting user:', error);
            socket.emit('error', { message: 'Failed to mute user' });
        }
    });

    // Handle end call (therapist only)
    socket.on('end-call', async (data) => {
        try {
            const { roomId, roomType } = data;
            const userId = socket.user.userId;

            // Only therapist can end the call
            if (roomType === 'session') {
                const session = await Session.findById(roomId);
                if (session && session.therapistId.toString() !== userId) {
                    socket.emit('error', { message: 'Only therapist can end the call' });
                    return;
                }
            } else if (roomType === 'group') {
                const groupSession = await GroupSession.findById(roomId);
                if (groupSession && groupSession.therapistId.toString() !== userId) {
                    socket.emit('error', { message: 'Only therapist can end the call' });
                    return;
                }
            }

            // Update call log
            const callLog = await CallLog.findOne({
                [roomType === 'group' ? 'groupSessionId' : 'sessionId']: roomId,
                status: 'active'
            }).sort({ callStartedAt: -1 });

            if (callLog) {
                callLog.callEndedAt = new Date();
                callLog.duration = (new Date() - callLog.callStartedAt) / 1000; // Duration in seconds
                callLog.status = 'completed';

                // Update participant durations
                const room = io.sockets.adapter.rooms.get(roomId);
                if (room) {
                    for (const participantId of room) {
                        const participantSocket = io.sockets.sockets.get(participantId);
                        if (participantSocket && participantSocket.user) {
                            const participantIndex = callLog.participants.findIndex(
                                p => p.userId.toString() === participantSocket.user.userId.toString()
                            );
                            if (participantIndex !== -1) {
                                callLog.participants[participantIndex].leftAt = new Date();
                                callLog.participants[participantIndex].duration =
                                    (callLog.callEndedAt - callLog.participants[participantIndex].joinedAt) / 1000;
                            } else {
                                // Add participant who joined after call started
                                callLog.participants.push({
                                    userId: participantSocket.user.userId,
                                    joinedAt: callLog.callStartedAt, // Assume they joined when call started
                                    leftAt: new Date(),
                                    duration: (new Date() - callLog.callStartedAt) / 1000
                                });
                            }
                        }
                    }
                }

                await callLog.save();
            }

            io.to(roomId).emit('call-ended', {
                endedBy: userId,
                message: 'Call ended by therapist',
                initiatorRole: socket.user.role // Send the role of who initiated the termination
            });
        } catch (error) {
            logger.error('Error ending call:', error);
            socket.emit('error', { message: 'Failed to end call' });
        }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        logger.info(`Socket ${socket.id} disconnected from video call`);
        
        // Update call log if call is active - execute as promise to avoid blocking
        (async () => {
            try {
                // Find all rooms the user was in
                for (const [roomId, room] of io.sockets.adapter.rooms) {
                    if (room.has(socket.id)) {
                        const userId = socket.user?.userId;
                        if (userId) {
                            // Determine if it's a session or group room by checking room type
                            // For simplicity, we'll check both possibilities
                            let roomType = null;

                            // Check if this room corresponds to a session
                            const session = await Session.findById(roomId);
                            if (session) {
                                roomType = 'session';
                            } else {
                                // Check if this room corresponds to a group session
                                const groupSession = await GroupSession.findById(roomId);
                                if (groupSession) {
                                    roomType = 'group';
                                }
                            }

                            if (roomType) {
                                // Update call log if call is active
                                const activeCallLog = await CallLog.findOne({
                                    [roomType === 'group' ? 'groupSessionId' : 'sessionId']: roomId,
                                    status: 'active'
                                }).sort({ callStartedAt: -1 });

                                if (activeCallLog) {
                                    const participantIndex = activeCallLog.participants.findIndex(
                                        p => p.userId.toString() === userId
                                    );

                                    if (participantIndex !== -1) {
                                        activeCallLog.participants[participantIndex].leftAt = new Date();
                                        activeCallLog.participants[participantIndex].duration =
                                            (new Date() - activeCallLog.participants[participantIndex].joinedAt) / 1000;
                                        await activeCallLog.save();
                                    }
                                }

                                // Notify others in the room
                                socket.to(roomId).emit('participant-left', {
                                    userId: userId,
                                    roomId: roomId,
                                    roomType: roomType
                                });
                            }
                        }
                    }
                }
            } catch (error) {
                logger.error('Error handling disconnect:', error);
            }
        })();

        // Note: Socket.io automatically removes user from rooms on disconnect
    });

    // Group call specific events
    socket.on('group-call-start', async (data) => {
        try {
            const { groupSessionId } = data;
            const userId = socket.user.userId;

            const groupSession = await GroupSession.findById(groupSessionId);

            if (!groupSession) {
                socket.emit('error', { message: 'Group session not found' });
                return;
            }

            // Only therapist can start group call
            if (groupSession.therapistId.toString() !== userId) {
                socket.emit('error', { message: 'Only therapist can start group call' });
                return;
            }

            // Broadcast to all participants in the group room
            socket.to(groupSessionId).emit('group-call-started', {
                groupSessionId,
                startedBy: userId,
                timestamp: new Date()
            });

            logger.info(`Group call started for session ${groupSessionId} by user ${userId}`);
        } catch (error) {
            logger.error('Error starting group call:', error);
            socket.emit('error', { message: 'Failed to start group call' });
        }
    });

    socket.on('group-call-end', async (data) => {
        try {
            const { groupSessionId } = data;
            const userId = socket.user.userId;

            const groupSession = await GroupSession.findById(groupSessionId);

            if (!groupSession) {
                socket.emit('error', { message: 'Group session not found' });
                return;
            }

            // Only therapist can end group call
            if (groupSession.therapistId.toString() !== userId) {
                socket.emit('error', { message: 'Only therapist can end group call' });
                return;
            }

            // Broadcast to all participants
            socket.to(groupSessionId).emit('group-call-ended', {
                groupSessionId,
                endedBy: userId,
                timestamp: new Date()
            });

            logger.info(`Group call ended for session ${groupSessionId} by user ${userId}`);
        } catch (error) {
            logger.error('Error ending group call:', error);
            socket.emit('error', { message: 'Failed to end group call' });
        }
    });

    socket.on('participant-muted', async (data) => {
        try {
            const { groupSessionId, userId, isMuted } = data;
            const therapistId = socket.user.userId;

            const groupSession = await GroupSession.findById(groupSessionId);

            if (!groupSession) {
                socket.emit('error', { message: 'Group session not found' });
                return;
            }

            // Only therapist can mute participants
            if (groupSession.therapistId.toString() !== therapistId) {
                socket.emit('error', { message: 'Only therapist can mute participants' });
                return;
            }

            // Broadcast to all participants
            socket.to(groupSessionId).emit('participant-status-changed', {
                userId,
                isMuted,
                isVideoOff: data.isVideoOff || false,
                changedBy: therapistId
            });

            logger.info(`Participant ${userId} ${isMuted ? 'muted' : 'unmuted'} in group session ${groupSessionId}`);
        } catch (error) {
            logger.error('Error muting participant:', error);
            socket.emit('error', { message: 'Failed to update participant status' });
        }
    });

    socket.on('screen-share-start', async (data) => {
        try {
            const { groupSessionId, userId } = data;

            // Broadcast screen share start to other participants
            socket.to(groupSessionId).emit('participant-screen-sharing', {
                userId,
                isSharing: true,
                timestamp: new Date()
            });

            logger.info(`User ${userId} started screen sharing in group session ${groupSessionId}`);
        } catch (error) {
            logger.error('Error handling screen share start:', error);
        }
    });

    socket.on('screen-share-stop', async (data) => {
        try {
            const { groupSessionId, userId } = data;

            // Broadcast screen share stop to other participants
            socket.to(groupSessionId).emit('participant-screen-sharing', {
                userId,
                isSharing: false,
                timestamp: new Date()
            });

            logger.info(`User ${userId} stopped screen sharing in group session ${groupSessionId}`);
        } catch (error) {
            logger.error('Error handling screen share stop:', error);
        }
    });
};

module.exports = setupVideoCallHandlers;
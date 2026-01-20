const Session = require('../models/Session.model');
const User = require('../models/User.model');
const logger = require('../utils/logger');

// Function to setup video call socket handlers
const setupVideoCallHandlers = (io, socket) => {
    // Join a video call room
    socket.on('join-video-call', async (data) => {
        try {
            const { sessionId } = data;
            const userId = socket.user.userId;
            
            // Verify session exists and user has access
            const session = await Session.findById(sessionId)
                .populate('userId')
                .populate('therapistId');
                
            if (!session) {
                socket.emit('error', { message: 'Session not found' });
                return;
            }

            // Check if user has permission to join the call
            const isUser = session.userId && session.userId._id.toString() === userId;
            const isTherapist = session.therapistId && session.therapistId._id.toString() === userId;
            
            if (!isUser && !isTherapist) {
                socket.emit('error', { message: 'Unauthorized to join this session' });
                return;
            }

            // Add user to the video call room
            socket.join(sessionId);
            logger.info(`User ${userId} joined video call room ${sessionId}`);

            // Notify others in the room
            socket.to(sessionId).emit('participant-joined', {
                userId: userId,
                sessionId: sessionId,
                isTherapist: isTherapist,
                isUser: isUser
            });

            // Emit success event
            socket.emit('joined-call', {
                success: true,
                sessionId: sessionId,
                message: 'Successfully joined video call'
            });
        } catch (error) {
            logger.error('Error joining video call:', error);
            socket.emit('error', { message: 'Failed to join video call' });
        }
    });

    // Leave a video call room
    socket.on('leave-video-call', (data) => {
        try {
            const { sessionId } = data;
            const userId = socket.user.userId;
            
            socket.leave(sessionId);
            logger.info(`User ${userId} left video call room ${sessionId}`);

            socket.to(sessionId).emit('participant-left', {
                userId: userId,
                sessionId: sessionId
            });

            socket.emit('left-call', {
                success: true,
                message: 'Successfully left video call'
            });
        } catch (error) {
            logger.error('Error leaving video call:', error);
            socket.emit('error', { message: 'Failed to leave video call' });
        }
    });

    // Handle WebRTC signaling - offer
    socket.on('offer', (data) => {
        try {
            const { sessionId, offer, senderId } = data;
            
            // Broadcast offer to other participants in the room
            socket.to(sessionId).emit('offer', {
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
            const { sessionId, answer, senderId, targetId } = data;
            
            // Send answer to the specific target participant
            socket.to(targetId).emit('answer', {
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
            const { sessionId, candidate, senderId, targetId } = data;
            
            // Forward ICE candidate to target participant
            if (targetId) {
                socket.to(targetId).emit('ice-candidate', {
                    candidate,
                    senderId
                });
            } else {
                // Broadcast to all other participants in the room
                socket.to(sessionId).emit('ice-candidate', {
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
            const { sessionId, muted } = data;
            const userId = socket.user.userId;
            
            socket.to(sessionId).emit('audio-toggle', {
                userId,
                muted
            });
        } catch (error) {
            logger.error('Error handling audio toggle:', error);
        }
    });

    socket.on('video-toggle', (data) => {
        try {
            const { sessionId, videoEnabled } = data;
            const userId = socket.user.userId;
            
            socket.to(sessionId).emit('video-toggle', {
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
            const { sessionId, sharing } = data;
            const userId = socket.user.userId;
            
            socket.to(sessionId).emit('screen-share-toggle', {
                userId,
                sharing
            });
        } catch (error) {
            logger.error('Error handling screen share toggle:', error);
        }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        logger.info(`Socket ${socket.id} disconnected from video call`);
        
        // Notify rooms that user has disconnected
        // Note: Socket.io automatically removes user from rooms on disconnect
    });
};

module.exports = setupVideoCallHandlers;
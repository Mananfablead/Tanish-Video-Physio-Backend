const Session = require('../models/Session.model');
const User = require('../models/User.model');
const GroupSession = require('../models/GroupSession.model');
const CallLog = require('../models/CallLog.model');
const ChatMessage = require('../models/ChatMessage.model'); // Add ChatMessage model
const logger = require('../utils/logger');
const mongoose = require('mongoose');
const { createGoogleMeetEvent } = require('../utils/googleMeet.utils');

// SOCKET MODULE LOADED - Backend restart detected
console.log('🔌 Video Call Socket Handler Loaded:', new Date().toISOString());
console.log('✅ Dual-collection lookup for group sessions is ACTIVE');

// Room-based participant registry
// Map<roomId, Map<socketId, Participant>>
const roomParticipants = new Map();

// Production-grade waiting room storage
// Structure: Map<sessionId, Array<{ userId, socketId, name, role, requestedAt }>>
// Designed to be easily replaceable with Redis
const waitingRooms = new Map();

// Helper function to get waiting room
const getWaitingRoom = (sessionId) => {
    if (!waitingRooms.has(sessionId)) {
        waitingRooms.set(sessionId, []);
    }
    return waitingRooms.get(sessionId);
};

// Helper function to add patient to waiting room
const addPatientToWaitingRoom = (sessionId, patient) => {
    const waitingRoom = getWaitingRoom(sessionId);
    const existingIndex = waitingRoom.findIndex(p => p.userId === patient.userId);
    
    if (existingIndex === -1) {
        waitingRoom.push(patient);
        logger.info(`Added patient ${patient.userId} to waiting room for session ${sessionId}`);
    } else {
        // Update existing patient info
        waitingRoom[existingIndex] = patient;
        logger.info(`Updated patient ${patient.userId} in waiting room for session ${sessionId}`);
    }
    
    return patient;
};

// Helper function to remove patient from waiting room
const removePatientFromWaitingRoom = (sessionId, userId) => {
    const waitingRoom = getWaitingRoom(sessionId);
    const patientIndex = waitingRoom.findIndex(p => p.userId === userId);
    
    if (patientIndex !== -1) {
        const [removedPatient] = waitingRoom.splice(patientIndex, 1);
        logger.info(`Removed patient ${userId} from waiting room for session ${sessionId}`);
        
        // Clean up empty waiting rooms
        if (waitingRoom.length === 0) {
            waitingRooms.delete(sessionId);
        }
        
        return removedPatient;
    }
    return null;
};

// Helper function to get all waiting patients
const getWaitingPatients = (sessionId) => {
    return getWaitingRoom(sessionId);
};

// Helper function to check if patient is in waiting room
const isPatientInWaitingRoom = (sessionId, userId) => {
    const waitingRoom = getWaitingRoom(sessionId);
    return waitingRoom.some(p => p.userId === userId);
};

// Helper function to check if patient has been approved (in video room registry)
const isPatientApproved = (sessionId, userId) => {
    const videoRoomParticipants = getAllParticipantsInRoom(sessionId);
    return videoRoomParticipants.some(p => p.userId === userId);
};



// Helper function to get room participants
const getRoomParticipants = (roomId) => {
    if (!roomParticipants.has(roomId)) {
        roomParticipants.set(roomId, new Map());
    }
    return roomParticipants.get(roomId);
};

// Helper function to add participant to room
const addParticipantToRoom = (roomId, socketId, participant) => {
    const room = getRoomParticipants(roomId);
    room.set(socketId, participant);
    logger.info(`Added participant ${socketId} to room ${roomId}`);
    return participant;
};

// Helper function to remove participant from room
const removeParticipantFromRoom = (roomId, socketId) => {
    const room = getRoomParticipants(roomId);
    const participant = room.get(socketId);
    if (participant) {
        room.delete(socketId);
        logger.info(`Removed participant ${socketId} from room ${roomId}`);
        return participant;
    }
    return null;
};

// Helper function to get all participants in room
const getAllParticipantsInRoom = (roomId) => {
    const room = getRoomParticipants(roomId);
    return Array.from(room.values());
};

// Function to setup video call socket handlers
const setupVideoCallHandlers = (io, socket) => {
    // Handle patient request to join waiting room
    // Handle join video session for chat messaging
    socket.on('join-video-session', async (data) => {
        try {
            const { sessionId } = data;
            if (!sessionId) {
                socket.emit('error', { message: 'Session ID is required' });
                return;
            }
    
            // Join the session room for messaging
            socket.join(sessionId);
            logger.info(`User ${socket.user.userId} joined video session room: ${sessionId}`);
    
            // Also join a prefixed room for video call specific messaging
            const videoRoomId = `video-call-${sessionId}`;
            socket.join(videoRoomId);
            logger.info(`User ${socket.user.userId} joined video call room: ${videoRoomId}`);
    
            socket.emit('joined-video-session', {
                sessionId: sessionId,
                message: 'Successfully joined video session'
            });
        } catch (error) {
            logger.error('Error joining video session:', error);
            // Don't emit error to client for non-critical issues like invalid ObjectId format
            console.log(`Join video session error (non-blocking):`, error.message);
        }
    });
    
    // Handle patient request to join waiting room (supports 1-on-1 and group)
    socket.on('request-to-join', async (data) => {
        try {
            const { sessionId } = data; // For groups, this can be the groupSessionId
            const userId = socket.user.userId;
            
            if (!sessionId) {
                socket.emit('error', { message: 'Session ID is required' });
                return;
            }

            let isGroupWaiting = false;

            // Verify session exists and user has access
            // 1) Try to find a regular Session by MongoDB _id
            let session = await Session.findById(sessionId)
                .populate('userId')
                .populate('therapistId');

            // 2) If not found, try to find by custom sessionId field
            if (!session) {
                logger.warn(`Session not found by _id ${sessionId}, trying sessionId field...`);
                session = await Session.findOne({ sessionId: sessionId })
                    .populate('userId')
                    .populate('therapistId');
                
                if (session) {
                    logger.info(`Found session by sessionId field: ${sessionId}`);
                }
            }

            // 3) If we have a Session that belongs to a group, mark as group waiting
            if (session && session.groupSessionId) {
                isGroupWaiting = true;
                logger.info(`Session ${session._id} belongs to group ${session.groupSessionId} - using group waiting room`);
            }

            // 4) If still not found at all, treat this as a GROUP waiting-room using GroupSession directly
            if (!session) {
                logger.warn(`Session not found, checking GroupSession collection for ID: ${sessionId}`);
                const groupSession = await GroupSession.findById(sessionId)
                    .populate('therapistId')
                    .populate('participants.userId');

                if (groupSession) {
                    isGroupWaiting = true;
                    session = groupSession;
                    logger.info(`Found group session for waiting room: ${sessionId}`);
                }
            }

            if (!session) {
                socket.emit('error', { message: 'Session not found. Please verify the session ID is correct.' });
                return;
            }

            // Check if user is authorized to join this session/group
            const isUser = !isGroupWaiting && session.userId && session.userId._id.toString() === userId;
            const isTherapist = session.therapistId && session.therapistId._id.toString() === userId;
            const isAdmin = socket.user.role === 'admin';

            // For 1-on-1 sessions, enforce strict auth (user/therapist/admin).
            // For group waiting rooms, allow any authenticated user to enter the waiting room;
            // actual participation is gated later by approval and group join checks.
            if (!isUser && !isTherapist && !isAdmin) {
                if (!isGroupWaiting) {
                    socket.emit('error', { message: 'Unauthorized to join this session' });
                    return;
                } else {
                    logger.warn(`Allowing user ${userId} into group waiting room ${sessionId} without direct session membership (will be validated on approval/join).`);
                }
            }

            // Check status (for group, allow same statuses)
            if (session.status !== 'pending' && session.status !== 'scheduled' && session.status !== 'live') {
                socket.emit('error', { message: 'Session is not active at this time' });
                return;
            }

            // Compute canonical waiting key:
            // - For regular sessions: use the Session _id (session._id)
            // - For group sessions: always use the GroupSession _id (groupSession._id),
            //   whether we got here via GroupSession or Session.groupSessionId
            let waitingKey = sessionId;
            if (isGroupWaiting) {
                // For group flows we ALWAYS want the canonical GroupSession _id as the waiting key
                if (session instanceof mongoose.Model && session.collection.name === GroupSession.collection.name) {
                    waitingKey = session._id.toString();
                } else if (session.groupSessionId) {
                    // Session document that references a GroupSession
                    waitingKey = session.groupSessionId.toString();
                }
            } else if (session && session._id) {
                // Pure 1-on-1: use Session _id
                waitingKey = session._id.toString();
            }

            // Create standardized waiting room patient object
            const waitingPatient = {
                userId: userId,
                socketId: socket.id,
                name: socket.user.name && socket.user.name !== 'Clinician' && socket.user.name !== 'User Unknown' 
                    ? socket.user.name 
                    : (socket.user.firstName && socket.user.lastName ? 
                        `${socket.user.firstName} ${socket.user.lastName}` : null) ||
                    socket.user.displayName || socket.user.email || `User ${userId.substring(0, 5)}`,
                role: socket.user.role,
                email: socket.user.email,
                sessionId: waitingKey, // normalized key used by both admin and patient
                requestedAt: new Date().toISOString()
            };

            // Add patient to waiting room, keyed by canonical waitingKey
            addPatientToWaitingRoom(waitingKey, waitingPatient);

            // Join the waiting room socket room for real-time notifications
            const waitingRoomId = `waiting-room-${waitingKey}`;
            socket.join(waitingRoomId);

            // Update session status to 'pending' if it's currently 'scheduled'
            if (session.status === 'scheduled') {
                await Session.findByIdAndUpdate(sessionId, { status: 'pending' });
                logger.info(`Updated session ${sessionId} status from scheduled to pending`);
            }

            // Get all waiting patients to send to newly joined admins/therapists
            const allWaitingPatients = getWaitingPatients(waitingKey);
            
            // Notify therapist and all admins in the waiting room
            const therapistId = session.therapistId._id.toString();
            let notificationCount = 0;
            
            for (let [socketId, clientSocket] of io.sockets.sockets) {
                if (clientSocket.user && 
                    (clientSocket.user.userId === therapistId || clientSocket.user.role === 'admin')) {
                    
                    // Join them to the waiting room if they're not already in it
                    if (!clientSocket.rooms.has(waitingRoomId)) {
                        clientSocket.join(waitingRoomId);
                        logger.info(`📧 Auto-joined ${clientSocket.user.role} ${clientSocket.user.userId} to waiting room ${waitingRoomId}`);
                    }
                    
                    // Send the complete waiting list to ensure no missed patients
                    clientSocket.emit('waiting-list', {
                        sessionId: waitingKey,
                        patients: allWaitingPatients
                    });
                    
                    // Also send individual notification for the new patient
                    clientSocket.emit('patient-waiting', {
                        patient: waitingPatient,
                        sessionId: sessionId
                    });
                    
                    notificationCount++;
                    logger.info(`📧 Notified ${clientSocket.user.role} ${clientSocket.user.userId} about waiting patient`);
                }
            }
            
            logger.info(`✅ Notified ${notificationCount} therapist/admin(s) about waiting patient ${waitingPatient.userId}`);

            // Send confirmation to patient
            socket.emit('waiting-room-joined', {
                success: true,
                message: 'You have been added to the waiting room. Please wait for the therapist to admit you.',
                sessionId: waitingKey
            });

            logger.info(`Patient ${userId} joined waiting room for session ${waitingKey}`);
        } catch (error) {
            logger.error('Error handling request-to-join:', error);
            socket.emit('error', { message: 'Failed to join waiting room' });
        }
    });

    // Handle admin approval of patient
    socket.on('approve-patient', async (data) => {
        try {
            const { sessionId, patientSocketId } = data;
            const adminId = socket.user.userId;

            if (!sessionId || !patientSocketId) {
                socket.emit('error', { message: 'Session ID and patient socket ID are required' });
                return;
            }

            // Verify admin role
            if (socket.user.role !== 'admin' && socket.user.role !== 'therapist') {
                socket.emit('error', { message: 'Only admins or therapists can approve patients' });
                return;
            }

            // Verify session or group session exists
            let session = await Session.findById(sessionId);
            let groupSession = null;
            
            if (!session) {
                // For group flows, sessionId may already be the GroupSession _id
                logger.info(`Session not found by _id ${sessionId}, checking GroupSession collection...`);
                groupSession = await GroupSession.findById(sessionId)
                    .populate('therapistId')
                    .populate('participants.userId');
                if (groupSession) {
                    logger.info(`✅ Found GroupSession for approval: ${groupSession._id} with ${groupSession.participants?.length || 0} participants`);
                } else {
                    socket.emit('error', { message: 'Session not found' });
                    return;
                }
            }

            // For group sessions, ensure max participants is not exceeded and record acceptance
            const isGroupSession = (session && (session.sessionType === 'group' || session.type === 'group')) || !!groupSession;
            if (isGroupSession) {
                // Use whichever document we have (Session or GroupSession) to check capacity
                const capacitySource = session || groupSession;
                const targetUserId = io.sockets.sockets.get(patientSocketId)?.user?.userId;
                
                logger.info(`📊 Group session capacity check:`);
                logger.info(`   - Capacity source: ${capacitySource.constructor.name}`);
                logger.info(`   - Max participants: ${capacitySource.maxParticipants}`);
                logger.info(`   - Target user ID: ${targetUserId}`);
                
                // Check if the patient being approved is already in the participants list
                const alreadyParticipant = (capacitySource.participants || []).some(
                    p => p.userId.toString() === targetUserId && p.status === 'accepted'
                );
                
                logger.info(`   - Already participant: ${alreadyParticipant}`);
                
                // Only check capacity if patient is not already an accepted participant
                if (!alreadyParticipant) {
                    // Count UNIQUE accepted participants (by userId)
                    const uniqueAcceptedUserIds = new Set();
                    const acceptedCount = (capacitySource.participants || []).filter(p => {
                        if (p.status !== 'accepted' || !p.userId) return false;
                        const userIdStr = p.userId.toString();
                        if (uniqueAcceptedUserIds.has(userIdStr)) return false; // Skip duplicates
                        uniqueAcceptedUserIds.add(userIdStr);
                        return true;
                    }).length;
                    
                    const maxPatients = capacitySource.maxParticipants || 0;
                    logger.info(`   - Unique accepted count: ${acceptedCount}/${maxPatients}`);
                    
                    if (maxPatients > 0 && acceptedCount >= maxPatients) {
                        logger.error(`❌ Group session is full - rejecting approval`);
                        socket.emit('error', { message: 'Group session is already full' });
                        return;
                    }
                } else {
                    logger.info(`✅ Patient is already an accepted participant - skipping capacity check`);
                }
            }

            // Get the patient's socket to verify they're still connected
            const targetPatientSocket = io.sockets.sockets.get(patientSocketId);
            if (!targetPatientSocket) {
                socket.emit('error', { message: 'Patient is no longer connected' });
                return;
            }

            // Verify patient is in waiting room
            const waitingPatient = removePatientFromWaitingRoom(sessionId, targetPatientSocket.user.userId);
            if (!waitingPatient) {
                socket.emit('error', { message: 'Patient not found in waiting room' });
                return;
            }

            // Persist approval in session and/or group session document for group sessions
            if (isGroupSession) {
                const targetUserId = targetPatientSocket.user.userId;

                logger.info(`📝 Persisting approval for user ${targetUserId} in group session`);

                // 1) Update Session document if it exists
                if (session) {
                    const participantIndex = (session.participants || []).findIndex(
                        p => p.userId.toString() === targetUserId
                    );

                    if (participantIndex === -1) {
                        logger.info(`   ➕ Adding new participant to Session document`);
                        session.participants = session.participants || [];
                        session.participants.push({
                            userId: targetUserId,
                            bookingId: null,
                            status: 'accepted'
                        });
                    } else {
                        logger.info(`   ✏️ Updating existing participant status to 'accepted'`);
                        session.participants[participantIndex].status = 'accepted';
                    }

                    await session.save();
                    logger.info(`✅ Session document updated`);
                }

                // 2) Also update GroupSession participants, since group join-room checks this
                const effectiveGroupSession = groupSession || (session && session.groupSessionId
                    ? await GroupSession.findById(session.groupSessionId)
                    : null);

                if (effectiveGroupSession) {
                    logger.info(`📋 Updating GroupSession ${effectiveGroupSession._id}`);
                    
                    // Check if user is already in GroupSession participants (prevent duplicates)
                    const existingParticipantIndex = (effectiveGroupSession.participants || []).findIndex(
                        p => p.userId && p.userId.toString() === targetUserId
                    );
                    
                    if (existingParticipantIndex === -1) {
                        // User not in GroupSession yet - add them
                        logger.info(`   ➕ Adding new participant to GroupSession document`);
                        effectiveGroupSession.participants.push({
                            userId: targetUserId,
                            status: 'accepted',
                            joinedAt: new Date()
                        });
                    } else {
                        // User already exists - just update status to accepted
                        logger.info(`   ✏️ Updating existing participant status to 'accepted' in GroupSession`);
                        effectiveGroupSession.participants[existingParticipantIndex].status = 'accepted';
                        // Also update joinedAt if not set
                        if (!effectiveGroupSession.participants[existingParticipantIndex].joinedAt) {
                            effectiveGroupSession.participants[existingParticipantIndex].joinedAt = new Date();
                        }
                    }

                    await effectiveGroupSession.save();
                    logger.info(`✅ GroupSession document updated`);
                    
                    // Log final participant count for verification
                    const finalUniqueCount = new Set(effectiveGroupSession.participants
                        .filter(p => p.status === 'accepted')
                        .map(p => p.userId.toString())
                    ).size;
                    logger.info(`📊 Final GroupSession stats: ${effectiveGroupSession.participants.length} total entries, ${finalUniqueCount} unique accepted participants`);
                } else {
                    logger.warn(`⚠️ No GroupSession document found to update`);
                }
            }

            // Add participant to video room registry FIRST
            const participant = {
                socketId: patientSocketId,
                userId: waitingPatient.userId,
                name: waitingPatient.name,
                role: waitingPatient.role,
                email: waitingPatient.email,
                isTherapist: false,
                isUser: true,
                joinedAt: new Date().toISOString()
            };

            // For group sessions, use the groupSessionId as the room ID
            const videoRoomId = isGroupSession ? (groupSession?._id || session?.groupSessionId || sessionId) : sessionId;
            
            console.log(`✅ Adding participant ${participant.userId} to video room registry`);
            console.log(`📋 Video room ID: ${videoRoomId}`);
            console.log(`📋 Is group session: ${isGroupSession}`);
            console.log(`📋 Current video room participants before add:`, getAllParticipantsInRoom(videoRoomId));
            addParticipantToRoom(videoRoomId, patientSocketId, participant);
            console.log(`📋 Video room participants after add:`, getAllParticipantsInRoom(videoRoomId));

            // Move patient from waiting room to video room
            const approvalWaitingRoomId = `waiting-room-${sessionId}`;
            const actualVideoRoomId = `video-call-${videoRoomId}`;
            
            targetPatientSocket.leave(approvalWaitingRoomId);
            targetPatientSocket.join(actualVideoRoomId);

            // Longer delay to ensure registry update is fully processed
            setTimeout(() => {
                console.log(`🕒 Sending approval notification after delay for user ${waitingPatient.userId}`);
                // Notify the approved patient with group session info if applicable
                const joinData = {
                    sessionId: sessionId,
                    approvedBy: adminId,
                    message: 'Your request to join has been approved. Redirecting to video call...',
                    groupSessionId: isGroupSession ? videoRoomId : undefined
                };
                
                console.log(`📤 Sending join-approved event:`, joinData);
                targetPatientSocket.emit('join-approved', joinData);
            }, 500);

            // Notify admin of successful approval
            socket.emit('patient-approved-success', {
                patient: waitingPatient,
                sessionId: sessionId
            });

            logger.info(`Admin ${adminId} approved patient ${waitingPatient.userId} for session ${sessionId}`);
        } catch (error) {
            logger.error('Error handling approve-patient:', error);
            socket.emit('error', { message: 'Failed to approve patient' });
        }
    });

    // Handle admin rejection of patient
    socket.on('reject-patient', async (data) => {
        try {
            const { sessionId, patientSocketId, reason = 'Request rejected by therapist' } = data;
            const adminId = socket.user.userId;

            if (!sessionId || !patientSocketId) {
                socket.emit('error', { message: 'Session ID and patient socket ID are required' });
                return;
            }

            // Verify admin role
            if (socket.user.role !== 'admin' && socket.user.role !== 'therapist') {
                socket.emit('error', { message: 'Only admins or therapists can reject patients' });
                return;
            }

            // Remove patient from waiting room
            const waitingPatient = removePatientFromWaitingRoom(sessionId, patientSocketId);
            if (!waitingPatient) {
                socket.emit('error', { message: 'Patient not found in waiting room' });
                return;
            }

            // Get the patient's socket
            const targetPatientSocket = io.sockets.sockets.get(patientSocketId);
            if (targetPatientSocket) {
                // Notify the rejected patient
                targetPatientSocket.emit('join-rejected', {
                    sessionId: sessionId,
                    rejectedBy: adminId,
                    reason: reason
                });

                // Remove from waiting room
                const rejectionWaitingRoomId = `waiting-room-${sessionId}`;
                targetPatientSocket.leave(rejectionWaitingRoomId);
            }

            // Notify admin of successful rejection
            socket.emit('patient-rejected-success', {
                patient: waitingPatient,
                sessionId: sessionId,
                reason: reason
            });

            logger.info(`Admin ${adminId} rejected patient ${waitingPatient.userId} for session ${sessionId}`);
        } catch (error) {
            logger.error('Error handling reject-patient:', error);
            socket.emit('error', { message: 'Failed to reject patient' });
        }
    });

    // Handle approved patient joining video room (1-on-1 and group)
    socket.on('join-video-room', async (data) => {
        try {
            console.log(`📥 join-video-room event received from ${socket.id}:`, data);
            console.log(`📥 Socket user:`, socket.user);
            const { sessionId, groupSessionId } = data;
            const userId = socket.user.userId;
            console.log(`📥 User ID from socket: ${userId}`);

            // Determine if this is a group or 1-on-1 join
            const isGroupJoin = !!groupSessionId;
            const roomId = isGroupJoin ? groupSessionId : sessionId;

            if (!roomId) {
                socket.emit('error', { message: 'Session ID is required' });
                return;
            }

            if (isGroupJoin) {
                // GROUP SESSION JOIN AFTER APPROVAL
                console.log(`🔍 Handling approved GROUP join for groupSessionId ${roomId}`);

                // Verify group session exists and user is allowed
                const groupSession = await GroupSession.findById(roomId)
                    .populate('therapistId')
                    .populate('participants.userId');

                if (!groupSession) {
                    socket.emit('error', { message: 'Group session not found' });
                    return;
                }

                const isTherapist = groupSession.therapistId && groupSession.therapistId._id.toString() === userId;
                const isParticipant = Array.isArray(groupSession.participants)
                    ? groupSession.participants.some(p => p.userId && p.userId._id.toString() === userId && p.status === 'accepted')
                    : false;
                const isAdmin = socket.user.role === 'admin';

                if (!isTherapist && !isParticipant && !isAdmin) {
                    socket.emit('error', { message: 'Unauthorized to join this group session' });
                    return;
                }

                // Join the group room (use groupSessionId as room)
                const videoRoomId = roomId;
                socket.join(videoRoomId);

                const participant = {
                    socketId: socket.id,
                    userId: userId,
                    name: socket.user.name && socket.user.name !== 'Clinician' && socket.user.name !== 'User Unknown' 
                        ? socket.user.name 
                        : (socket.user.firstName && socket.user.lastName ? 
                            `${socket.user.firstName} ${socket.user.lastName}` : null) ||
                        socket.user.displayName || socket.user.email || `User ${userId.substring(0, 5)}`,
                    role: socket.user.role,
                    email: socket.user.email,
                    isTherapist: isTherapist,
                    isUser: isParticipant,
                    joinedAt: new Date().toISOString()
                };

                // Add participant to room registry
                addParticipantToRoom(videoRoomId, socket.id, participant);

                const currentParticipants = getAllParticipantsInRoom(videoRoomId);

                socket.emit('room-participants', {
                    participants: currentParticipants,
                    roomId: videoRoomId,
                    roomType: 'group'
                });

                socket.to(videoRoomId).emit('participant-joined', participant);

                socket.emit('joined-video-room', {
                    success: true,
                    roomId: videoRoomId,
                    message: 'Successfully joined group video room'
                });

                logger.info(`User ${userId} joined group video room ${videoRoomId}`);
                return;
            }

            // ORIGINAL 1-ON-1 LOGIC
            if (!sessionId) {
                socket.emit('error', { message: 'Session ID is required' });
                return;
            }

            // Verify session exists
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
            const isAdmin = socket.user.role === 'admin';

            if (!isUser && !isTherapist && !isAdmin) {
                socket.emit('error', { message: 'Unauthorized to join this session' });
                return;
            }

            // Check if patient was approved (should be in video room registry)
            const videoRoomParticipants = getAllParticipantsInRoom(sessionId);
            console.log(`🔍 Checking approval for user ${userId} in session ${sessionId}`);
            console.log(`📋 Video room participants:`, JSON.stringify(videoRoomParticipants, null, 2));
            console.log(`🎯 Looking for userId: ${userId}`);
            
            let isApproved = false;
            let existingParticipant = null;
            
            // Look for the user in the registry by userId (not socketId, since it might change after redirect)
            for (const participant of videoRoomParticipants) {
                const match = participant.userId === userId;
                console.log(`🔄 Checking participant: ${JSON.stringify(participant)} - Match: ${match}`);
                if (match) {
                    isApproved = true;
                    existingParticipant = participant;
                    break;
                }
            }
            
            // If user was approved but socket ID has changed (after redirect), update the registry
            if (isApproved && existingParticipant && existingParticipant.socketId !== socket.id) {
                console.log(`🔄 Updating socket ID for approved user ${userId} from ${existingParticipant.socketId} to ${socket.id}`);
                
                // Remove the old entry and add the new one with updated socket ID
                removeParticipantFromRoom(sessionId, existingParticipant.socketId);
                
                // Create updated participant with new socket ID
                const updatedParticipant = {
                    ...existingParticipant,
                    socketId: socket.id
                };
                
                addParticipantToRoom(sessionId, socket.id, updatedParticipant);
                console.log(`✅ Updated participant registry with new socket ID`);
            }
            
            console.log(`✅ User ${userId} approved status: ${isApproved}`);
            console.log(`📊 Debug - isUser: ${isUser}, isTherapist: ${isTherapist}, isAdmin: ${isAdmin}`);

            if (!isApproved && !isTherapist && !isAdmin) {
                const errorMsg = `You must be approved by the therapist to join the video call. User ${userId} not found in video room registry for session ${sessionId}`;
                console.log(`❌ Approval error: ${errorMsg}`);
                console.log(`📊 Debug info - isUser: ${isUser}, isTherapist: ${isTherapist}, isAdmin: ${isAdmin}`);
                console.log(`🕒 Current timestamp: ${new Date().toISOString()}`);
                
                // Give approved patients a brief grace period
                if (socket.__APPROVAL_ATTEMPT__) {
                    console.log(`🔄 Retrying approval check for approved patient`);
                    socket.emit('error', { 
                        message: 'Still processing approval. Please wait...',
                        retry: true
                    });
                    return;
                }
                
                socket.__APPROVAL_ATTEMPT__ = true;
                socket.emit('error', { 
                    message: errorMsg,
                    redirect: `/waiting-room?sessionId=${sessionId}`
                });
                return;
            }

            // Join the unified video call room
            const videoRoomId = `video-call-${sessionId}`;
            socket.join(videoRoomId);

            // Create standardized participant object
            const participant = {
                socketId: socket.id,
                userId: userId,
                name: socket.user.name && socket.user.name !== 'Clinician' && socket.user.name !== 'User Unknown' 
                    ? socket.user.name 
                    : (socket.user.firstName && socket.user.lastName ? 
                        `${socket.user.firstName} ${socket.user.lastName}` : null) ||
                    socket.user.displayName || socket.user.email || `User ${userId.substring(0, 5)}`,
                role: socket.user.role,
                email: socket.user.email,
                isTherapist: isTherapist || (session.therapistId && session.therapistId._id.toString() === userId),
                isUser: isUser,
                joinedAt: new Date().toISOString()
            };

            // Add participant to room registry if not already there
            if (!isApproved) {
                addParticipantToRoom(sessionId, socket.id, participant);
            }

            // Get all current participants in the video room
            const currentParticipants = getAllParticipantsInRoom(sessionId);

            // Send full participant list to joining client
            socket.emit('room-participants', {
                participants: currentParticipants,
                roomId: sessionId,
                roomType: 'session'
            });

            // Notify others in the room about new participant
            socket.to(videoRoomId).emit('participant-joined', participant);

            // Emit success event
            socket.emit('joined-video-room', {
                success: true,
                roomId: sessionId,
                message: 'Successfully joined video room'
            });

            logger.info(`User ${userId} joined video room ${sessionId}`);
        } catch (error) {
            logger.error('Error joining video room:', error);
            socket.emit('error', { message: 'Failed to join video room' });
        }
    });

    // Admin ready event - when admin opens the video page
    socket.on('admin-ready', ({ sessionId }) => {
        try {
            if (!sessionId) {
                socket.emit('error', { message: 'Session ID is required' });
                return;
            }

            // Join the waiting room (uses same canonical key as request-to-join)
            const adminWaitingRoomId = `waiting-room-${sessionId}`;
            socket.join(adminWaitingRoomId);
            
            logger.info(`📧 Admin ${socket.user.userId} joined waiting room ${adminWaitingRoomId}`);

            // Send current waiting patients list
            const waitingPatients = getWaitingPatients(sessionId);
            
            socket.emit('waiting-list', {
                sessionId: sessionId,
                patients: waitingPatients
            });

            logger.info(`📧 Sent waiting list with ${waitingPatients.length} patients to admin ${socket.user.userId}`);
        } catch (error) {
            logger.error('Error handling admin-ready:', error);
            socket.emit('error', { message: 'Failed to initialize admin waiting room' });
        }
    });

    // Debug: Get connected users
    socket.on('get-connected-users', (callback) => {
        try {
            const connectedUsers = [];
            for (let [socketId, clientSocket] of io.sockets.sockets) {
                if (clientSocket.user) {
                    connectedUsers.push({
                        socketId: socketId,
                        userId: clientSocket.user.userId,
                        role: clientSocket.user.role,
                        name: clientSocket.user.name || clientSocket.user.firstName + ' ' + clientSocket.user.lastName
                    });
                }
            }
            logger.info(`Connected users: ${JSON.stringify(connectedUsers, null, 2)}`);
            if (callback) callback(connectedUsers);
        } catch (error) {
            logger.error('Error getting connected users:', error);
            if (callback) callback([]);
        }
    });

    // Get waiting patients for admin dashboard
    socket.on('get-waiting-patients', async (data) => {
        try {
            const { sessionId } = data;
            
            if (!sessionId) {
                socket.emit('error', { message: 'Session ID is required' });
                return;
            }

            // Verify admin role
            if (socket.user.role !== 'admin' && socket.user.role !== 'therapist') {
                socket.emit('error', { message: 'Only admins or therapists can view waiting patients' });
                return;
            }

            const waitingPatients = getWaitingPatients(sessionId);
            
            socket.emit('waiting-patients-list', {
                sessionId: sessionId,
                patients: waitingPatients
            });
        } catch (error) {
            logger.error('Error getting waiting patients:', error);
            socket.emit('error', { message: 'Failed to get waiting patients' });
        }
    });
    // Join a video call room (both 1-on-1 and group)
    socket.on('join-room', async (data) => {
        try {
            const { sessionId, groupSessionId } = data;
            
            // LOG EVERYTHING for debugging
            // FIX APPLIED: 2026-03-16 - Added dual-collection lookup for group sessions
            logger.info(`=== JOIN-ROOM REQUEST RECEIVED ===`);
            logger.info(`Socket ID: ${socket.id}`);
            logger.info(`User ID: ${socket.user.userId}`);
            logger.info(`User Role: ${socket.user.role}`);
            logger.info(`Request data:`, JSON.stringify(data, null, 2));
            logger.info(`sessionId: ${sessionId}`);
            logger.info(`groupSessionId: ${groupSessionId}`);
            
            // If this is a special non-session room (support/admin/notifications), join and return early
            const specialRoom = (id) => typeof id === 'string' && (id.startsWith('support-') || id === 'admin-support-room' || id === 'admin_notifications' || id === 'default-chat-room');
            if (specialRoom(sessionId) || specialRoom(groupSessionId)) {
                const roomId = sessionId || groupSessionId;
                socket.join(roomId);
                logger.info(`User ${socket.user.userId} joined special non-video room ${roomId}`);
                socket.to(roomId).emit('user-joined', { userId: socket.user.userId, sessionId: roomId });
                return;
            }
            const userId = socket.user.userId;
            
            let roomType, roomInfo;
            let isUser = false, isTherapist = false, isParticipant = false;

            // Determine if it's a 1-on-1 or group session
            if (sessionId) {
                // 1-on-1 session
                roomType = 'session';
                logger.info(`Processing as 1-on-1 session with ID: ${sessionId}`);
                
                // Verify session exists and user has access
                // First try to find by MongoDB _id
                let session = await Session.findById(sessionId)
                    .populate('userId')
                    .populate('therapistId');

                // If not found, try to find by custom sessionId field
                if (!session) {
                    logger.warn(`Session not found by _id ${sessionId}, trying sessionId field...`);
                    session = await Session.findOne({ sessionId: sessionId })
                        .populate('userId')
                        .populate('therapistId');
                    
                    if (session) {
                        logger.info(`Found session by sessionId field: ${sessionId}`);
                    } else {
                        logger.error(`❌ Session still not found after checking both _id and sessionId fields`);
                        logger.error(`Session collection stats:`);
                        const sessionCount = await Session.countDocuments();
                        logger.error(`Total sessions in DB: ${sessionCount}`);
                        if (sessionCount > 0) {
                            const sampleSessions = await Session.find().limit(5).select('_id sessionId');
                            logger.error(`Sample sessions:`, JSON.stringify(sampleSessions, null, 2));
                        }
                    }
                }

                if (!session) {
                    logger.error(`🛑 Emitting "Session not found" error to client`);
                    socket.emit('error', { message: 'Session not found. Please verify the session ID is correct.' });
                    return;
                }

                // Check if user has permission to join the call
                isUser = session.userId && session.userId._id.toString() === userId;
                const isParticipant = Array.isArray(session.participants)
                    ? session.participants.some(p => p.userId.toString() === userId && p.status === 'accepted')
                    : false;
                isTherapist = session.therapistId && session.therapistId._id.toString() === userId;
                const isAdmin = socket.user.role === 'admin';

                // Attach group indicator for later logic
                const isGroupSession = session.sessionType === 'group' || session.type === 'group';

                // Check if patient was approved (should be in video room registry)
                const videoRoomParticipants = getAllParticipantsInRoom(sessionId);
                console.log(`🔍 Checking approval for user ${userId} in session ${sessionId}`);
                console.log(`📋 Video room participants:`, JSON.stringify(videoRoomParticipants, null, 2));
                console.log(`🎯 Looking for userId: ${userId}`);
                
                let isApproved = false;
                let existingParticipant = null;
                
                // Look for the user in the registry by userId (not socketId, since it might change after redirect)
                for (const participant of videoRoomParticipants) {
                    if (participant.userId === userId) {
                        isApproved = true;
                        existingParticipant = participant;
                        console.log(`🔄 Found existing participant: ${JSON.stringify(participant)}`);
                        break;
                    }
                }
                
                // If user was approved but socket ID has changed (after redirect), update the registry
                if (isApproved && existingParticipant && existingParticipant.socketId !== socket.id) {
                    console.log(`🔄 Updating socket ID for approved user ${userId} from ${existingParticipant.socketId} to ${socket.id}`);
                    
                    // Remove the old entry and add the new one with updated socket ID
                    removeParticipantFromRoom(sessionId, existingParticipant.socketId);
                    
                    // Create updated participant with new socket ID
                    const updatedParticipant = {
                        ...existingParticipant,
                        socketId: socket.id
                    };
                    
                    addParticipantToRoom(sessionId, socket.id, updatedParticipant);
                    console.log(`✅ Updated participant registry with new socket ID`);
                }
                
                // Check if this is an approved patient joining via waiting room (special case)
                const isApprovedPatient = data.userType === 'approved-patient';
                
                // Allow approved patients to join directly
                if (isUser && socket.user.role === 'patient' && !isApproved && !isApprovedPatient) {
                    // Check if the patient has been approved but is trying to join via the wrong endpoint
                    const hasBeenApproved = isPatientApproved(sessionId, userId);
                    const isInWaitingRoom = isPatientInWaitingRoom(sessionId, userId);
                    
                    if (hasBeenApproved) {
                        // Patient has been approved but is trying to join via join-room instead of join-video-room
                        // This might be a timing issue - redirect to use the correct endpoint
                        console.log(`🔄 Patient ${userId} was approved but trying to join via wrong endpoint, redirecting to join-video-room`);
                        // Let the join-video-room handler take care of this
                        socket.emit('error', { 
                            message: 'Processing your approval, please wait...',
                            retry: true
                        });
                        return;
                    } else if (isInWaitingRoom) {
                        // Patient is still in waiting room, meaning they haven't been approved yet
                        socket.emit('error', { 
                            message: 'Patients must join through the waiting room first. Please navigate to the waiting room.',
                            redirect: `/waiting-room?sessionId=${sessionId}`
                        });
                    } else {
                        // Patient is not in waiting room and not approved - they need to go through waiting room
                        socket.emit('error', { 
                            message: 'Patients must join through the waiting room first. Please navigate to the waiting room.',
                            redirect: `/waiting-room?sessionId=${sessionId}`
                        });
                    }
                    return;
                }

                // Allow admins and therapists to join for monitoring purposes
                if (!isUser && !isTherapist && !isAdmin) {
                    socket.emit('error', { message: 'Unauthorized to join this session' });
                    return;
                }

                roomInfo = session;

                // Check session status
                if (session.status !== 'scheduled' && session.status !== 'live' && session.status !== 'pending') {
                    socket.emit('error', { message: 'Session is not active at this time' });
                    return;
                }

                // Check if call has started within the valid time frame
                const now = new Date();
                const sessionTime = new Date(session.startTime);

                // Allow joining 24 hours before and 60 minutes after session start time
                if (now < new Date(sessionTime.getTime() - 24 * 60 * 60000) || now > new Date(sessionTime.getTime() + 60 * 60000)) {
                    socket.emit('error', { message: 'Session is not active at this time' });
                    return;
                }
            } else if (groupSessionId) {
                // Group session
                roomType = 'group';
                logger.info(`Processing as GROUP session with ID: ${groupSessionId}`);

                // Verify group session exists and user has access
                logger.info(`Searching for group session by _id: ${groupSessionId}`);
                let groupSession = await GroupSession.findById(groupSessionId)
                    .populate('therapistId')
                    .populate('participants.userId');

                // If not found in GroupSession collection, check if it exists in Session collection as a reference
                if (!groupSession) {
                    logger.warn(`Group session not found by _id: ${groupSessionId}, checking Session collection...`);
                    const sessionWithGroupRef = await Session.findOne({ groupSessionId: groupSessionId })
                        .populate('therapistId')
                        .populate('userId');
                    
                    if (sessionWithGroupRef) {
                        logger.info(`Found session referencing groupSessionId: ${groupSessionId}`);
                        // Retrieve the actual group session using the reference
                        groupSession = await GroupSession.findById(sessionWithGroupRef.groupSessionId)
                            .populate('therapistId')
                            .populate('participants.userId');
                        
                        if (groupSession) {
                            logger.info(`✅ Successfully retrieved group session via Session reference: ${groupSessionId}`);
                        }
                    }
                }

                if (!groupSession) {
                    logger.error(`❌ Group session not found by _id: ${groupSessionId}`);
                    logger.error(`GroupSession collection stats:`);
                    const groupCount = await GroupSession.countDocuments();
                    logger.error(`Total group sessions in DB: ${groupCount}`);
                    if (groupCount > 0) {
                        const sampleGroups = await GroupSession.find().limit(5).select('_id title');
                        logger.error(`Sample group sessions:`, JSON.stringify(sampleGroups, null, 2));
                    }
                    socket.emit('error', { message: 'Group session not found. Please verify the group session ID is correct.' });
                    return;
                }
                
                logger.info(`✅ Found group session: ${groupSession.title || 'Untitled'}`);

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

                // Check if max participants reached (maxParticipants counts patients; therapist is extra)
                const activeParticipants = Array.from(io.sockets.adapter.rooms.get(groupSessionId) || []).length;
                const maxAllowed = (groupSession.maxParticipants || 0) + 1;
                if (activeParticipants >= maxAllowed && !isTherapist) {
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
                const sessionTime = new Date(groupSession.startTime);

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

            // Create standardized participant object
            const participant = {
                socketId: socket.id,
                userId: userId,
                name: socket.user.name && socket.user.name !== 'Clinician' && socket.user.name !== 'User Unknown' 
                    ? socket.user.name 
                    : (socket.user.firstName && socket.user.lastName ? 
                        `${socket.user.firstName} ${socket.user.lastName}` : null) ||
                    socket.user.displayName || socket.user.email || `User ${userId.substring(0, 5)}`,
                role: socket.user.role,
                email: socket.user.email,
                isTherapist: isTherapist || (roomInfo.therapistId && roomInfo.therapistId._id.toString() === userId),
                isUser: isUser || isParticipant,
                joinedAt: new Date().toISOString()
            };

            // Add participant to room registry
            addParticipantToRoom(roomId, socket.id, participant);

            // Get all current participants in the room
            const currentParticipants = getAllParticipantsInRoom(roomId);

            // Send full participant list to joining client
            socket.emit('room-participants', {
                participants: currentParticipants,
                roomId: roomId,
                roomType: roomType
            });

            // Notify others in the room about new participant
            socket.to(roomId).emit('participant-joined', participant);

            // Update call log if call is active
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
            // const userId = socket.user.userId;
            
            socket.leave(roomId);
            logger.info(`User ${userId} left ${roomType} room ${roomId}`);

            // Remove participant from room registry
            const removedParticipant = removeParticipantFromRoom(roomId, socket.id);
            
            // Notify others in the room
            if (removedParticipant) {
                socket.to(roomId).emit('participant-left', {
                    socketId: socket.id,
                    userId: userId,
                    roomId: roomId,
                    roomType: roomType
                });
            }

            // Update call log if call is active
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

            // Update session status to 'live'
            if (roomType === 'session') {
                await Session.findByIdAndUpdate(roomId, { status: 'live' });
                logger.info(`Updated session ${roomId} status to live`);
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

            // Automatically start recording when call starts
            callLog.recordingStatus = 'recording';
            callLog.recordingStartTime = new Date();
            await callLog.save();

            // If this is a 1-on-1 session, generate Google Meet link when session goes live
            if (roomType === 'session') {
                try {
                    const session = await Session.findById(roomId).populate('userId').populate('therapistId');
                    if (session) {
                        // ONLY use Google Calendar API - no fallback
                        try {
                            // Create Google Meet event through Google Calendar API
                            const googleMeetData = await createGoogleMeetEvent({
                                sessionId: roomId,
                                startTime: new Date().toISOString(),
                                endTime: new Date(Date.now() + (session.duration || 60) * 60 * 1000).toISOString(),
                                userName: session.userId?.name || 'Patient',
                                userEmail: session.userId?.email || '',
                                therapistName: session.therapistId?.name || 'Therapist',
                                therapistEmail: session.therapistId?.email || '',
                                summary: `Physiotherapy Session - ${session.therapistId?.name || 'Therapist'}`
                            });

                            // Update session with Google Meet details from Calendar API
                            await Session.findByIdAndUpdate(
                                roomId,
                                {
                                    status: 'live',
                                    startTime: new Date(),
                                    googleMeetLink: googleMeetData.googleMeetLink,
                                    googleMeetCode: googleMeetData.googleMeetCode,
                                    googleMeetExpiresAt: googleMeetData.googleMeetExpiresAt,
                                    googleMeetEventId: googleMeetData.googleMeetEventId
                                },
                                { new: true, runValidators: true }
                            );

                            logger.info(`Session ${roomId} status updated to live with Google Calendar Meet link: ${googleMeetData.googleMeetLink}`);
                        } catch (calendarError) {
                            // ONLY Google Calendar API - no fallback
                            logger.error('Google Calendar API failed - cannot generate Google Meet link:', calendarError);

                            // Update session status but without Google Meet link
                            await Session.findByIdAndUpdate(
                                roomId,
                                {
                                    status: 'live',
                                    startTime: new Date()
                                },
                                { new: true, runValidators: true }
                            );

                            logger.warn(`Session ${roomId} status updated to live but Google Meet link generation failed`);
                        }
                    }
                } catch (sessionUpdateError) {
                    logger.error('Error updating session status:', sessionUpdateError);
                }
            }

            io.to(roomId).emit('call-started', {
                roomId: roomId,
                startedBy: userId,
                callLogId: callLog._id,
                recordingStarted: true
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

    // Handle video call chat messages
    socket.on('send-video-message', async (data) => {
        try {
            console.log(`📨 Video call message received:`, data);
            const { sessionId, message, senderId, attachments = [] } = data;

            // Join the unified video call room for messaging
            const videoRoomId = `video-call-${sessionId}`;

            console.log(`📨 Sending video message from ${senderId} in room ${videoRoomId}:`, message);

            // Save message to database with video-call-chat type
            const senderType = socket.user.role === 'therapist' || socket.user.role === 'admin' ? 'therapist' : 'user';

            const chatMessageData = {
                sessionId: sessionId,
                senderId: socket.user.userId,
                senderType: senderType,
                message: message,
                messageType: 'video-call-chat', // Use specific type for video call messages
                attachments: attachments
            };

            // If there are attachments, update the message text
            if (attachments && attachments.length > 0) {
                chatMessageData.message = attachments.length > 1 ? '📎 Multiple attachments' : '📎 File attachment';
            }

            const chatMessage = new ChatMessage(chatMessageData);

            await chatMessage.save();
            await chatMessage.populate('senderId', 'name');

            console.log(`💾 Video call message saved to DB: ${chatMessage._id}`);
            console.log(`💾 Saved message details:`, {
                sessionId: chatMessage.sessionId,
                senderId: chatMessage.senderId._id || chatMessage.senderId,
                senderName: chatMessage.senderId.name,
                message: chatMessage.message,
                messageType: chatMessage.messageType,
                timestamp: chatMessage.createdAt,
                attachments: chatMessage.attachments?.length || 0
            });

            // Create standardized message payload
            const messagePayload = {
                message: chatMessage.message,
                senderId: socket.user.userId,
                senderName: chatMessage.senderId.name || socket.user.name || `User ${socket.user.userId.substring(0, 5)}`,
                timestamp: chatMessage.createdAt.toISOString(),
                attachments: chatMessage.attachments || [],
                messageId: chatMessage.messageId || chatMessage._id.toString()
            };

            console.log(`📨 Broadcasting message to room ${videoRoomId}:`, messagePayload);
            
            // Broadcast message to ALL OTHER participants (not sender)
            socket.to(videoRoomId).emit('receive-video-message', messagePayload);
            
            // Send confirmation back to sender with full details
            socket.emit('receive-video-message', {
                ...messagePayload,
                senderName: messagePayload.senderName
            });

            console.log(`✅ Message broadcast to room ${videoRoomId}`);
        } catch (error) {
            console.error('❌ Error handling video message:', error);
            socket.emit('error', { message: 'Failed to send message' });
        }
    });

    // Handle request to establish peer connection in group calls
    socket.on('request-peer-connection', (data) => {
        try {
            const { roomId, targetUserId, targetSocketId } = data;
            
            console.log(`🔗 Peer connection request received:`, data);
            
            // Get the target socket
            const targetSocket = io.sockets.sockets.get(targetSocketId);
            if (!targetSocket) {
                console.warn(`⚠️ Target socket not found: ${targetSocketId}`);
                return;
            }
            
            // Notify both parties to create peer connections
            // This triggers the WebRTC handshake process
            socket.emit('create-peer-connection', {
                targetUserId,
                targetSocketId,
                initiator: true // This socket will create the offer
            });
            
            targetSocket.emit('create-peer-connection', {
                targetUserId: socket.user.userId,
                targetSocketId: socket.id,
                initiator: false // Target will receive the offer
            });
            
            console.log(`✅ Peer connection setup initiated between ${socket.id} and ${targetSocketId}`);
        } catch (error) {
            logger.error('Error handling request-peer-connection:', error);
            socket.emit('error', { message: 'Failed to establish peer connection' });
        }
    });

    // Handle WebRTC signaling - offer
    socket.on('offer', (data) => {
        try {
            const { roomId, offer, senderId } = data;
            
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
            const { roomId, answer, senderId, targetId } = data;
            
            // Send answer to the specific target participant
            socket.to(targetId).emit('answer', {
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
            const { roomId, candidate, senderId, targetId } = data;
            
            // Forward ICE candidate to target participant
            if (targetId) {
                socket.to(targetId).emit('ice-candidate', {
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

            // Update session status to 'completed'
            // if (roomType === 'session') {
            //     await Session.findByIdAndUpdate(roomId, { status: 'completed' });
            //     logger.info(`Updated session ${roomId} status to completed`);
            // }

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
        logger.info(`Socket ${socket.id} disconnected`);
        
        // Remove participant from all rooms they were in
        (async () => {
            try {
                const userId = socket.user?.userId;
                if (!userId) return;

                // Clean up waiting room entries
                for (const [sessionId, waitingRoom] of waitingRooms) {
                    // Check if any patient in this waiting room matches this socket
                    const patientInWaitingRoom = waitingRoom.find(p => p.socketId === socket.id);
                    if (patientInWaitingRoom) {
                        const removedPatient = removePatientFromWaitingRoom(sessionId, socket.id);
                        if (removedPatient) {
                            logger.info(`Removed disconnected patient ${userId} from waiting room ${sessionId}`);
                            
                            // Notify therapist/admin about patient disconnect
                            const session = await Session.findById(sessionId).populate('therapistId');
                            if (session) {
                                const therapistId = session.therapistId._id.toString();
                                for (let [socketId, clientSocket] of io.sockets.sockets) {
                                    if (clientSocket.user && 
                                        (clientSocket.user.userId === therapistId || clientSocket.user.role === 'admin')) {
                                        clientSocket.emit('patient-disconnected', {
                                            patient: removedPatient,
                                            sessionId: sessionId
                                        });
                                    }
                                }
                            }
                        }
                    }
                }

                // Clean up video room entries
                for (const [roomId, room] of io.sockets.adapter.rooms) {
                    if (room.has(socket.id)) {
                        // Remove from room registry
                        const removedParticipant = removeParticipantFromRoom(roomId, socket.id);
                        
                        // Notify others in the room
                        if (removedParticipant) {
                            socket.to(roomId).emit('participant-left', {
                                socketId: socket.id,
                                userId: userId,
                                roomId: roomId
                            });
                        }

                        // Update call log if call is active
                        let roomType = null;
                        
                        // Determine room type
                        const session = await Session.findById(roomId);
                        if (session) {
                            roomType = 'session';
                        } else {
                            const groupSession = await GroupSession.findById(roomId);
                            if (groupSession) {
                                roomType = 'group';
                            }
                        }

                        if (roomType) {
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
            const userRole = socket.user.role;

            const groupSession = await GroupSession.findById(groupSessionId);

            if (!groupSession) {
                socket.emit('error', { message: 'Group session not found' });
                return;
            }

            // Only therapist or admin can end group call
            const isTherapist = groupSession.therapistId.toString() === userId;
            const isAdmin = userRole === 'admin';
            
            if (!isTherapist && !isAdmin) {
                socket.emit('error', { message: 'Only therapist or admin can end group call' });
                return;
            }

            // Broadcast to all participants
            socket.to(groupSessionId).emit('group-call-ended', {
                groupSessionId,
                endedBy: userId,
                timestamp: new Date()
            });

            logger.info(`Group call ended for session ${groupSessionId} by user ${userId} (${userRole})`);
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
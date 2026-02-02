const GroupSession = require('../models/GroupSession.model');
const User = require('../models/User.model');
const { validationResult } = require('express-validator');

// Create a new group session
const createGroupSession = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { title, description, startTime, endTime, maxParticipants } = req.body;
        const therapistId = req.user.userId;

        // Validate that start time is before end time
        if (new Date(startTime) >= new Date(endTime)) {
            return res.status(400).json({
                success: false,
                message: 'Start time must be before end time'
            });
        }

        // Create new group session
        const groupSession = new GroupSession({
            title,
            description,
            therapistId,
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            maxParticipants
        });

        await groupSession.save();

        res.status(201).json({
            success: true,
            message: 'Group session created successfully',
            data: groupSession
        });
    } catch (error) {
        console.error('Error creating group session:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get all group sessions for a therapist
const getGroupSessions = async (req, res) => {
    try {
        const { status, date } = req.query;
        const therapistId = req.user.userId;

        // Build query
        let query = { therapistId };

        if (status) {
            query.status = status;
        }

        if (date) {
            const startDate = new Date(date);
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 1);

            query.startTime = {
                $gte: startDate,
                $lt: endDate
            };
        }

        const groupSessions = await GroupSession.find(query)
            .populate('therapistId', 'firstName lastName email')
            .populate('participants.userId', 'firstName lastName email')
            .sort({ startTime: -1 });

        res.status(200).json({
            success: true,
            data: groupSessions
        });
    } catch (error) {
        console.error('Error fetching group sessions:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get a specific group session by ID
const getGroupSessionById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        const groupSession = await GroupSession.findById(id)
            .populate('therapistId', 'firstName lastName email')
            .populate('participants.userId', 'firstName lastName email');

        if (!groupSession) {
            return res.status(404).json({
                success: false,
                message: 'Group session not found'
            });
        }

        // Check if user is therapist or participant
        const isTherapist = groupSession.therapistId._id.toString() === userId;
        const isParticipant = groupSession.participants.some(
            p => p.userId._id.toString() === userId && p.status === 'accepted'
        );

        if (!isTherapist && !isParticipant) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        res.status(200).json({
            success: true,
            data: groupSession
        });
    } catch (error) {
        console.error('Error fetching group session:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Update a group session
const updateGroupSession = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, startTime, endTime, maxParticipants, status } = req.body;
        const therapistId = req.user.userId;

        const groupSession = await GroupSession.findById(id);

        if (!groupSession) {
            return res.status(404).json({
                success: false,
                message: 'Group session not found'
            });
        }

        if (groupSession.therapistId.toString() !== therapistId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Update fields if provided
        if (title) groupSession.title = title;
        if (description) groupSession.description = description;
        if (startTime) groupSession.startTime = new Date(startTime);
        if (endTime) groupSession.endTime = new Date(endTime);
        if (maxParticipants) groupSession.maxParticipants = maxParticipants;
        if (status) groupSession.status = status;

        await groupSession.save();

        res.status(200).json({
            success: true,
            message: 'Group session updated successfully',
            data: groupSession
        });
    } catch (error) {
        console.error('Error updating group session:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Delete a group session
const deleteGroupSession = async (req, res) => {
    try {
        const { id } = req.params;
        const therapistId = req.user.userId;

        const groupSession = await GroupSession.findById(id);

        if (!groupSession) {
            return res.status(404).json({
                success: false,
                message: 'Group session not found'
            });
        }

        if (groupSession.therapistId.toString() !== therapistId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        await GroupSession.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: 'Group session deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting group session:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Add participant to group session
const addParticipant = async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.body;
        const therapistId = req.user.userId;

        const groupSession = await GroupSession.findById(id);

        if (!groupSession) {
            return res.status(404).json({
                success: false,
                message: 'Group session not found'
            });
        }

        if (groupSession.therapistId.toString() !== therapistId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if user is already a participant
        const existingParticipant = groupSession.participants.find(
            p => p.userId.toString() === userId
        );

        if (existingParticipant) {
            return res.status(400).json({
                success: false,
                message: 'User is already a participant in this group session'
            });
        }

        // Add participant with pending status
        groupSession.participants.push({
            userId,
            status: 'pending'
        });

        await groupSession.save();

        res.status(200).json({
            success: true,
            message: 'Participant added successfully',
            data: groupSession
        });
    } catch (error) {
        console.error('Error adding participant:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Accept or reject participant invitation
const updateParticipantStatus = async (req, res) => {
    try {
        const { id, userId } = req.params;
        const { status } = req.body;
        const currentUserId = req.user.userId;

        const groupSession = await GroupSession.findById(id);

        if (!groupSession) {
            return res.status(404).json({
                success: false,
                message: 'Group session not found'
            });
        }

        // Check if current user is the therapist or the participant themselves
        const isTherapist = groupSession.therapistId.toString() === currentUserId;
        const isParticipant = userId === currentUserId;

        if (!isTherapist && !isParticipant) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Find the participant
        const participantIndex = groupSession.participants.findIndex(
            p => p.userId.toString() === userId
        );

        if (participantIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Participant not found in this group session'
            });
        }

        // Only therapist can accept/reject, only participant can accept their own invite
        if (isTherapist) {
            // Therapist can accept or reject
            if (!['accepted', 'rejected'].includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid status. Must be accepted or rejected'
                });
            }
        } else if (isParticipant) {
            // Participant can only accept
            if (status !== 'accepted') {
                return res.status(400).json({
                    success: false,
                    message: 'Participant can only accept the invitation'
                });
            }
        }

        // Update participant status
        groupSession.participants[participantIndex].status = status;
        groupSession.participants[participantIndex].updatedAt = new Date();

        await groupSession.save();

        res.status(200).json({
            success: true,
            message: 'Participant status updated successfully',
            data: groupSession
        });
    } catch (error) {
        console.error('Error updating participant status:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Remove participant from group session
const removeParticipant = async (req, res) => {
    try {
        const { id, userId } = req.params;
        const therapistId = req.user.userId;

        const groupSession = await GroupSession.findById(id);

        if (!groupSession) {
            return res.status(404).json({
                success: false,
                message: 'Group session not found'
            });
        }

        if (groupSession.therapistId.toString() !== therapistId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        const participantIndex = groupSession.participants.findIndex(
            p => p.userId.toString() === userId
        );

        if (participantIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Participant not found in this group session'
            });
        }

        groupSession.participants.splice(participantIndex, 1);

        await groupSession.save();

        res.status(200).json({
            success: true,
            message: 'Participant removed successfully',
            data: groupSession
        });
    } catch (error) {
        console.error('Error removing participant:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get group sessions for a participant
const getGroupSessionsForParticipant = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { status } = req.query;

        // Find group sessions where user is a participant
        const groupSessions = await GroupSession.find({
            'participants.userId': userId,
            ...(status && { 'participants.status': status })
        })
            .populate('therapistId', 'firstName lastName email')
            .populate('participants.userId', 'firstName lastName email')
            .sort({ startTime: -1 });

        res.status(200).json({
            success: true,
            data: groupSessions
        });
    } catch (error) {
        console.error('Error fetching participant group sessions:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Start group call
const startGroupCall = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        const groupSession = await GroupSession.findById(id);

        if (!groupSession) {
            return res.status(404).json({
                success: false,
                message: 'Group session not found'
            });
        }

        // Only therapist can start the call
        if (groupSession.therapistId.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Only therapist can start the group call'
            });
        }

        // Check if session is within valid time window
        const now = new Date();
        const sessionStart = new Date(groupSession.startTime);
        const sessionEnd = new Date(groupSession.endTime);

        if (now < new Date(sessionStart.getTime() - 30 * 60000) || now > new Date(sessionEnd.getTime() + 60 * 60000)) {
            return res.status(400).json({
                success: false,
                message: 'Cannot start call outside session time window'
            });
        }

        // Update group session to active call
        groupSession.isActiveCall = true;
        groupSession.callStartedAt = now;
        groupSession.status = 'active';

        // Initialize current participants with accepted participants
        groupSession.currentParticipants = groupSession.participants
            .filter(p => p.status === 'accepted')
            .map(p => ({
                userId: p.userId,
                joinedAt: now,
                leftAt: null,
                isMuted: false,
                isVideoOff: false
            }));

        await groupSession.save();

        res.status(200).json({
            success: true,
            message: 'Group call started successfully',
            data: {
                groupSessionId: groupSession._id,
                isActiveCall: true,
                callStartedAt: groupSession.callStartedAt,
                participantCount: groupSession.currentParticipants.length
            }
        });
    } catch (error) {
        console.error('Error starting group call:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// End group call
const endGroupCall = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        const groupSession = await GroupSession.findById(id);

        if (!groupSession) {
            return res.status(404).json({
                success: false,
                message: 'Group session not found'
            });
        }

        // Only therapist can end the call
        if (groupSession.therapistId.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Only therapist can end the group call'
            });
        }

        // Update group session
        groupSession.isActiveCall = false;
        groupSession.callEndedAt = new Date();
        groupSession.status = 'completed';

        // Update participant leave times
        groupSession.currentParticipants = groupSession.currentParticipants.map(p => ({
            ...p,
            leftAt: p.leftAt || new Date()
        }));

        await groupSession.save();

        res.status(200).json({
            success: true,
            message: 'Group call ended successfully',
            data: {
                groupSessionId: groupSession._id,
                isActiveCall: false,
                callEndedAt: groupSession.callEndedAt,
                duration: groupSession.callEndedAt ?
                    (groupSession.callEndedAt - groupSession.callStartedAt) / 60000 : 0
            }
        });
    } catch (error) {
        console.error('Error ending group call:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get group call participants status
const getGroupCallParticipants = async (req, res) => {
    try {
        const { id } = req.params;

        const groupSession = await GroupSession.findById(id)
            .populate('currentParticipants.userId', 'firstName lastName email');

        if (!groupSession) {
            return res.status(404).json({
                success: false,
                message: 'Group session not found'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                groupSessionId: groupSession._id,
                isActiveCall: groupSession.isActiveCall,
                participants: groupSession.currentParticipants.map(p => ({
                    userId: p.userId._id || p.userId,
                    name: p.userId.firstName && p.userId.lastName ?
                        `${p.userId.firstName} ${p.userId.lastName}` :
                        p.userId.email,
                    email: p.userId.email,
                    joinedAt: p.joinedAt,
                    leftAt: p.leftAt,
                    isMuted: p.isMuted,
                    isVideoOff: p.isVideoOff,
                    isActive: !p.leftAt
                }))
            }
        });
    } catch (error) {
        console.error('Error getting group call participants:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Mute/unmute participant
const muteGroupParticipant = async (req, res) => {
    try {
        const { id } = req.params;
        const { userId, isMuted } = req.body;
        const therapistId = req.user.userId;

        const groupSession = await GroupSession.findById(id);

        if (!groupSession) {
            return res.status(404).json({
                success: false,
                message: 'Group session not found'
            });
        }

        // Only therapist can mute participants
        if (groupSession.therapistId.toString() !== therapistId) {
            return res.status(403).json({
                success: false,
                message: 'Only therapist can mute participants'
            });
        }

        // Find and update participant
        const participantIndex = groupSession.currentParticipants.findIndex(
            p => p.userId.toString() === userId
        );

        if (participantIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Participant not found in current call'
            });
        }

        groupSession.currentParticipants[participantIndex].isMuted = isMuted;
        await groupSession.save();

        res.status(200).json({
            success: true,
            message: `Participant ${isMuted ? 'muted' : 'unmuted'} successfully`,
            data: {
                userId,
                isMuted
            }
        });
    } catch (error) {
        console.error('Error muting participant:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get active group calls
const getActiveGroupCalls = async (req, res) => {
    try {
        const activeCalls = await GroupSession.find({
            isActiveCall: true,
            status: 'active'
        }).populate('therapistId', 'firstName lastName email');

        res.status(200).json({
            success: true,
            data: activeCalls.map(session => ({
                id: session._id,
                title: session.title,
                therapist: session.therapistId ?
                    `${session.therapistId.firstName} ${session.therapistId.lastName}` :
                    'Unknown Therapist',
                participantCount: session.currentParticipants.length,
                startedAt: session.callStartedAt
            }))
        });
    } catch (error) {
        console.error('Error getting active group calls:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

module.exports = {
    createGroupSession,
    getGroupSessions,
    getGroupSessionById,
    updateGroupSession,
    deleteGroupSession,
    addParticipant,
    updateParticipantStatus,
    removeParticipant,
    getGroupSessionsForParticipant,
    startGroupCall,
    endGroupCall,
    getGroupCallParticipants,
    muteGroupParticipant,
    getActiveGroupCalls
};
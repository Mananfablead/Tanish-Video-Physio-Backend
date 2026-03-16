const express = require('express');
const router = express.Router();
const { authenticateToken: auth } = require('../middlewares/auth.middleware');
const {
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
    getActiveGroupCalls,
    getAllGroupSessionsWithParticipants,
    getGroupSessionJoinLink
} = require('../controllers/groupSession.controller');



// Routes for therapists
router.post('/', auth, createGroupSession);
router.get('/', auth, getGroupSessions);
router.get('/:id', auth, getGroupSessionById);
router.put('/:id', auth, updateGroupSession);
router.delete('/:id', auth, deleteGroupSession);
router.post('/:id/participants', auth, addParticipant);
router.delete('/:id/participants/:userId', auth, removeParticipant);

// Routes for participants
router.get('/my-sessions', auth, getGroupSessionsForParticipant);
router.put('/:id/participants/:userId/status', auth, updateParticipantStatus);

// Admin endpoint: Get all group sessions with participants
router.get('/admin/all-sessions', auth, getAllGroupSessionsWithParticipants);

// Video call specific routes
router.post('/:id/start-call', auth, startGroupCall);
router.post('/:id/end-call', auth, endGroupCall);
router.get('/:id/participants-status', auth, getGroupCallParticipants);
router.post('/:id/mute-participant', auth, muteGroupParticipant);
router.get('/active-calls', auth, getActiveGroupCalls);

// Get join link for group session using groupSessionId
router.get('/join/:groupSessionId', auth, getGroupSessionJoinLink);

module.exports = router;
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
    getGroupSessionsForParticipant
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

module.exports = router;
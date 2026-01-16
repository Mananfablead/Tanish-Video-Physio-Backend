const express = require('express');
const router = express.Router();
const {
    getAllQuestionnaires,
    getActiveQuestionnaire,
    getQuestionnaireById,
    createQuestionnaire,
    updateQuestionnaire,
    updateQuestions,
    deleteQuestionnaire,
    activateQuestionnaire,
    deleteSingleQuestion  // Add the new function
} = require('../controllers/questionnaire.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');
const { isAdmin } = require('../middlewares/role.middleware');

// Public routes
router.get('/active', getActiveQuestionnaire);

// Admin routes
router.use(authenticateToken);
router.use(isAdmin);

router.route('/')
    .get(getAllQuestionnaires)
    .post(createQuestionnaire);

router.route('/:id')
    .get(getQuestionnaireById)
    .put(updateQuestionnaire)
    .delete(deleteQuestionnaire);

// Specific routes for questions management
router.put('/:id/questions', updateQuestions);
router.put('/:id/activate', activateQuestionnaire);

// Route to delete a single question by its index
router.delete('/:id/questions/:questionIndex', deleteSingleQuestion);

module.exports = router;
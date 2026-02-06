const Questionnaire = require('../models/Questionnaire.model');
const ApiResponse = require('../utils/apiResponse');

// Get all questionnaires
const getAllQuestionnaires = async (req, res, next) => {
    try {
        const questionnaires = await Questionnaire.find();
        res.status(200).json(
            ApiResponse.success(questionnaires, 'Questionnaires retrieved successfully')
        );
    } catch (error) {
        next(error);
    }
    
};

// Get active questionnaire (for client use)
const getActiveQuestionnaire = async (req, res, next) => {
    try {
        const questionnaire = await Questionnaire.findOne({ isActive: true }).sort({ createdAt: -1 });
        if (!questionnaire) {
            return res.status(404).json(
                ApiResponse.error('No active questionnaire found', 404)
            );
        }
        res.status(200).json(
            ApiResponse.success(questionnaire, 'Active questionnaire retrieved successfully')
        );
    } catch (error) {
        next(error);
    }
};

// Get single questionnaire by ID
const getQuestionnaireById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const questionnaire = await Questionnaire.findById(id);

        if (!questionnaire) {
            return res.status(404).json(
                ApiResponse.error('Questionnaire not found', 404)
            );
        }

        res.status(200).json(
            ApiResponse.success(questionnaire, 'Questionnaire retrieved successfully')
        );
    } catch (error) {
        next(error);
    }
};

// Create new questionnaire
const createQuestionnaire = async (req, res, next) => {
    try {
        const { title, description, questions, isActive } = req.body;

        // Validate required fields
        if (!title || !questions || !Array.isArray(questions)) {
            return res.status(400).json(
                ApiResponse.error('Title and questions array are required', 400)
            );
        }

        // Validate each question
        for (const question of questions) {
            if (!question.question || !question.type || question.order === undefined) {
                return res.status(400).json(
                    ApiResponse.error('Each question must have question text, type, and order', 400)
                );
            }
        }

        const questionnaire = new Questionnaire({
            title,
            description,
            questions,
            isActive: isActive !== undefined ? isActive : true
        });

        const savedQuestionnaire = await questionnaire.save();

        res.status(201).json(
            ApiResponse.success(savedQuestionnaire, 'Questionnaire created successfully')
        );
    } catch (error) {
        next(error);
    }
};

// Update questionnaire
const updateQuestionnaire = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { title, description, questions, isActive } = req.body;

        // Validate questions if provided
        if (questions && Array.isArray(questions)) {
            for (const question of questions) {
                if (!question.question || !question.type || question.order === undefined) {
                    return res.status(400).json(
                        ApiResponse.error('Each question must have question text, type, and order', 400)
                    );
                }
            }
        }

        const updatedQuestionnaire = await Questionnaire.findByIdAndUpdate(
            id,
            { title, description, questions, isActive },
            { new: true, runValidators: true }
        );

        if (!updatedQuestionnaire) {
            return res.status(404).json(
                ApiResponse.error('Questionnaire not found', 404)
            );
        }

        res.status(200).json(
            ApiResponse.success(updatedQuestionnaire, 'Questionnaire updated successfully')
        );
    } catch (error) {
        next(error);
    }
};

// Update questions in existing questionnaire (for admin interface)
const updateQuestions = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { questions } = req.body;

        if (!questions || !Array.isArray(questions)) {
            return res.status(400).json(
                ApiResponse.error('Questions array is required', 400)
            );
        }

        // Validate each question
        for (const question of questions) {
            if (!question.question || !question.type || question.order === undefined) {
                return res.status(400).json(
                    ApiResponse.error('Each question must have question text, type, and order', 400)
                );
            }
        }

        const updatedQuestionnaire = await Questionnaire.findByIdAndUpdate(
            id,
            { questions },
            { new: true, runValidators: true }
        );

        if (!updatedQuestionnaire) {
            return res.status(404).json(
                ApiResponse.error('Questionnaire not found', 404)
            );
        }

        res.status(200).json(
            ApiResponse.success(updatedQuestionnaire, 'Questions updated successfully')
        );
    } catch (error) {
        next(error);
    }
};

// Delete questionnaire
const deleteQuestionnaire = async (req, res, next) => {
    try {
        const { id } = req.params;

        const deletedQuestionnaire = await Questionnaire.findByIdAndDelete(id);

        if (!deletedQuestionnaire) {
            return res.status(404).json(
                ApiResponse.error('Questionnaire not found', 404)
            );
        }

        res.status(200).json(
            ApiResponse.success(null, 'Questionnaire deleted successfully')
        );
    } catch (error) {
        next(error);
    }
};

// Activate a questionnaire
const activateQuestionnaire = async (req, res, next) => {
    try {
        const { id } = req.params;

        // First, deactivate all other questionnaires
        await Questionnaire.updateMany({}, { isActive: false });

        // Then activate the specified one
        const updatedQuestionnaire = await Questionnaire.findByIdAndUpdate(
            id,
            { isActive: true },
            { new: true }
        );

        if (!updatedQuestionnaire) {
            return res.status(404).json(
                ApiResponse.error('Questionnaire not found', 404)
            );
        }

        res.status(200).json(
            ApiResponse.success(updatedQuestionnaire, 'Questionnaire activated successfully')
        );
    } catch (error) {
        next(error);
    }
};

// Delete a single question by its index
const deleteSingleQuestion = async (req, res, next) => {
    try {
        const { id, questionIndex } = req.params;

        // Convert questionIndex to integer
        const index = parseInt(questionIndex, 10);

        if (isNaN(index) || index < 0) {
            return res.status(400).json(
                ApiResponse.error('Invalid question index', 400)
            );
        }

        const questionnaire = await Questionnaire.findById(id);

        if (!questionnaire) {
            return res.status(404).json(
                ApiResponse.error('Questionnaire not found', 404)
            );
        }

        if (!questionnaire.questions || questionnaire.questions.length <= index) {
            return res.status(404).json(
                ApiResponse.error('Question not found at the specified index', 404)
            );
        }

        // Remove the question at the specified index
        const removedQuestion = questionnaire.questions.splice(index, 1)[0];

        // Update the order property of remaining questions to maintain sequential numbering
        questionnaire.questions.forEach((question, idx) => {
            question.order = idx + 1;
        });

        const updatedQuestionnaire = await questionnaire.save();

        res.status(200).json(
            ApiResponse.success(
                { removedQuestion, updatedQuestionnaire },
                'Question deleted successfully'
            )
        );
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAllQuestionnaires,
    getActiveQuestionnaire,
    getQuestionnaireById,
    createQuestionnaire,
    updateQuestionnaire,
    updateQuestions,
    deleteQuestionnaire,
    activateQuestionnaire,
    deleteSingleQuestion  // Export the new function
};
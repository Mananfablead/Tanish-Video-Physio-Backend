const Therapist = require('../models/Therapist.model');
const ApiResponse = require('../utils/apiResponse');

// Get all therapists
const getAllTherapists = async (req, res, next) => {
    try {
        const therapists = await Therapist.find({ status: 'active' });
        res.status(200).json(ApiResponse.success({ therapists }, 'Therapists retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Get therapist by ID
const getTherapistById = async (req, res, next) => {
    try {
        const therapist = await Therapist.findById(req.params.id);
        if (!therapist) {
            return res.status(404).json(ApiResponse.error('Therapist not found'));
        }

        res.status(200).json(ApiResponse.success({ therapist }, 'Therapist retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Create a new therapist (admin only)
const createTherapist = async (req, res, next) => {
    try {
        const therapist = new Therapist(req.body);
        await therapist.save();

        res.status(201).json(ApiResponse.success({ therapist }, 'Therapist created successfully'));
    } catch (error) {
        next(error);
    }
};

// Update therapist by ID (admin only)
const updateTherapist = async (req, res, next) => {
    try {
        const therapist = await Therapist.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!therapist) {
            return res.status(404).json(ApiResponse.error('Therapist not found'));
        }

        res.status(200).json(ApiResponse.success({ therapist }, 'Therapist updated successfully'));
    } catch (error) {
        next(error);
    }
};

// Delete therapist by ID (admin only)
const deleteTherapist = async (req, res, next) => {
    try {
        const therapist = await Therapist.findByIdAndDelete(req.params.id);
        if (!therapist) {
            return res.status(404).json(ApiResponse.error('Therapist not found'));
        }

        res.status(200).json(ApiResponse.success(null, 'Therapist deleted successfully'));
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAllTherapists,
    getTherapistById,
    createTherapist,
    updateTherapist,
    deleteTherapist
};
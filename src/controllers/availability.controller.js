const Availability = require('../models/Availability.model');
const Therapist = require('../models/Therapist.model');
const ApiResponse = require('../utils/apiResponse');

// Get all availability
const getAvailability = async (req, res, next) => {
    try {
        const availability = await Availability.find()
            .populate('therapistId', 'name specialty');

        res.status(200).json(ApiResponse.success({ availability }, 'Availability retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Get availability by therapist
const getAvailabilityByTherapist = async (req, res, next) => {
    try {
        const { therapistId } = req.params;

        // Validate therapist exists
        const therapist = await Therapist.findById(therapistId);
        if (!therapist) {
            return res.status(404).json(ApiResponse.error('Therapist not found'));
        }

        const availability = await Availability.find({ therapistId })
            .populate('therapistId', 'name specialty');

        res.status(200).json(ApiResponse.success({ availability }, 'Therapist availability retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Create availability
const createAvailability = async (req, res, next) => {
    try {
        const { therapistId, date, availableTimes } = req.body;

        // Validate therapist exists
        const therapist = await Therapist.findById(therapistId);
        if (!therapist) {
            return res.status(404).json(ApiResponse.error('Therapist not found'));
        }

        const availability = new Availability({
            therapistId,
            date,
            availableTimes
        });

        await availability.save();

        await availability.populate('therapistId', 'name specialty');

        res.status(201).json(ApiResponse.success({ availability }, 'Availability created successfully'));
    } catch (error) {
        next(error);
    }
};

// Update availability
const updateAvailability = async (req, res, next) => {
    try {
        const { availableTimes, status } = req.body;

        const availability = await Availability.findByIdAndUpdate(
            req.params.id,
            { availableTimes, status },
            { new: true, runValidators: true }
        )
            .populate('therapistId', 'name specialty');

        if (!availability) {
            return res.status(404).json(ApiResponse.error('Availability not found'));
        }

        res.status(200).json(ApiResponse.success({ availability }, 'Availability updated successfully'));
    } catch (error) {
        next(error);
    }
};

// Delete availability
const deleteAvailability = async (req, res, next) => {
    try {
        const availability = await Availability.findByIdAndDelete(req.params.id)
            .populate('therapistId', 'name specialty');

        if (!availability) {
            return res.status(404).json(ApiResponse.error('Availability not found'));
        }

        res.status(200).json(ApiResponse.success({ availability }, 'Availability deleted successfully'));
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAvailability,
    getAvailabilityByTherapist,
    createAvailability,
    updateAvailability,
    deleteAvailability
};
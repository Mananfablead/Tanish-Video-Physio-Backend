const Service = require('../models/Service.model');
const ApiResponse = require('../utils/apiResponse');

// Get all services
const getAllServices = async (req, res, next) => {
    try {
        const services = await Service.find({ status: 'active' });
        res.status(200).json(ApiResponse.success({ services }, 'Services retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Get service by ID
const getServiceById = async (req, res, next) => {
    try {
        const service = await Service.findById(req.params.id);
        if (!service) {
            return res.status(404).json(ApiResponse.error('Service not found'));
        }

        res.status(200).json(ApiResponse.success({ service }, 'Service retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Get all services (admin only)
const getAllServicesAdmin = async (req, res, next) => {
    try {
        const services = await Service.find();
        res.status(200).json(ApiResponse.success({ services }, 'All services retrieved successfully'));
    } catch (error) {
        next(error);
    }
};


// Get service by ID (admin only)
const getServiceByIdAdmin = async (req, res, next) => {
    try {
        const service = await Service.findById(req.params.id);
        if (!service) {
            return res.status(404).json(ApiResponse.error('Service not found'));
        }

        res.status(200).json(ApiResponse.success({ service }, 'Service retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Create a new service (admin only)
const createService = async (req, res, next) => {
    try {
        const service = new Service(req.body);
        await service.save();

        res.status(201).json(ApiResponse.success({ service }, 'Service created successfully'));
    } catch (error) {
        next(error);
    }
};

// Update service by ID (admin only)
const updateService = async (req, res, next) => {
    try {
        const service = await Service.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!service) {
            return res.status(404).json(ApiResponse.error('Service not found'));
        }

        res.status(200).json(ApiResponse.success({ service }, 'Service updated successfully'));
    } catch (error) {
        next(error);
    }
};

// Delete service by ID (admin only)
const deleteService = async (req, res, next) => {
    try {
        const service = await Service.findByIdAndDelete(req.params.id);
        if (!service) {
            return res.status(404).json(ApiResponse.error('Service not found'));
        }

        res.status(200).json(ApiResponse.success(null, 'Service deleted successfully'));
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAllServices,
    getServiceById,
    getAllServicesAdmin,
    getServiceByIdAdmin,
    createService,
    updateService,
    deleteService
};
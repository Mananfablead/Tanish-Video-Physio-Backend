const Service = require('../models/Service.model');
const ApiResponse = require('../utils/apiResponse');
const path = require('path');
const fs = require('fs');

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
        const { name, description, about, price, duration, category, status, features, prerequisites, benefits, contraindications } = req.body;

        // Prepare service object
        const serviceData = {
            name,
            description,
            about,
            price,
            duration,
            category,
            status,
            features: features ? JSON.parse(features) : [],
            prerequisites: prerequisites ? JSON.parse(prerequisites) : [],
            benefits: benefits ? JSON.parse(benefits) : [],
            contraindications: contraindications ? JSON.parse(contraindications) : []
        };

        // Process uploaded files if they exist
        if (req.files && Object.keys(req.files).length > 0) {
            const images = [];
            const videos = [];

            // Handle multiple images
            if (req.files['images']) {
                req.files['images'].forEach(file => {
                    images.push(`/uploads/service-images/${file.filename}`);
                });
            }

            // Handle multiple videos
            if (req.files['videos']) {
                req.files['videos'].forEach(file => {
                    videos.push(`/uploads/service-videos/${file.filename}`);
                });
            }

            serviceData.images = images;
            serviceData.videos = videos;
        }

        const service = new Service(serviceData);
        await service.save();

        res.status(201).json(ApiResponse.success({ service }, 'Service created successfully'));
    } catch (error) {
        next(error);
    }
};

// Update service by ID (admin only)
const updateService = async (req, res, next) => {
    try {
        const { name, description, about, price, duration, category, status, features, prerequisites, benefits, contraindications } = req.body;

        // Prepare update object
        const updateData = {};

        if (name) updateData.name = name;
        if (description) updateData.description = description;
        if (about !== undefined) updateData.about = about;
        if (price) updateData.price = price;
        if (duration) updateData.duration = duration;
        if (category) updateData.category = category;
        if (status) updateData.status = status;
        if (features) updateData.features = JSON.parse(features);
        if (prerequisites) updateData.prerequisites = JSON.parse(prerequisites);
        if (benefits) updateData.benefits = JSON.parse(benefits);
        if (contraindications) updateData.contraindications = JSON.parse(contraindications);

        // Process uploaded files if they exist
        if (req.files && Object.keys(req.files).length > 0) {
            // Get the current service to preserve existing media
            const currentService = await Service.findById(req.params.id);

            const images = [...(currentService.images || [])];
            const videos = [...(currentService.videos || [])];

            // Handle multiple images
            if (req.files['images']) {
                req.files['images'].forEach(file => {
                    images.push(`/uploads/service-images/${file.filename}`);
                });
            }

            // Handle multiple videos
            if (req.files['videos']) {
                req.files['videos'].forEach(file => {
                    videos.push(`/uploads/service-videos/${file.filename}`);
                });
            }

            updateData.images = images;
            updateData.videos = videos;
        }

        const service = await Service.findByIdAndUpdate(
            req.params.id,
            updateData,
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

// Remove specific media from a service
const removeMediaFromService = async (req, res, next) => {
    try {
        const { mediaType, mediaIndex } = req.body;

        const service = await Service.findById(req.params.id);
        if (!service) {
            return res.status(404).json(ApiResponse.error('Service not found'));
        }

        if (mediaType === 'image') {
            if (service.images && service.images[mediaIndex]) {
                // Optionally delete the physical file here
                service.images.splice(mediaIndex, 1);
            } else {
                return res.status(404).json(ApiResponse.error('Image not found at specified index'));
            }
        } else if (mediaType === 'video') {
            if (service.videos && service.videos[mediaIndex]) {
                // Optionally delete the physical file here
                service.videos.splice(mediaIndex, 1);
            } else {
                return res.status(404).json(ApiResponse.error('Video not found at specified index'));
            }
        } else {
            return res.status(400).json(ApiResponse.error('Invalid media type. Use "image" or "video"'));
        }

        await service.save();

        res.status(200).json(ApiResponse.success({ service }, 'Media removed successfully'));
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
    deleteService,
    removeMediaFromService
};
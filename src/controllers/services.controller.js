const Service = require('../models/Service.model');
const ApiResponse = require('../utils/apiResponse');
const path = require('path');
const fs = require('fs');
const config = require('../config/env');

// Helper function to convert relative paths to absolute URLs
const convertToAbsoluteUrls = (service) => {
    if (service.images && Array.isArray(service.images)) {
        service.images = service.images.map(imagePath =>
            imagePath.startsWith('http') ? imagePath : `${config.BASE_URL}${imagePath}`
        );
    }
    if (service.videos && Array.isArray(service.videos)) {
        service.videos = service.videos.map(videoPath =>
            videoPath.startsWith('http') ? videoPath : `${config.BASE_URL}${videoPath}`
        );
    }
    return service;
};

// Helper function to safely parse JSON
const safeJsonParse = (str, defaultValue = []) => {
    if (!str) return defaultValue;
    if (typeof str === 'string') {
        try {
            return JSON.parse(str);
        } catch (e) {
            // If it's not JSON, return as single-item array or split by common delimiters
            if (str.includes(',') || str.includes(';')) {
                return str.split(/[;,]/).map(item => item.trim()).filter(item => item);
            }
            return [str]; // Return as single-item array
        }
    }
    return str;
};

// Get all services
const getAllServices = async (req, res, next) => {
    try {
        const services = await Service.find({ status: 'active' });
        // Convert relative paths to absolute URLs
        const servicesWithAbsoluteUrls = services.map(service => convertToAbsoluteUrls(service.toObject()));
        res.status(200).json(ApiResponse.success({ services: servicesWithAbsoluteUrls }, 'Services retrieved successfully'));
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

        // Convert relative paths to absolute URLs
        const serviceWithAbsoluteUrls = convertToAbsoluteUrls(service.toObject());
        res.status(200).json(ApiResponse.success({ service: serviceWithAbsoluteUrls }, 'Service retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Get all services (admin only)
const getAllServicesAdmin = async (req, res, next) => {
    try {
        const services = await Service.find();
        // Convert relative paths to absolute URLs
        const servicesWithAbsoluteUrls = services.map(service => convertToAbsoluteUrls(service.toObject()));
        res.status(200).json(ApiResponse.success({ services: servicesWithAbsoluteUrls }, 'All services retrieved successfully'));
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

        // Convert relative paths to absolute URLs
        const serviceWithAbsoluteUrls = convertToAbsoluteUrls(service.toObject());
        res.status(200).json(ApiResponse.success({ service: serviceWithAbsoluteUrls }, 'Service retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Create a new service (admin only)
const createService = async (req, res, next) => {
    try {
        const { name, description, about, price, duration, category, status, features, prerequisites, benefits, contraindications, sessions, validity } = req.body;

        // Prepare service object
        const serviceData = {
            name,
            description,
            about,
            price,
            duration,
            category,
            status,
            features: safeJsonParse(features, []),
            prerequisites: safeJsonParse(prerequisites, []),
            benefits: safeJsonParse(benefits, []),
            contraindications: safeJsonParse(contraindications, []),
            sessions,
            validity
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

        // Convert relative paths to absolute URLs
        const serviceWithAbsoluteUrls = convertToAbsoluteUrls(service.toObject());
        res.status(201).json(ApiResponse.success({ service: serviceWithAbsoluteUrls }, 'Service created successfully'));
    } catch (error) {
        next(error);
    }
};

// Update service by ID (admin only)
const updateService = async (req, res, next) => {
    try {
        const { name, description, about, price, duration, category, status, features, prerequisites, benefits, contraindications, sessions, validity } = req.body;

        // Prepare update object
        const updateData = {};

        if (name) updateData.name = name;
        if (description) updateData.description = description;
        if (about !== undefined) updateData.about = about;
        if (price) updateData.price = price;
        if (duration) updateData.duration = duration;
        if (category) updateData.category = category;
        if (status) updateData.status = status;
        if (features) updateData.features = safeJsonParse(features);
        if (prerequisites) updateData.prerequisites = safeJsonParse(prerequisites);
        if (benefits) updateData.benefits = safeJsonParse(benefits);
        if (contraindications) updateData.contraindications = safeJsonParse(contraindications);
        if (sessions !== undefined) updateData.sessions = sessions;
        if (validity !== undefined) updateData.validity = validity;

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

        // Convert relative paths to absolute URLs
        const serviceWithAbsoluteUrls = convertToAbsoluteUrls(service.toObject());
        res.status(200).json(ApiResponse.success({ service: serviceWithAbsoluteUrls }, 'Service updated successfully'));
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

        // Convert relative paths to absolute URLs
        const serviceWithAbsoluteUrls = convertToAbsoluteUrls(service.toObject());
        res.status(200).json(ApiResponse.success({ service: serviceWithAbsoluteUrls }, 'Media removed successfully'));
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
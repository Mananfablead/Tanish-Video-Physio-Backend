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

// Helper function to check if a service has expired based on validity period
const isServiceExpired = (booking, service) => {
    if (!service) return false;
    
    // Use the new method from the service model if available
    if (service.checkExpirationStatus) {
        const status = service.checkExpirationStatus(booking.createdAt);
        return status.isExpired;
    }
    
    // Fallback to manual calculation
    if (!service.validity || service.validity === 0) return false;
    
    const purchaseDate = new Date(booking.createdAt);
    const expiryDate = new Date(purchaseDate);
    expiryDate.setDate(purchaseDate.getDate() + service.validity); // Add validity days
    
    const now = new Date();
    return now > expiryDate;
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
        const services = await Service.find({ status: 'active' })
            .sort({ createdAt: -1 }); // Sort by createdAt descending
        
        // Convert relative paths to absolute URLs and add expiration info if user is authenticated
        let servicesWithAbsoluteUrls = services.map(service => convertToAbsoluteUrls(service.toObject()));
        
        // If user is authenticated, add expiration information for their purchased services
        if (req.user && req.user.userId) {
            const Booking = require('../models/Booking.model');
            
            // Get user's paid bookings
            const userBookings = await Booking.find({
                userId: req.user.userId,
                paymentStatus: 'paid'
            }).populate('serviceId');
            
            // Create a map of serviceId to booking for quick lookup
            const serviceBookingMap = {};
            userBookings.forEach(booking => {
                if (booking.serviceId) {
                    serviceBookingMap[booking.serviceId._id.toString()] = booking;
                }
            });
            
            // Add expiration information to services
            servicesWithAbsoluteUrls = servicesWithAbsoluteUrls.map(service => {
                const userBooking = serviceBookingMap[service._id.toString()];
                if (userBooking) {
                    const isExpired = isServiceExpired(userBooking, service);
                    const purchaseDate = userBooking.purchaseDate || userBooking.createdAt;
                    return {
                        ...service,
                        isExpired: isExpired,
                        expiryDate: service.validity ? 
                            new Date(new Date(purchaseDate).setDate(new Date(purchaseDate).getDate() + service.validity)) : 
                            null,
                        purchaseDate: purchaseDate
                    };
                }
                return service;
            });
        }
        
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
        const services = await Service.find()
            .sort({ createdAt: -1 }); // Sort by createdAt descending
        
        // Add purchase count and expiration stats for each service
        const Booking = require('../models/Booking.model');
        const servicesWithPurchaseCount = await Promise.all(services.map(async (service) => {
            // Count paid bookings for this service
            const purchaseCount = await Booking.countDocuments({
                serviceId: service._id,
                paymentStatus: 'paid'
            });
            
            // Count expired services
            const allBookings = await Booking.find({
                serviceId: service._id,
                paymentStatus: 'paid'
            });
            
            let expiredCount = 0;
            allBookings.forEach(booking => {
                if (isServiceExpired(booking, service)) {
                    expiredCount++;
                }
            });
            
            // Convert relative paths to absolute URLs
            const serviceWithAbsoluteUrls = convertToAbsoluteUrls(service.toObject());
            
            return {
                ...serviceWithAbsoluteUrls,
                purchaseCount,
                expiredCount,
                activeCount: purchaseCount - expiredCount
            };
        }));
        
        res.status(200).json(ApiResponse.success({ services: servicesWithPurchaseCount }, 'All services with purchase counts retrieved successfully'));
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

        // Count total purchases for this service
        const Booking = require('../models/Booking.model');
        const purchaseCount = await Booking.countDocuments({
            serviceId: req.params.id,
            paymentStatus: 'paid'
        });
        
        // Get recent purchasers with details
        const recentPurchases = await Booking.find({
            serviceId: req.params.id,
            paymentStatus: 'paid'
        })
        .populate('userId', 'name email phone')
        .sort({ createdAt: -1 })
        .limit(10); // Get last 10 purchases
        
        // Calculate additional stats
        const activeBookings = await Booking.countDocuments({
            serviceId: req.params.id,
            paymentStatus: 'paid',
            status: { $in: ['confirmed', 'ongoing'] }
        });
        
        const completedBookings = await Booking.countDocuments({
            serviceId: req.params.id,
            paymentStatus: 'paid',
            status: 'completed'
        });
        
        // Convert relative paths to absolute URLs
        const serviceWithAbsoluteUrls = convertToAbsoluteUrls(service.toObject());
        
        // Get detailed purchasers list
        const purchasers = await Booking.find({
            serviceId: req.params.id,
            paymentStatus: 'paid'
        })
        .populate('userId', 'name email phone')
        .select('userId amount status createdAt updatedAt')
        .sort({ createdAt: -1 });
        
        res.status(200).json(ApiResponse.success({ 
            service: {
                ...serviceWithAbsoluteUrls,
                purchaseStats: {
                    totalPurchases: purchaseCount,
                    activeBookings,
                    completedBookings,
                    recentPurchases: recentPurchases.map(purchase => ({
                        id: purchase._id,
                        userId: purchase.userId,
                        bookingDate: purchase.createdAt,
                        amount: purchase.amount,
                        status: purchase.status,
                        paymentStatus: purchase.paymentStatus
                    })),
                    purchasers: purchasers.map(purchaser => ({
                        id: purchaser._id,
                        userId: purchaser.userId,
                        amount: purchaser.amount,
                        status: purchaser.status,
                        bookingDate: purchaser.createdAt,
                        updatedDate: purchaser.updatedAt
                    }))
                }
            }
        }, 'Service with purchase details retrieved successfully'));
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
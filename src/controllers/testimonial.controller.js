const Testimonial = require('../models/Testimonial.model');

// Get all testimonials with filtering and search
exports.getAllTestimonials = async (req, res) => {
    try {
        const { search, status } = req.query;

        let filter = {};

        // Apply search filter
        if (search) {
            filter.$or = [
                { clientName: { $regex: search, $options: 'i' } },
                { serviceUsed: { $regex: search, $options: 'i' } },
                { content: { $regex: search, $options: 'i' } },
                { problem: { $regex: search, $options: 'i' } }
            ];
        }

        // Apply status filter
        if (status && status !== 'all') {
            filter.status = status;
        }

        const testimonials = await Testimonial.find(filter).sort({ createdAt: -1 });

        res.json({
            success: true,
            data: testimonials
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching testimonials',
            error: error.message
        });
    }
};

// Get testimonials for public display (only approved)
exports.getPublicTestimonials = async (req, res) => {
    try {
        const testimonials = await Testimonial.find({ status: 'approved' })
            .sort({ featured: -1, createdAt: -1 }); // Featured testimonials first

        res.json({
            success: true,
            data: testimonials
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching public testimonials',
            error: error.message
        });
    }
};

// Get featured testimonials
exports.getFeaturedTestimonials = async (req, res) => {
    try {
        const testimonials = await Testimonial.find({
            status: 'approved',
            featured: true
        }).sort({ createdAt: -1 });

        res.json({
            success: true,
            data: testimonials
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching featured testimonials',
            error: error.message
        });
    }
};

// Get single testimonial by ID
exports.getTestimonialById = async (req, res) => {
    try {
        const { id } = req.params;
        const testimonial = await Testimonial.findById(id);

        if (!testimonial) {
            return res.status(404).json({
                success: false,
                message: 'Testimonial not found'
            });
        }

        res.json({
            success: true,
            data: testimonial
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching testimonial',
            error: error.message
        });
    }
};

// Create new testimonial
exports.createTestimonial = async (req, res) => {
    try {
        // If creating from admin panel, allow setting status and featured
        // Otherwise, default to pending
        const testimonialData = {
            ...req.body,
            status: req.user?.role === 'admin' ? req.body.status : 'pending',
            featured: req.user?.role === 'admin' ? req.body.featured : false
        };

        const testimonial = new Testimonial(testimonialData);
        await testimonial.save();

        res.status(201).json({
            success: true,
            message: 'Testimonial created successfully',
            data: testimonial
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Error creating testimonial',
            error: error.message
        });
    }
};

// Update testimonial
exports.updateTestimonial = async (req, res) => {
    try {
        const { id } = req.params;
        const testimonial = await Testimonial.findByIdAndUpdate(
            id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!testimonial) {
            return res.status(404).json({
                success: false,
                message: 'Testimonial not found'
            });
        }

        res.json({
            success: true,
            message: 'Testimonial updated successfully',
            data: testimonial
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Error updating testimonial',
            error: error.message
        });
    }
};

// Update testimonial status (approve/reject)
exports.updateTestimonialStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        // Validate status
        if (!['approved', 'rejected', 'pending'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be approved, rejected, or pending'
            });
        }

        const testimonial = await Testimonial.findByIdAndUpdate(
            id,
            { status },
            { new: true, runValidators: true }
        );

        if (!testimonial) {
            return res.status(404).json({
                success: false,
                message: 'Testimonial not found'
            });
        }

        res.json({
            success: true,
            message: `Testimonial ${status} successfully`,
            data: testimonial
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Error updating testimonial status',
            error: error.message
        });
    }
};

// Toggle featured status
exports.toggleFeaturedStatus = async (req, res) => {
    try {
        const { id } = req.params;

        const testimonial = await Testimonial.findById(id);

        if (!testimonial) {
            return res.status(404).json({
                success: false,
                message: 'Testimonial not found'
            });
        }

        // Only approved testimonials can be featured
        if (testimonial.status !== 'approved') {
            return res.status(400).json({
                success: false,
                message: 'Only approved testimonials can be featured'
            });
        }

        testimonial.featured = !testimonial.featured;
        await testimonial.save();

        res.json({
            success: true,
            message: `Testimonial ${testimonial.featured ? 'featured' : 'unfeatured'} successfully`,
            data: testimonial
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Error toggling featured status',
            error: error.message
        });
    }
};

// Delete testimonial
exports.deleteTestimonial = async (req, res) => {
    try {
        const { id } = req.params;
        const testimonial = await Testimonial.findByIdAndDelete(id);

        if (!testimonial) {
            return res.status(404).json({
                success: false,
                message: 'Testimonial not found'
            });
        }

        res.json({
            success: true,
            message: 'Testimonial deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting testimonial',
            error: error.message
        });
    }
};

// Get testimonial statistics
exports.getTestimonialStats = async (req, res) => {
    try {
        const total = await Testimonial.countDocuments({});
        const pending = await Testimonial.countDocuments({ status: 'pending' });
        const approved = await Testimonial.countDocuments({ status: 'approved' });
        const featured = await Testimonial.countDocuments({
            status: 'approved',
            featured: true
        });

        res.json({
            success: true,
            data: {
                total,
                pending,
                approved,
                featured
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching testimonial stats',
            error: error.message
        });
    }
};
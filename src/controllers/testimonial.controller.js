const Testimonial = require('../models/Testimonial.model');
const User = require('../models/User.model');
const path = require('path');
const fs = require('fs');

// Get all testimonials with filtering and search
exports.getAllTestimonials = async (req, res) => {
    try {
        const { search, status } = req.query;

        let filter = {};

        // Apply search filter
        if (search) {
            // For search functionality with user data, we'll need to first find matching users
            const matchingUsers = await User.find({
                $or: [
                    { name: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } }
                ]
            });

            filter.$or = [
                { content: { $regex: search, $options: 'i' } },
                { problem: { $regex: search, $options: 'i' } },
                { userId: { $in: matchingUsers.map(user => user._id) } }
            ];
        }

        // Apply status filter
        if (status && status !== 'all') {
            filter.status = status;
        }

        const testimonials = await Testimonial.find(filter)
            .populate('userId', 'name email profilePicture')
            .sort({ createdAt: -1 });

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
            .populate('userId', 'name email profilePicture')
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
        })
            .populate('userId', 'name email profilePicture')
            .sort({ createdAt: -1 });

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
        const testimonial = await Testimonial.findById(id)
            .populate('userId', 'name email profilePicture');

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

        // Handle video upload
        if (req.file) {
            testimonialData.video = `/uploads/testimonial-videos/${req.file.filename}`;
        }

        // If authenticated user is creating testimonial, use their userId
        if (req.user && !testimonialData.userId) {
            testimonialData.userId = req.user.userId;
        }
        
        // Validate required fields
        if (!testimonialData.userId) {
            return res.status(400).json({
                success: false,
                message: 'Authentication required. Please log in to submit a testimonial.'
            });
        }
        
        if (!testimonialData.rating || !testimonialData.content || !testimonialData.problem || !testimonialData.serviceUsed) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: rating, content, problem, or serviceUsed'
            });
        }
        
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
        
        // Prepare update data
        const updateData = { ...req.body };
        
        // Handle video upload
        if (req.file) {
            updateData.video = `/uploads/testimonial-videos/${req.file.filename}`;
        }
        
        const testimonial = await Testimonial.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        )
            .populate('userId', 'name email profilePicture');

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
        )
            .populate('userId', 'name email profilePicture');

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

        const testimonial = await Testimonial.findById(id)
            .populate('userId', 'name email profilePicture');

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
        const testimonial = await Testimonial.findById(id)
            .populate('userId', 'name email profilePicture');

        if (!testimonial) {
            return res.status(404).json({
                success: false,
                message: 'Testimonial not found'
            });
        }

        // Delete associated video file if it exists
        if (testimonial.video) {
            const videoPath = path.join(__dirname, '..', '..', testimonial.video);
            try {
                if (fs.existsSync(videoPath)) {
                    fs.unlinkSync(videoPath);
                }
            } catch (err) {
                console.error('Error deleting video file:', err);
            }
        }

        // Delete the testimonial from database
        await Testimonial.findByIdAndDelete(id);

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

// Get testimonials by current user
exports.getUserTestimonials = async (req, res) => {
    try {
        const testimonials = await Testimonial.find({ userId: req.user.userId })
            .sort({ createdAt: -1 });
            
        res.status(200).json({
            success: true,
            message: 'User testimonials fetched successfully',
            data: testimonials
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching user testimonials',
            error: error.message
        });
    }
};
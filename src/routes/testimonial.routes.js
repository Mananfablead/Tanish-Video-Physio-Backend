const express = require('express');
const router = express.Router();
const testimonialController = require('../controllers/testimonial.controller');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth.middleware');
const testimonialUpload = require('../middlewares/testimonialUpload.middleware');

// Public routes (no authentication required)
router.get('/public', testimonialController.getPublicTestimonials);
router.get('/public/featured', testimonialController.getFeaturedTestimonials);

// Authenticated user routes (require authentication but not admin role)
router.post('/create', authenticateToken, testimonialUpload.single('video'), testimonialController.createTestimonial);
router.get('/user', authenticateToken, testimonialController.getUserTestimonials);

// Admin routes (require authentication and admin role)
router.use(authenticateToken);
router.use(authorizeRoles('admin'));

// Admin routes for managing testimonials
router.get('/', testimonialController.getAllTestimonials);
router.get('/stats', testimonialController.getTestimonialStats);
router.get('/:id', testimonialController.getTestimonialById);
router.post('/', testimonialUpload.single('video'), testimonialController.createTestimonial);
router.put('/:id', testimonialUpload.single('video'), testimonialController.updateTestimonial);
router.put('/:id/status', testimonialController.updateTestimonialStatus);
router.patch('/:id/featured', testimonialController.toggleFeaturedStatus);
router.delete('/:id', testimonialController.deleteTestimonial);

module.exports = router;
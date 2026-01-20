const express = require('express');
const router = express.Router();
const testimonialController = require('../controllers/testimonial.controller');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth.middleware');

// Public routes (no authentication required)
router.get('/public', testimonialController.getPublicTestimonials);
router.get('/public/featured', testimonialController.getFeaturedTestimonials);

// Admin routes (require authentication and admin role)
router.use(authenticateToken);
router.use(authorizeRoles('admin'));

// Admin routes for managing testimonials
router.get('/', testimonialController.getAllTestimonials);
router.get('/stats', testimonialController.getTestimonialStats);
router.get('/:id', testimonialController.getTestimonialById);
router.post('/', testimonialController.createTestimonial);
router.put('/:id', testimonialController.updateTestimonial);
router.put('/:id/status', testimonialController.updateTestimonialStatus);
router.patch('/:id/featured', testimonialController.toggleFeaturedStatus);
router.delete('/:id', testimonialController.deleteTestimonial);

module.exports = router;
const express = require('express');
const router = express.Router();
const cmsController = require('../controllers/cms.controller');
const contactController = require('../controllers/contact.controller');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth.middleware');
const cmsUpload = require('../middlewares/cmsUpload.middleware');

// Public routes (no authentication required)
router.get('/public/hero', cmsController.getHeroPublic);
router.get('/public/steps', cmsController.getStepsPublic);
router.get('/public/conditions', cmsController.getConditionsPublic);
router.get('/public/whyUs', cmsController.getWhyUsPublic);
router.get('/public/faqs', cmsController.getFaqsPublic);
router.get('/public/terms', cmsController.getTermsPublic);
router.get('/public/featuredTherapist', cmsController.getFeaturedTherapistPublic);
router.get('/public/contact', cmsController.getContactPublic);
router.get('/public/about', cmsController.getAboutPublic);
router.post('/public/contact-message', contactController.createContactMessage);

// Admin routes (require authentication and admin role)
router.use(authenticateToken);
router.use(authorizeRoles('admin'));

// Hero Section
router.get('/admin/hero', cmsController.getHeroAdmin);
router.put('/admin/hero', cmsUpload.single('image'), cmsController.updateHero);

// Steps Section
router.get('/admin/steps', cmsController.getStepsAdmin);
router.post('/admin/steps', cmsUpload.single('image'), cmsController.createStep);
router.put('/admin/steps/:id', cmsUpload.single('image'), cmsController.updateStep);
router.delete('/admin/steps/:id', cmsController.deleteStep);

// Conditions Section
router.get('/admin/conditions', cmsController.getConditionsAdmin);
router.post('/admin/conditions', cmsUpload.any(), cmsController.createConditions);
router.put('/admin/conditions/:id', cmsUpload.any(), cmsController.updateConditionsById);
// Endpoint to add a single condition to the existing conditions array
router.post('/admin/conditions/single', cmsUpload.any(), cmsController.addSingleCondition);
// Endpoint to update a single condition in the existing conditions array
router.put('/admin/conditions/single/:index', cmsUpload.any(), cmsController.updateSingleCondition);
// Endpoint to delete a single condition from the existing conditions array
router.delete('/admin/conditions/single/:index', cmsController.deleteSingleCondition);
// Backward compatibility - keep the old route for update
router.put('/admin/conditions', cmsUpload.any(), cmsController.updateConditions);

// Why Us Section
router.get('/admin/whyUs', cmsController.getWhyUsAdmin);
router.put('/admin/whyUs', cmsUpload.single('image'), cmsController.updateWhyUs);

// FAQ Section
router.get('/admin/faq', cmsController.getFaqsAdmin);
router.post('/admin/faq', cmsController.createFaq);
router.put('/admin/faq/:id', cmsController.updateFaq);
router.delete('/admin/faq/:id', cmsController.deleteFaq);

// Terms Section
router.get('/admin/terms', cmsController.getTermsAdmin);
router.put('/admin/terms', cmsController.updateTerms);

// Featured Therapist Section
router.get('/admin/featuredTherapist', cmsController.getFeaturedTherapistAdmin);
router.put('/admin/featuredTherapist', cmsUpload.single('image'), cmsController.updateFeaturedTherapist);

// Contact Section
router.get('/admin/contact', cmsController.getContactAdmin);
router.put('/admin/contact', cmsController.updateContact);

// About Section
router.get('/admin/about', cmsController.getAboutAdmin);
router.put('/admin/about', cmsUpload.fields([{ name: 'images', maxCount: 10 }]), cmsController.updateAbout);

// Contact Messages (admin only)
router.get('/admin/contact-messages', contactController.getAllContactMessages);
router.get('/admin/contact-messages/:id', contactController.getContactMessageById);
router.put('/admin/contact-messages/:id', contactController.updateContactMessageStatus);
router.delete('/admin/contact-messages/:id', contactController.deleteContactMessage);
router.get('/admin/contact-messages-stats', contactController.getContactMessagesStats);

// Get all CMS data
router.get('/admin/all', cmsController.getAllCmsData);

module.exports = router;
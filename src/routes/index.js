const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth.routes');
const userRoutes = require('./users.routes');
const serviceRoutes = require('./services.routes');
const bookingRoutes = require('./bookings.routes');
const sessionRoutes = require('./sessions.routes');
const paymentRoutes = require('./payments.routes');
const subscriptionRoutes = require('./subscriptions.routes');
const availabilityRoutes = require('./availability.routes');
const reportRoutes = require('./reports.routes');
const notificationRoutes = require('./notifications.routes');
const chatRoutes = require('./chat.routes');
const questionnaireRoutes = require('./questionnaires.routes');
const cmsRoutes = require('./cms.routes');
const testimonialRoutes = require('./testimonial.routes');
const groupSessionRoutes = require('./groupSession.route');

// Mount route modules
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/services', serviceRoutes);
router.use('/bookings', bookingRoutes);
router.use('/sessions', sessionRoutes);
router.use('/payments', paymentRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/availability', availabilityRoutes);
router.use('/reports', reportRoutes);
router.use('/notifications', notificationRoutes);
router.use('/chat', chatRoutes);
router.use('/questionnaires', questionnaireRoutes);
router.use('/cms', cmsRoutes);
router.use('/testimonials', testimonialRoutes);
router.use('/group-sessions', groupSessionRoutes);

module.exports = router;
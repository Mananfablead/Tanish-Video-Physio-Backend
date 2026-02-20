const express = require('express');
const { getSubscriptionPlans, createSubscriptionPlan, getAllSubscriptionPlans, getSubscriptionPlan, updateSubscriptionPlan, deleteSubscriptionPlan, archiveSubscriptionPlan, getUserSubscriptions, getAllSubscriptions, getExpiredSubscriptions, getExpiredServices, checkSubscriptionEligibility, getSubscriptionServices, createFreeSessionWithSubscription } = require('../controllers/subscriptions.controller');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', getSubscriptionPlans);

// Admin routes for subscription plan management
router.post('/plans', authenticateToken, authorizeRoles('admin'), createSubscriptionPlan);
router.get('/plans', authenticateToken, authorizeRoles('admin'), getAllSubscriptionPlans);
router.get('/plans/:id', authenticateToken, authorizeRoles('admin'), getSubscriptionPlan);
router.put('/plans/:id', authenticateToken, authorizeRoles('admin'), updateSubscriptionPlan);
router.delete('/plans/:id', authenticateToken, authorizeRoles('admin'), deleteSubscriptionPlan);

// Route to get user's subscriptions
router.get('/user', authenticateToken, getUserSubscriptions);

// Admin route to get all subscriptions
router.get('/admin/all', authenticateToken, authorizeRoles('admin'), getAllSubscriptions);

// Admin routes for expired items
router.get('/admin/expired', authenticateToken, authorizeRoles('admin'), getExpiredSubscriptions);
router.get('/admin/expired-services', authenticateToken, authorizeRoles('admin'), getExpiredServices);

// Subscription booking routes
router.get('/eligibility', authenticateToken, checkSubscriptionEligibility);
router.get('/services', authenticateToken, getSubscriptionServices);
router.post('/free-session', authenticateToken, createFreeSessionWithSubscription);

module.exports = router;
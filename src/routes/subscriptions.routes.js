const express = require('express');
const { getSubscriptionPlans, createSubscriptionOrder, createSubscriptionPlan, getAllSubscriptionPlans, getSubscriptionPlan, updateSubscriptionPlan, deleteSubscriptionPlan } = require('../controllers/subscriptions.controller');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', getSubscriptionPlans);
router.post('/create-order', authenticateToken, createSubscriptionOrder);

// Admin routes for subscription plan management
router.post('/plans', authenticateToken, authorizeRoles('admin'), createSubscriptionPlan);
router.get('/plans', authenticateToken, authorizeRoles('admin'), getAllSubscriptionPlans);
router.get('/plans/:id', authenticateToken, authorizeRoles('admin'), getSubscriptionPlan);
router.put('/plans/:id', authenticateToken, authorizeRoles('admin'), updateSubscriptionPlan);
router.delete('/plans/:id', authenticateToken, authorizeRoles('admin'), deleteSubscriptionPlan);

module.exports = router;
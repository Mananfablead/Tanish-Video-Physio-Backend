const express = require('express');
const { createOrder, verifyPayment, handleWebhook, createSubscriptionOrder, verifySubscriptionPayment, getAllPayments } = require('../controllers/payments.controller');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/create-order', authenticateToken, createOrder);
router.post('/verify', authenticateToken, verifyPayment);
router.post('/webhook', handleWebhook); // This endpoint should be accessible without authentication for Razorpay webhooks

// Subscription payment routes
router.post('/create-subscription-order', authenticateToken, createSubscriptionOrder);
router.post('/verify-subscription', authenticateToken, verifySubscriptionPayment);

// Admin route to get all payments
router.get('/admin/all', authenticateToken, authorizeRoles('admin'), getAllPayments);

module.exports = router;
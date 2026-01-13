const express = require('express');
const { createOrder, verifyPayment, handleWebhook, createSubscriptionOrder, verifySubscriptionPayment } = require('../controllers/payments.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/create-order', authenticateToken, createOrder);
router.post('/verify', authenticateToken, verifyPayment);
router.post('/webhook', handleWebhook); // This endpoint should be accessible without authentication for Razorpay webhooks

// Subscription payment routes
router.post('/create-subscription-order', authenticateToken, createSubscriptionOrder);
router.post('/verify-subscription', authenticateToken, verifySubscriptionPayment);

module.exports = router;
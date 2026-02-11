const express = require('express');
const { createOrder, createGuestOrder, verifyPayment, verifyGuestPayment, handleWebhook, createSubscriptionOrder, createGuestSubscriptionOrder, verifySubscriptionPayment, verifyGuestSubscriptionPayment, getUserPayments, getAllPayments } = require('../controllers/payments.controller');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth.middleware');

const router = express.Router();

// Payment routes for service bookings
router.post('/create-order', authenticateToken, createOrder);
router.post('/verify', authenticateToken, verifyPayment);

// Subscription payment routes
router.post('/create-subscription-order', authenticateToken, createSubscriptionOrder);
router.post('/verify-subscription', authenticateToken, verifySubscriptionPayment);

// Public route for guest payment verification
router.post('/create-guest-order', createGuestOrder);
router.post('/verify-guest', verifyGuestPayment);

// Public route for guest subscription payment verification
router.post('/create-guest-subscription-order', createGuestSubscriptionOrder);
router.post('/verify-guest-subscription', verifyGuestSubscriptionPayment);

// Webhook endpoint for Razorpay payments and subscriptions
router.post('/webhook', handleWebhook); // This endpoint should be accessible without authentication for Razorpay webhooks

// Route to get user's payments
router.get('/user', authenticateToken, getUserPayments);
// Admin route to get all payments
router.get('/admin/all', authenticateToken, authorizeRoles('admin'), getAllPayments);

module.exports = router;
const express = require('express');
const { createOrder, createGuestOrder, verifyPayment, verifyGuestPayment, markPaymentFailed, handleWebhook, createSubscriptionOrder, createGuestSubscriptionOrder, verifySubscriptionPayment, verifyGuestSubscriptionPayment, getUserPayments, getAllPayments, getPaymentById, getRazorpayConfig, expireStalePayments, checkStalePayments } = require('../controllers/payments.controller');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth.middleware');

const router = express.Router();

// Payment routes for service bookings
router.post('/create-order', authenticateToken, createOrder);
router.post('/verify', authenticateToken, verifyPayment);
router.post('/mark-failed', markPaymentFailed);

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

// Public route to get Razorpay configuration
router.get('/config', getRazorpayConfig);

// Route to get user's payments
router.get('/user', authenticateToken, getUserPayments);

// Admin route to get all payments
router.get('/admin/all', authenticateToken, authorizeRoles('admin'), getAllPayments);

// Admin route to get payment by ID
router.get('/admin/:paymentId', authenticateToken, authorizeRoles('admin'), getPaymentById);

// Admin route to check stale payments count (for optimized cron)
router.get('/admin/check-stale', authenticateToken, authorizeRoles('admin'), checkStalePayments);

// Admin route to expire stale payments (payments older than 15 minutes with status 'created')
router.post('/admin/expire-stale', authenticateToken, authorizeRoles('admin'), expireStalePayments);

module.exports = router;
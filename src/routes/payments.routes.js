const express = require('express');
const { createOrder, handleWebhook } = require('../controllers/payments.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/create-order', authenticateToken, createOrder);
router.post('/webhook', handleWebhook); // This endpoint should be accessible without authentication for Razorpay webhooks

module.exports = router;
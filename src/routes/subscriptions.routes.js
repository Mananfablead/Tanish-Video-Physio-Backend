const express = require('express');
const { getSubscriptionPlans, createSubscriptionOrder } = require('../controllers/subscriptions.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', getSubscriptionPlans);
router.post('/create-order', authenticateToken, createSubscriptionOrder);

module.exports = router;
const express = require('express');
const router = express.Router();
const { formatPhoneNumber, validatePhoneNumber } = require('../controllers/phoneController');

// Route to format phone number by adding country code
router.post('/format', formatPhoneNumber);

// Route to validate phone number format
router.post('/validate', validatePhoneNumber);

module.exports = router;
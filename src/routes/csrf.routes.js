const express = require('express');
const router = express.Router();

/**
 * @route   GET /api/csrf-token
 * @desc    Get a new CSRF token
 * @access  Public
 */
router.get('/csrf-token', (req, res) => {
    try {
        // Always generate a fresh CSRF token
        const csrfToken = req.csrfToken();
        
        console.log('🔑 Generated CSRF Token:', csrfToken);
        console.log('🍪 Cookies sent by client:', req.cookies);
        console.log('📦 Cookie (csrftoken):', req.cookies.csrftoken);
        
        res.status(200).json({
            success: true,
            csrfToken: csrfToken
        });
    } catch (error) {
        console.error('❌ Error generating CSRF token:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate CSRF token'
        });
    }
});

module.exports = router;

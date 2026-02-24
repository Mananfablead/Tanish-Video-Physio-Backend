const { addCountryCode } = require('../utils/whatsapp.utils');

/**
 * Format phone number by adding country code if not present
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const formatPhoneNumber = async (req, res) => {
    try {
        const { phoneNumber, countryCode = '91' } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is required'
            });
        }

        // Format the phone number
        const formattedNumber = addCountryCode(phoneNumber, countryCode);

        res.status(200).json({
            success: true,
            originalNumber: phoneNumber,
            formattedNumber: formattedNumber,
            countryCode: countryCode
        });
    } catch (error) {
        console.error('Error formatting phone number:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Validate phone number format
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const validatePhoneNumber = async (req, res) => {
    try {
        const { phoneNumber, countryCode = '91' } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is required'
            });
        }

        // Format the phone number
        const formattedNumber = addCountryCode(phoneNumber, countryCode);

        // Basic validation: check if it's a reasonable length for an international number
        const isValid = /^\d{10,15}$/.test(formattedNumber);

        res.status(200).json({
            success: true,
            originalNumber: phoneNumber,
            formattedNumber: formattedNumber,
            countryCode: countryCode,
            isValid: isValid,
            validationMessage: isValid ? 'Valid phone number format' : 'Invalid phone number format'
        });
    } catch (error) {
        console.error('Error validating phone number:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

module.exports = {
    formatPhoneNumber,
    validatePhoneNumber
};
const axios = require('axios');

/**
 * Adds country code to phone number if not present
 * @param {string} phoneNumber - The phone number to format
 * @param {string} countryCode - The country code to add (default: '91' for India)
 * @returns {string} Formatted phone number with country code
 */
const addCountryCode = (phoneNumber, countryCode = '91') => {
    if (!phoneNumber) return phoneNumber;

    // Remove all non-digit characters
    let cleanNumber = phoneNumber.replace(/[^0-9]/g, '');

    // If the number already has a country code (starts with + or already has international format), return as is
    if (phoneNumber.startsWith('+') || cleanNumber.length > 10) {
        return cleanNumber;
    }

    // Country-specific formatting logic
    switch (countryCode) {
        case '91': // India
            if (cleanNumber.length === 10) {
                cleanNumber = '91' + cleanNumber;
            }
            break;
        case '1': // USA/Canada
            if (cleanNumber.length === 10) {
                cleanNumber = '1' + cleanNumber;
            }
            break;
        case '44': // UK
            if (cleanNumber.length === 10 && (cleanNumber.startsWith('7') || cleanNumber.startsWith('2'))) {
                cleanNumber = '44' + cleanNumber;
            }
            break;
        case '61': // Australia
            if (cleanNumber.length === 9 && cleanNumber.startsWith('4')) {
                cleanNumber = '61' + cleanNumber;
            } else if (cleanNumber.length === 10 && cleanNumber.startsWith('0')) {
                cleanNumber = '61' + cleanNumber.substring(1);
            }
            break;
        case '49': // Germany
            if (cleanNumber.length >= 10 && cleanNumber.length <= 11) {
                cleanNumber = '49' + cleanNumber;
            }
            break;
        case '33': // France
            if (cleanNumber.length === 9) {
                cleanNumber = '33' + cleanNumber;
            }
            break;
        case '86': // China
            if (cleanNumber.length === 11 && (cleanNumber.startsWith('1'))) {
                cleanNumber = '86' + cleanNumber;
            }
            break;
        case '81': // Japan
            if (cleanNumber.length === 10 || cleanNumber.length === 11) {
                cleanNumber = '81' + cleanNumber;
            }
            break;
        default:
            // For other countries, if it's a 10-digit number, add the specified country code
            if (cleanNumber.length === 10 && countryCode.length <= 4) {
                cleanNumber = countryCode + cleanNumber;
            }
    }

    return cleanNumber;
};

/**
 * Validates a WhatsApp access token with Facebook's API
 * @param {string} accessToken - The WhatsApp access token to validate
 * @returns {Promise<{valid: boolean, data?: object, error?: string}>} Validation result
 */
const validateWhatsAppToken = async (accessToken) => {
    try {
        const response = await axios.get(`https://graph.facebook.com/v18.0/me?access_token=${accessToken}`);

        if (response.data && response.data.id) {
            console.log('✅ WhatsApp access token is valid');
            return { valid: true, data: response.data };
        } else {
            console.log('❌ WhatsApp access token validation failed - no user data returned');
            return { valid: false, error: 'Invalid response from Facebook API' };
        }
    } catch (error) {
        console.error('❌ WhatsApp access token validation failed:', {
            message: error.response?.data?.error?.message || error.message,
            code: error.response?.data?.error?.code,
            type: error.response?.data?.error?.type
        });

        return {
            valid: false,
            error: error.response?.data?.error?.message || error.message,
            code: error.response?.data?.error?.code
        };
    }
};

/**
 * Tests WhatsApp API connectivity
 * @param {string} accessToken - WhatsApp access token
 * @param {string} phoneNumberId - WhatsApp phone number ID
 * @param {string} testNumber - Test phone number to send a message to
 * @returns {Promise<{success: boolean, error?: string}>} Test result
 */
const testWhatsAppConnection = async (accessToken, phoneNumberId, testNumber) => {
    try {
        // Format test number with country code if needed
        const formattedTestNumber = addCountryCode(testNumber);

        const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

        const response = await axios.post(url, {
            messaging_product: 'whatsapp',
            to: formattedTestNumber,
            type: 'template',
            template: {
                name: 'hello_world', // Using a test template
                language: {
                    code: 'en_US'
                }
            }
        }, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        return { success: true, messageId: response.data.messages?.[0]?.id };
    } catch (error) {
        // Check if it's a template error (hello_world might not exist)
        if (error.response?.data?.error?.code === 200) {
            // This means the connection is valid, but template doesn't exist
            return { success: true, message: 'WhatsApp API connection successful, but template not found' };
        }

        return {
            success: false,
            error: error.response?.data?.error?.message || error.message
        };
    }
};

module.exports = {
    validateWhatsAppToken,
    testWhatsAppConnection,
    addCountryCode
};
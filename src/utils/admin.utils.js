const { getEmailCredentials } = require('./credentialsManager');

/**
 * Get admin email from credentials
 * @returns {Promise<string|null>} Admin email address or null if not found
 */
const getAdminEmail = async () => {
    try {
        const emailCreds = await getEmailCredentials();
        return emailCreds?.adminEmail || null;
    } catch (error) {
        console.error('Error getting admin email from credentials:', error);
        return null;
    }
};

/**
 * Get admin phone from credentials (if stored)
 * @returns {Promise<string|null>} Admin phone number or null if not found
 */
const getAdminPhone = async () => {
    try {
        const emailCreds = await getEmailCredentials();
        return emailCreds?.adminPhone || null;
    } catch (error) {
        console.error('Error getting admin phone from credentials:', error);
        return null;
    }
};

module.exports = {
    getAdminEmail,
    getAdminPhone
};
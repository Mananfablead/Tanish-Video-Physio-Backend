const Credentials = require("../models/Credentials.model");

/**
 * Utility functions to retrieve and use credentials securely
 */

/**
 * Get active WhatsApp credentials
 * @returns {Promise<Object>} WhatsApp credential object or null
 */
const getWhatsAppCredentials = async () => {
  try {
    const credential = await Credentials.findOne({
      credentialType: "whatsapp",
      isActive: true,
    });

    if (!credential) {
      console.warn("No active WhatsApp credentials found");
      return null;
    }

    return {
      accessToken: credential.whatsappAccessToken,
      phoneNumberId: credential.whatsappPhoneNumberId,
      businessId: credential.whatsappBusinessId,
    };
  } catch (error) {
    console.error("Error retrieving WhatsApp credentials:", error);
    // Check if it's a MongoDB connection error
    if (error.name === 'MongoNotConnectedError' || error.message.includes('connect')) {
      console.error('⚠️ Database connection lost. Attempting to reconnect...');
      // Reconnect logic
      try {
        const mongoose = require('mongoose');
        if (mongoose.connection.readyState !== 1) {
          await mongoose.connect(process.env.MONGODB_URI);
          console.log('✅ Database reconnected successfully');
          // Retry fetching credentials
          return await getWhatsAppCredentials();
        }
      } catch (reconnectError) {
        console.error('❌ Failed to reconnect to database:', reconnectError.message);
      }
    }
    return null;
  }
};

/**
 * Get active Email credentials
 * @returns {Promise<Object>} Email credential object or null
 */
const getEmailCredentials = async () => {
  try {
    const credential = await Credentials.findOne({
      credentialType: "email",
      isActive: true,
    });

    if (!credential) {
      console.warn("No active Email credentials found");
      return null;
    }

    console.log('📧 Email credentials retrieved - Admin Email:', credential.adminEmail || 'NOT SET');
    return {
      host: credential.emailHost,
      port: credential.emailPort,
      user: credential.emailUser,
      username: credential.emailUsername,
      password: credential.emailPassword,
      encryption: credential.emailEncryption,
      adminEmail: credential.adminEmail,
    };
  } catch (error) {
    console.error("Error retrieving Email credentials:", error);
    // Check if it's a MongoDB connection error
    if (error.name === 'MongoNotConnectedError' || error.message.includes('connect')) {
      console.error('⚠️ Database connection lost. Attempting to reconnect...');
      // Reconnect logic
      try {
        const mongoose = require('mongoose');
        if (mongoose.connection.readyState !== 1) {
          await mongoose.connect(process.env.MONGODB_URI);
          console.log('✅ Database reconnected successfully');
          // Retry fetching credentials
          return await getEmailCredentials();
        }
      } catch (reconnectError) {
        console.error('❌ Failed to reconnect to database:', reconnectError.message);
      }
    }
    return null;
  }
};

/**
 * Get active Razorpay credentials
 * @returns {Promise<Object>} Razorpay credential object or null
 */
const getRazorpayCredentials = async () => {
  try {
    const credential = await Credentials.findOne({
      credentialType: "razorpay",
      isActive: true,
    });

    if (!credential) {
      console.warn("No active Razorpay credentials found");
      return null;
    }

    return {
      keyId: credential.razorpayKeyId,
      keySecret: credential.razorpayKeySecret,
    };
  } catch (error) {
    console.error("Error retrieving Razorpay credentials:", error);
    return null;
  }
};

/**
 * Get all active credentials
 * @returns {Promise<Object>} Object containing all active credentials
 */
const getAllActiveCredentials = async () => {
  try {
    const [whatsapp, email, razorpay] = await Promise.all([
      getWhatsAppCredentials(),
      getEmailCredentials(),
      getRazorpayCredentials(),
    ]);

    return {
      whatsapp,
      email,
      razorpay,
    };
  } catch (error) {
    console.error("Error retrieving all active credentials:", error);
    return {
      whatsapp: null,
      email: null,
      razorpay: null,
    };
  }
};

/**
 * Check if a credential type is configured and active
 * @param {string} credentialType - Type of credential (whatsapp, email, razorpay)
 * @returns {Promise<boolean>} True if active, false otherwise
 */
const isCredentialConfigured = async (credentialType) => {
  try {
    const credential = await Credentials.findOne({
      credentialType,
      isActive: true,
    });

    return !!credential;
  } catch (error) {
    console.error(
      `Error checking if ${credentialType} credential is configured:`,
      error
    );
    return false;
  }
};

module.exports = {
  getWhatsAppCredentials,
  getEmailCredentials,
  getRazorpayCredentials,
  getAllActiveCredentials,
  isCredentialConfigured,
};

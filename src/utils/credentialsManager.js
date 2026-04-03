const mongoose = require('mongoose');
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
    console.error("Error retrieving WhatsApp credentials:", error.message);

    // Check if it's a MongoDB connection error
    if (error.name === 'MongoNotConnectedError' || error.message.includes('connect')) {
      console.error('⚠️ Database connection lost. Checking connection state...');
      console.log('Current mongoose connection state:', mongoose.connection.readyState);

      // Only attempt reconnect if not already connected
      if (mongoose.connection.readyState !== 1) {
        try {
          console.log('Attempting to reconnect to database...');
          await mongoose.connect(process.env.MONGODB_URI);
          console.log('✅ Database reconnected successfully');
          console.log('New mongoose connection state:', mongoose.connection.readyState);

          // Retry fetching credentials after successful reconnect
          console.log('Retrying to fetch WhatsApp credentials...');
          const retryCredential = await Credentials.findOne({
            credentialType: "whatsapp",
            isActive: true,
          });

          if (!retryCredential) {
            console.warn("No active WhatsApp credentials found after reconnect");
            return null;
          }

          return {
            accessToken: retryCredential.whatsappAccessToken,
            phoneNumberId: retryCredential.whatsappPhoneNumberId,
            businessId: retryCredential.whatsappBusinessId,
          };
        } catch (reconnectError) {
          console.error('❌ Failed to reconnect to database:', reconnectError.message);
          return null;
        }
      } else {
        console.error('Mongoose reports connected state but query failed');
        return null;
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
    console.error("Error retrieving Email credentials:", error.message);

    // Check if it's a MongoDB connection error
    if (error.name === 'MongoNotConnectedError' || error.message.includes('connect')) {
      console.error('⚠️ Database connection lost. Checking connection state...');
      console.log('Current mongoose connection state:', mongoose.connection.readyState);

      // Only attempt reconnect if not already connected
      if (mongoose.connection.readyState !== 1) {
        try {
          console.log('Attempting to reconnect to database...');
          await mongoose.connect(process.env.MONGODB_URI);
          console.log('✅ Database reconnected successfully');
          console.log('New mongoose connection state:', mongoose.connection.readyState);

          // Retry fetching credentials after successful reconnect
          console.log('Retrying to fetch Email credentials...');
          const retryCredential = await Credentials.findOne({
            credentialType: "email",
            isActive: true,
          });

          if (!retryCredential) {
            console.warn("No active Email credentials found after reconnect");
            return null;
          }

          console.log('📧 Email credentials retrieved after reconnect - Admin Email:', retryCredential.adminEmail || 'NOT SET');
          return {
            host: retryCredential.emailHost,
            port: retryCredential.emailPort,
            user: retryCredential.emailUser,
            username: retryCredential.emailUsername,
            password: retryCredential.emailPassword,
            encryption: retryCredential.emailEncryption,
            adminEmail: retryCredential.adminEmail,
          };
        } catch (reconnectError) {
          console.error('❌ Failed to reconnect to database:', reconnectError.message);
          return null;
        }
      } else {
        console.error('Mongoose reports connected state but query failed');
        return null;
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

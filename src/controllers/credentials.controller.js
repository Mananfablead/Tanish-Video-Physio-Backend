const Credentials = require("../models/Credentials.model");
const ApiResponse = require("../utils/apiResponse");

// Get all credentials (admin only)
const getAllCredentials = async (req, res, next) => {
  try {
    const credentials = await Credentials.find().populate("lastUpdatedBy", "name email");

    res.status(200).json(
      ApiResponse.success(credentials, "Credentials retrieved successfully")
    );
  } catch (error) {
    next(error);
  }
};

// Get single credential by ID
const getCredentialById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const credential = await Credentials.findById(id).populate("lastUpdatedBy", "name email");

    if (!credential) {
      return res.status(404).json(ApiResponse.error("Credential not found"));
    }

    res.status(200).json(ApiResponse.success(credential, "Credential retrieved successfully"));
  } catch (error) {
    next(error);
  }
};

// Create new credential
const createCredential = async (req, res, next) => {
  try {
    const { credentialType, name, description, ...credentialData } = req.body;

    // Validate required fields based on type
    if (!credentialType || !name) {
      return res
        .status(400)
        .json(ApiResponse.error("Credential type and name are required"));
    }

    // Validate credential type
    const validTypes = ["whatsapp", "email", "razorpay"];
    if (!validTypes.includes(credentialType)) {
      return res.status(400).json(ApiResponse.error("Invalid credential type"));
    }

    // Prevent creating more than one credential record per type.
    // After a credential of a given type exists, admins must use update.
    const existingAny = await Credentials.findOne({ credentialType });
    if (existingAny) {
      return res
        .status(400)
        .json(
          ApiResponse.error(
            `A ${credentialType} credential already exists. Use update instead.`
          )
        );
    }
    const credential = new Credentials({
      credentialType,
      name,
      description,
      lastUpdatedBy: req.user.userId,
      // Since creation is restricted to one per type, make it active by default
      isActive: true,
      ...credentialData,
    });

    await credential.save();

    res.status(201).json(
      ApiResponse.success(credential, "Credential created successfully")
    );
  } catch (error) {
    next(error);
  }
};

// Update credential
const updateCredential = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { credentialType, name, description, ...credentialData } = req.body;

    const credential = await Credentials.findById(id);

    if (!credential) {
      return res.status(404).json(ApiResponse.error("Credential not found"));
    }

    // Update fields
    if (credentialType) credential.credentialType = credentialType;
    if (name) credential.name = name;
    if (description !== undefined) credential.description = description;

    // Update type-specific fields
    if (credentialType === "whatsapp") {
      if (credentialData.whatsappAccessToken)
        credential.whatsappAccessToken = credentialData.whatsappAccessToken;
      if (credentialData.whatsappPhoneNumberId)
        credential.whatsappPhoneNumberId = credentialData.whatsappPhoneNumberId;
      if (credentialData.whatsappBusinessId)
        credential.whatsappBusinessId = credentialData.whatsappBusinessId;
    } else if (credentialType === "email") {
      if (credentialData.emailHost) credential.emailHost = credentialData.emailHost;
      if (credentialData.emailPort) credential.emailPort = credentialData.emailPort;
      if (credentialData.emailUser) credential.emailUser = credentialData.emailUser;
      if (credentialData.emailPassword) credential.emailPassword = credentialData.emailPassword;
      if (credentialData.adminEmail) credential.adminEmail = credentialData.adminEmail;
    } else if (credentialType === "razorpay") {
      if (credentialData.razorpayKeyId) credential.razorpayKeyId = credentialData.razorpayKeyId;
      if (credentialData.razorpayKeySecret)
        credential.razorpayKeySecret = credentialData.razorpayKeySecret;
    }

    credential.lastUpdatedBy = req.user.userId;
    credential.lastUpdatedAt = new Date();

    await credential.save();

    res.status(200).json(
      ApiResponse.success(credential, "Credential updated successfully")
    );
  } catch (error) {
    next(error);
  }
};

// Toggle credential active status
const toggleCredentialStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const credential = await Credentials.findById(id);

    if (!credential) {
      return res.status(404).json(ApiResponse.error("Credential not found"));
    }

    credential.isActive = isActive;
    credential.lastUpdatedBy = req.user.userId;
    credential.lastUpdatedAt = new Date();

    await credential.save();

    res.status(200).json(
      ApiResponse.success(credential, "Credential status updated successfully")
    );
  } catch (error) {
    next(error);
  }
};

// Delete credential
const deleteCredential = async (req, res, next) => {
  try {
    const { id } = req.params;

    const credential = await Credentials.findByIdAndDelete(id);

    if (!credential) {
      return res.status(404).json(ApiResponse.error("Credential not found"));
    }

    res
      .status(200)
      .json(ApiResponse.success(null, "Credential deleted successfully"));
  } catch (error) {
    next(error);
  }
};

// Get active credential by type (for internal use)
const getActiveCredentialByType = async (req, res, next) => {
  try {
    const { type } = req.params;

    const validTypes = ["whatsapp", "email", "razorpay"];
    if (!validTypes.includes(type)) {
      return res.status(400).json(ApiResponse.error("Invalid credential type"));
    }

    const credential = await Credentials.findOne({
      credentialType: type,
      isActive: true,
    });

    if (!credential) {
      return res
        .status(404)
        .json(ApiResponse.error(`No active ${type} credential found`));
    }

    res
      .status(200)
      .json(ApiResponse.success(credential, "Credential retrieved successfully"));
  } catch (error) {
    next(error);
  }
};

// Validate credential (test connection)
const validateCredential = async (req, res, next) => {
  try {
    const { id } = req.params;
    const credential = await Credentials.findById(id);

    if (!credential) {
      return res.status(404).json(ApiResponse.error("Credential not found"));
    }

    let isValid = false;
    let message = "";

    // Test credential based on type
    if (credential.credentialType === "whatsapp") {
      // Simple validation - check if all required fields exist
      isValid =
        !!credential.whatsappAccessToken &&
        !!credential.whatsappPhoneNumberId &&
        !!credential.whatsappBusinessId;
      message = isValid ? "WhatsApp credentials are valid" : "Missing required WhatsApp fields";
    } else if (credential.credentialType === "email") {
      isValid =
        !!credential.emailHost &&
        !!credential.emailPort &&
        !!credential.emailUser &&
        !!credential.emailPassword;
      message = isValid ? "Email credentials are valid" : "Missing required email fields";
    } else if (credential.credentialType === "razorpay") {
      isValid = !!credential.razorpayKeyId && !!credential.razorpayKeySecret;
      message = isValid ? "Razorpay credentials are valid" : "Missing required Razorpay fields";
    }

    res.status(200).json(
      ApiResponse.success(
        { isValid, message, type: credential.credentialType },
        message
      )
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllCredentials,
  getCredentialById,
  createCredential,
  updateCredential,
  toggleCredentialStatus,
  deleteCredential,
  getActiveCredentialByType,
  validateCredential,
};

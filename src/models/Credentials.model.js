const mongoose = require("mongoose");

const credentialsSchema = new mongoose.Schema(
  {
    credentialType: {
      type: String,
      enum: ["whatsapp", "email", "razorpay"],
      required: [true, "Credential type is required"],
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      example: "WhatsApp Production", // For documentation
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    // WhatsApp Specific Fields
    whatsappAccessToken: {
      type: String,
      default: null,
    },
    whatsappPhoneNumberId: {
      type: String,
      default: null,
    },
    whatsappBusinessId: {
      type: String,
      default: null,
    },

    // Email Specific Fields
    emailHost: {
      type: String,
      default: null,
    },
    emailPort: {
      type: Number,
      default: null,
    },
    emailUser: {
      type: String,
      default: null,
    },
    emailPassword: {
      type: String,
      default: null,
    },
    adminEmail: {
      type: String,
      default: null,
    },

    // Razorpay Specific Fields
    razorpayKeyId: {
      type: String,
      default: null,
    },
    razorpayKeySecret: {
      type: String,
      default: null,
    },

    // Status and Metadata
    isActive: {
      type: Boolean,
      default: true,
    },
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    lastUpdatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Enable getters for sensitive fields
credentialsSchema.set("toJSON", {
  transform: (doc, ret) => {
    // Return all fields as stored in database
    return ret;
  },
});

const Credentials = mongoose.model("Credentials", credentialsSchema);

module.exports = Credentials;

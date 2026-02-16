const mongoose = require("mongoose");
const crypto = require("crypto");

// AES encryption utility functions
const cipher_key = process.env.CIPHER_KEY || "your-32-character-secret-key-1234";

const encryptValue = (value) => {
  if (!value) return null;
  const algorithm = "aes-256-cbc";
  const key = crypto.scryptSync(cipher_key, "salt", 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(value, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
};

const decryptValue = (encryptedValue) => {
  if (!encryptedValue) return null;
  const algorithm = "aes-256-cbc";
  const key = crypto.scryptSync(cipher_key, "salt", 32);
  const parts = encryptedValue.split(":");
  const iv = Buffer.from(parts[0], "hex");
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(parts[1], "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
};

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
      set: (value) => encryptValue(value),
      get: (value) => decryptValue(value),
    },
    whatsappPhoneNumberId: {
      type: String,
      default: null,
      set: (value) => encryptValue(value),
      get: (value) => decryptValue(value),
    },
    whatsappBusinessId: {
      type: String,
      default: null,
      set: (value) => encryptValue(value),
      get: (value) => decryptValue(value),
    },

    // Email Specific Fields
    emailHost: {
      type: String,
      default: null,
      set: (value) => encryptValue(value),
      get: (value) => decryptValue(value),
    },
    emailPort: {
      type: Number,
      default: null,
    },
    emailUser: {
      type: String,
      default: null,
      set: (value) => encryptValue(value),
      get: (value) => decryptValue(value),
    },
    emailPassword: {
      type: String,
      default: null,
      set: (value) => encryptValue(value),
      get: (value) => decryptValue(value),
    },
    adminEmail: {
      type: String,
      default: null,
      set: (value) => encryptValue(value),
      get: (value) => decryptValue(value),
    },

    // Razorpay Specific Fields
    razorpayKeyId: {
      type: String,
      default: null,
      set: (value) => encryptValue(value),
      get: (value) => decryptValue(value),
    },
    razorpayKeySecret: {
      type: String,
      default: null,
      set: (value) => encryptValue(value),
      get: (value) => decryptValue(value),
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
  getters: true,
  transform: (doc, ret) => {
    // Remove encrypted raw data, only return decrypted values
    return ret;
  },
});

credentialsSchema.set("toObject", { getters: true });

const Credentials = mongoose.model("Credentials", credentialsSchema);

module.exports = Credentials;

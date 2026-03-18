const mongoose = require("mongoose");
const { hashPassword } = require("../utils/auth.utils");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [50, "Name cannot exceed 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
    },
    phone: {
      type: String,
      required: false,
      match: [/^[0-9]{10,15}$/, "Please enter a valid phone number (10-15 digits)"],
    },
    location: {
      type: String,
      trim: true,
      default: "",
    },

    role: {
      type: String,
      enum: ["patient", "admin"],
      default: "patient",
      required: true,
      validate: {
        validator: function (v) {
          // Ensure role is properly set
          return ['patient', 'admin'].includes(v);
        },
        message: props => `${props.value} is not a valid role!`
      }
    },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
    },
    subscription: {
      type: String,
      enum: ["daily", "weekly", "monthly", "none"],
      default: "none",
    },
    healthProfile: {
      primaryConcern: String,
      painIntensity: { type: Number, min: 1, max: 10 }, // 1-10 scale
      priorTreatments: String,
      medicalHistory: String,
      allergies: String,
      medications: String,
      emergencyContact: String,
      additionalNotes: String,
      // Dynamic questionnaire responses
      questionnaireResponses: {
        type: Map,
        of: String,
        default: () => new Map()
      },
      // Store questionnaire metadata
      questionnaireMetadata: {
        questionnaireId: String,
        completedAt: Date,
        responses: [{
          questionId: String,
          questionText: String,
          answer: String,
          questionType: String,
          timestamp: { type: Date, default: Date.now }
        }]
      }
    },
    profilePicture: {
      type: String, // URL to the image
      default: null,
    },
    joinDate: {
      type: Date,
      default: Date.now,
    },
    resetPasswordToken: {
      type: String,
      default: false,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
    },
    hasTempPassword: {
      type: Boolean,
      default: false,
    },
    doctorProfile: {
      name: String,
      experience: String,
      specialization: String,
      certifications: [{ type: String }],
      certificationNames: [{ type: String }],
      bio: String,
      education: String,
      languages: [{ type: String }],
      fee: String,
      availability: String,
    },
    assignedServices: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      default: []
    }],
    subscriptionInfo: {
      planId: String,
      planName: String,
      status: {
        type: String,
        enum: ['active', 'inactive', 'expired'],
        default: 'inactive'
      },
      startDate: Date,
      endDate: Date,
      isExpired: {
        type: Boolean,
        default: false
      }
    },
    freeConsultationsUsed: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true,
  }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    this.password = await hashPassword(this.password);
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save hook to ensure role integrity
userSchema.pre('save', function (next) {
  // Ensure role is always set
  if (!this.role) {
    this.role = 'patient';
  }

  // Validate role
  if (!['patient', 'admin'].includes(this.role)) {
    return next(new Error(`Invalid role: ${this.role}`));
  }

  next();
});

module.exports = mongoose.model("User", userSchema);

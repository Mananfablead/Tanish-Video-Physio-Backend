const User = require('../models/User.model');
const { generateToken } = require('../config/jwt');
const { hashPassword, comparePassword } = require('../utils/auth.utils');
const ApiResponse = require('../utils/apiResponse');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { createTransport } = nodemailer;

// Register a new user
const register = async (req, res, next) => {
    try {
        const { name, email, password, phone } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json(ApiResponse.error('User already exists with this email'));
        }

        // Create new user
        const user = new User({
            name,
            email,
            password,
            phone
            // role will default to 'patient' as per schema
        });


        await user.save();

        // Generate token
        const token = generateToken({ userId: user._id, role: user.role });

        res.status(201).json(
            ApiResponse.success({
                token,
                user: {
                    id: user._id,
                    email: user.email,
                    name: user.name,
                    role: user.role
                }
            }, 'User registered successfully')
        );
    } catch (error) {
        next(error);
    }
};

// Login user
const login = async (req, res, next) => {
    try {

        const { email, password } = req.body;

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res
                .status(401)
                .json(ApiResponse.error("Invalid email or password", 401));
        }


        // Check if password is properly hashed
        if (!user.password || typeof user.password !== 'string' || user.password.length < 10) {
            return res
                .status(401)
                .json(ApiResponse.error("Invalid email or password", 401));
        }

        const isMatch = await comparePassword(password, user.password);

        if (!isMatch) {
            return res
                .status(401)
                .json(ApiResponse.error("Invalid email or password", 401));
        }

        // Generate token
        const token = generateToken({
            userId: user._id,
            role: user.role,
        });

        console.log("🎟️ JWT token generated for user:", {
            userId: user._id.toString(),
            role: user.role,
        });

        res.status(200).json(
            ApiResponse.success(
                {
                    token,
                    user: {
                        id: user._id,
                        email: user.email,
                        name: user.name,
                        role: user.role,
                    },
                },
                "Login successful"
            )
        );

        console.log("🎉 Login successful for:", email);
    } catch (error) {
        console.error("🔥 Login error:", error.message);
        next(error);
    }
};


// Logout user
const logout = async (req, res, next) => {
    try {
        // In a real application, you might want to add the token to a blacklist
        res.status(200).json(ApiResponse.success(null, 'User logged out successfully'));
    } catch (error) {
        next(error);
    }
};

// Get user profile
const getProfile = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.userId).select('-password');
        if (!user) {
            return res.status(404).json(ApiResponse.error('User not found'));
        }

        // If user has a profile picture, convert to full URL
        if (user.profilePicture && user.profilePicture.startsWith('/uploads/')) {
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            user.profilePicture = `${baseUrl}${user.profilePicture}`;
        }

        res.status(200).json(ApiResponse.success(user, 'Profile retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Update user profile
const updateProfile = async (req, res, next) => {
    try {
        const { name, phone } = req.body;

        // Handle healthProfile - it may come as a JSON string when using form data
        let healthProfile = req.body.healthProfile;
        if (typeof healthProfile === 'string') {
            try {
                healthProfile = JSON.parse(healthProfile);
            } catch (e) {
                // If it's not JSON, create an object from individual fields
                healthProfile = {};
                Object.keys(req.body).forEach(key => {
                    if (key.startsWith('healthProfile[')) {
                        const field = key.match(/healthProfile\[(.*?)\]/)[1];
                        if (!healthProfile[field]) {
                            healthProfile[field] = req.body[key];

                            // Convert numeric fields
                            if (field === 'painIntensity') {
                                healthProfile[field] = parseInt(req.body[key]) || null;
                            }
                        }
                    }
                });
            }
        }

        // Handle profile picture if uploaded
        let profilePicture = null;
        if (req.file) {
            // Create full URL for the image
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            profilePicture = `${baseUrl}/uploads/profile-pictures/${req.file.filename}`;
        }

        const updateData = { name, phone };
        if (healthProfile && Object.keys(healthProfile).length > 0) {
            updateData.healthProfile = healthProfile;
        }
        if (profilePicture) {
            updateData.profilePicture = profilePicture;
        }

        const user = await User.findByIdAndUpdate(
            req.user.userId,
            updateData,
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json(ApiResponse.error('User not found'));
        }

        // If user has a profile picture, convert to full URL
        if (user.profilePicture && user.profilePicture.startsWith('/uploads/')) {
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            user.profilePicture = `${baseUrl}${user.profilePicture}`;
        }

        res.status(200).json(ApiResponse.success(user, 'Profile updated successfully'));
    } catch (error) {
        next(error);
    }
};

// Create admin user (for initial setup only)
const createAdminUser = async (req, res, next) => {
    try {
        const { name, email, password } = req.body;

        // Validation
        if (!name || !email || !password) {
            return res.status(400).json(ApiResponse.error('Name, email, and password are required'));
        }

        // Check if an admin user already exists
        const existingAdmin = await User.findOne({ role: 'admin' });
        if (existingAdmin) {
            return res.status(400).json(ApiResponse.error('An admin user already exists'));
        }

        // Check if user with this email already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json(ApiResponse.error('A user with this email already exists'));
        }

        // Create new admin user
        const adminUser = new User({
            name,
            email,
            password,
            role: 'admin'
        });

        await adminUser.save();

        // Generate token
        const token = generateToken({ userId: adminUser._id, role: adminUser.role });

        res.status(201).json(
            ApiResponse.success({
                token,
                user: {
                    id: adminUser._id,
                    email: adminUser.email,
                    name: adminUser.name,
                    role: adminUser.role
                }
            }, 'Admin user created successfully')
        );
    } catch (error) {
        next(error);
    }
};

// Forgot password - initiate password reset
const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json(ApiResponse.error('Email is required'));
        }

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json(ApiResponse.error('User not found with this email'));
        }

        // Generate password reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = Date.now() + 3600000; // 1 hour

        // Save reset token and expiry to user
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = resetTokenExpiry;
        await user.save({ validateBeforeSave: false });

        // Create transporter for sending email
        const transporter = createTransport({
            service: 'gmail',
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        // Prepare email
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
        const message = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Password Reset</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>

<body style="margin:0; padding:0; background-color:#f4f6f8; font-family:Arial, Helvetica, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f8; padding:30px 0;">
    <tr>
      <td align="center">

        <!-- Main Container -->
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 6px 18px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#667eea,#764ba2); padding:30px; text-align:center; color:#ffffff;">
              <h1 style="margin:0; font-size:26px;">Tanish Physio</h1>
              <p style="margin:8px 0 0; font-size:14px; opacity:0.9;">
                Physical Therapy & Rehabilitation Center
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:35px; color:#333333;">
              <h2 style="margin-top:0; font-size:22px; color:#222;">
                Password Reset Request
              </h2>

              <p style="font-size:15px; line-height:1.6;">
                Hello <strong>${user.name}</strong>,
              </p>

              <p style="font-size:15px; line-height:1.6;">
                We received a request to reset the password for your <strong>Tanish Physio</strong> account.
                Click the button below to securely reset your password.
              </p>

              <!-- Button -->
              <table cellpadding="0" cellspacing="0" width="100%" style="margin:25px 0;">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}"
                       style="background:linear-gradient(135deg,#667eea,#764ba2);
                              color:#ffffff;
                              text-decoration:none;
                              padding:14px 34px;
                              border-radius:6px;
                              font-size:15px;
                              font-weight:bold;
                              display:inline-block;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="font-size:14px; color:#555; line-height:1.6;">
                ⚠️ This password reset link will expire in <strong>1 hour</strong> for security reasons.
              </p>

              <p style="font-size:14px; color:#555; line-height:1.6;">
                If you did not request this reset, you can safely ignore this email.
                Your password will remain unchanged.
              </p>

              <p style="font-size:15px; margin-top:30px;">
                Regards,<br>
                <strong>Tanish Physio Team</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f1f3f6; padding:20px; text-align:center; font-size:12px; color:#777;">
              <p style="margin:0;">
                © 2024 Tanish Physio. All rights reserved.
              </p>
              <p style="margin:6px 0 0;">
                This is an automated email. Please do not reply.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
`;

        const mailOptions = {
            to: user.email,
            from: process.env.EMAIL_USER,
            subject: 'Password Reset Request - Tanish Physio',
            html: message
        };

        // Send email
        await transporter.sendMail(mailOptions);

        res.status(200).json(ApiResponse.success(null, 'Password reset email sent successfully'));
    } catch (error) {
        // Clear reset token if error occurs
        if (req.user) {
            req.user.resetPasswordToken = undefined;
            req.user.resetPasswordExpires = undefined;
            await req.user.save({ validateBeforeSave: false });
        }

        next(error);
    }
};

// Reset password - complete password reset
const resetPassword = async (req, res, next) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        if (!password) {
            return res.status(400).json(ApiResponse.error('New password is required'));
        }

        if (password.length < 6) {
            return res.status(400).json(ApiResponse.error('Password must be at least 6 characters long'));
        }

        // Find user by reset token
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json(ApiResponse.error('Password reset token is invalid or has expired'));
        }

        // Update user password and clear reset token
        // The pre-save hook will hash the password automatically
        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();

        res.status(200).json(ApiResponse.success(null, 'Password reset successfully'));
    } catch (error) {
        next(error);
    }
};

// Update password for authenticated user
const updatePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json(ApiResponse.error('Current password and new password are required'));
        }

        if (newPassword.length < 6) {
            return res.status(400).json(ApiResponse.error('New password must be at least 6 characters long'));
        }

        // Get user from token (req.user is populated by auth middleware)
        const user = await User.findById(req.user.userId).select('+password');

        if (!user) {
            return res.status(404).json(ApiResponse.error('User not found'));
        }

        // Check current password
        const isMatch = await comparePassword(currentPassword, user.password);

        if (!isMatch) {
            return res.status(400).json(ApiResponse.error('Current password is incorrect'));
        }

        // Set new password (will be hashed by pre-save hook)
        user.password = newPassword;
        await user.save();

        res.status(200).json(ApiResponse.success(null, 'Password updated successfully'));
    } catch (error) {
        next(error);
    }
};

module.exports = {
    register,
    login,
    logout,
    getProfile,
    updateProfile,
    createAdminUser,
    forgotPassword,
    resetPassword,
    updatePassword
};
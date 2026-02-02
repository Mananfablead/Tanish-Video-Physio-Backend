const User = require('../models/User.model');
const Subscription = require('../models/Subscription.model');
const Booking = require('../models/Booking.model');
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

        // Generate token with explicit userId string conversion
        const token = generateToken({ userId: user._id.toString(), role: user.role });

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

        // Check if user is active
        if (user.status !== 'active') {
            return res
                .status(401)
                .json(ApiResponse.error("Account is not active. Please contact support.", 401));
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

        // Generate token with explicit string conversion
        const token = generateToken({
            userId: user._id.toString(),
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

        // Get user's subscriptions (both active and recent ones)
        const subscriptions = await Subscription.find({
            userId: req.user.userId
        })
            .sort({ createdAt: -1 })
            .limit(5); // Get last 5 subscriptions

        // Find the most relevant subscription (active/paid or most recent)
        let activeSubscription = null;

        // First check for active subscriptions
        activeSubscription = subscriptions.find(sub =>
            sub.status === 'active' || sub.status === 'paid'
        ) || null;

        // If no active subscription found, get the most recent one
        if (!activeSubscription && subscriptions.length > 0) {
            activeSubscription = subscriptions[0];
        }

        // Get user's bookings with service information
        const userBookings = await Booking.find({
            userId: req.user.userId
        })
            .populate('serviceId')
            .sort({ createdAt: -1 });

        // Get active services from bookings (only services user has purchased)
        const purchasedServices = userBookings
            .filter(booking =>
                booking.serviceId &&
                booking.serviceId.status === 'active' &&
                booking.status === 'confirmed' &&
                booking.paymentStatus === 'paid'
            )
            .map(booking => ({
                id: booking.serviceId._id,
                name: booking.serviceId.name,
                description: booking.serviceId.description,
                category: booking.serviceId.category,
                price: booking.serviceId.price,
                duration: booking.serviceId.duration,
                bookingId: booking._id,
                bookingDate: booking.date,
                bookingTime: booking.time,
                bookingStatus: booking.status,
                paymentStatus: booking.paymentStatus,
                amountPaid: booking.amount
            }));

        // Add subscription data and purchased services to the response
        const responseData = {
            ...user.toObject(),
            subscriptionData: activeSubscription ? {
                id: activeSubscription._id,
                planId: activeSubscription.planId,
                planName: activeSubscription.planName,
                amount: activeSubscription.amount,
                currency: activeSubscription.currency,
                status: activeSubscription.status,
                startDate: activeSubscription.startDate,
                endDate: activeSubscription.endDate,
                createdAt: activeSubscription.createdAt
            } : null,
            purchasedServices: purchasedServices
        };

        res.status(200).json(ApiResponse.success(responseData, 'Profile retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Get all admin profiles (fully public endpoint)
const getAllAdminProfiles = async (req, res, next) => {
    try {
        // Get all admin users
        const admins = await User.find({ role: 'admin' }).select('-password -resetPasswordToken -resetPasswordExpires');
        
        if (!admins || admins.length === 0) {
            return res.status(404).json(ApiResponse.error('No admin users found'));
        }

        // Process each admin's data for public consumption
        const publicAdminData = admins.map(admin => {
            // Convert profile picture to full URL if it exists
            let profilePictureUrl = admin.profilePicture;
            if (admin.profilePicture && admin.profilePicture.startsWith('/uploads/')) {
                const baseUrl = `${req.protocol}://${req.get('host')}`;
                profilePictureUrl = `${baseUrl}${admin.profilePicture}`;
            }

            // Convert certification URLs to full URLs if they exist
            let certificationsUrls = admin.doctorProfile?.certifications || [];
            if (certificationsUrls.length > 0) {
                const baseUrl = `${req.protocol}://${req.get('host')}`;
                certificationsUrls = certificationsUrls.map(cert => {
                    if (cert && cert.startsWith('/uploads/')) {
                        return `${baseUrl}${cert}`;
                    }
                    return cert;
                });
            }

            return {
                id: admin._id,
                name: admin.name,
                email: admin.email,
                role: admin.role,
                profilePicture: profilePictureUrl,
                doctorProfile: admin.doctorProfile ? {
                    name: admin.doctorProfile.name,
                    experience: admin.doctorProfile.experience,
                    specialization: admin.doctorProfile.specialization,
                    bio: admin.doctorProfile.bio,
                    education: admin.doctorProfile.education,
                    languages: admin.doctorProfile.languages,
                    certifications: certificationsUrls
                } : null,
                joinDate: admin.joinDate
            };
        });

        res.status(200).json(ApiResponse.success(publicAdminData, 'All admin profiles retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Get public admin profile (publicly accessible but only for admin users)
const getPublicProfile = async (req, res, next) => {
    try {
        const { userId } = req.params;
        
        // Only allow access to admin user profiles
        const user = await User.findById(userId).select('-password -resetPasswordToken -resetPasswordExpires');
        if (!user) {
            return res.status(404).json(ApiResponse.error('User not found'));
        }

        // Check if user is admin
        if (user.role !== 'admin') {
            return res.status(403).json(ApiResponse.error('Access denied. Only admin profiles are publicly accessible.'));
        }

        // If user has a profile picture, convert to full URL
        if (user.profilePicture && user.profilePicture.startsWith('/uploads/')) {
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            user.profilePicture = `${baseUrl}${user.profilePicture}`;
        }

        // Prepare admin-specific public data
        const publicAdminData = {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            profilePicture: user.profilePicture,
            doctorProfile: user.doctorProfile ? {
                name: user.doctorProfile.name,
                experience: user.doctorProfile.experience,
                specialization: user.doctorProfile.specialization,
                bio: user.doctorProfile.bio,
                education: user.doctorProfile.education,
                languages: user.doctorProfile.languages,
                certifications: user.doctorProfile.certifications
            } : null,
            joinDate: user.joinDate
        };

        res.status(200).json(ApiResponse.success(publicAdminData, 'Admin profile retrieved successfully'));
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

        // Handle doctorProfile - it may come as a JSON string when using form data
        let doctorProfile = req.body.doctorProfile;
        if (typeof doctorProfile === 'string') {
            try {
                doctorProfile = JSON.parse(doctorProfile);
            } catch (e) {
                // If it's not JSON, create an object from individual fields
                doctorProfile = {};
                Object.keys(req.body).forEach(key => {
                    if (key.startsWith('doctorProfile[')) {
                        const field = key.match(/doctorProfile\[(.*?)\]/)[1];
                        if (!doctorProfile[field]) {
                            doctorProfile[field] = req.body[key];
                        }
                    }
                });
            }
        }

        // Handle profile picture if uploaded
        let profilePicture = null;
        if (req.files && req.files['profilePicture'] && req.files['profilePicture'].length > 0) {
            // Create full URL for the image
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            profilePicture = `${baseUrl}/uploads/profile-pictures/${req.files['profilePicture'][0].filename}`;
        }

        // Handle certification files if uploaded
        let certifications = [];
        if (req.files && req.files['certifications']) {
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            certifications = req.files['certifications'].map(file => 
                `${baseUrl}/uploads/certifications/${file.filename}`
            );
        }

        const updateData = { name, phone };
        if (healthProfile && Object.keys(healthProfile).length > 0) {
            updateData.healthProfile = healthProfile;
        }
        if (doctorProfile && Object.keys(doctorProfile).length > 0) {
            // Merge existing certifications with new ones if they exist
            if (certifications.length > 0) {
                doctorProfile.certifications = [
                    ...(doctorProfile.certifications || []),
                    ...certifications
                ];
            }
            updateData.doctorProfile = doctorProfile;
        } else if (certifications.length > 0) {
            // If no doctorProfile exists but we have certifications, create one
            updateData.doctorProfile = {
                certifications: certifications
            };
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

        // If user has certifications, convert to full URLs
        if (user.doctorProfile && user.doctorProfile.certifications) {
            user.doctorProfile.certifications = user.doctorProfile.certifications.map(cert => {
                if (cert && cert.startsWith('/uploads/')) {
                    const baseUrl = `${req.protocol}://${req.get('host')}`;
                    return `${baseUrl}${cert}`;
                }
                return cert;
            });
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

        // Log the created admin user ID for debugging
        console.log("🔐 Admin user created with ID:", adminUser._id.toString());

        // Generate token with explicit userId
        const token = generateToken({ 
            userId: adminUser._id.toString(), 
            role: adminUser.role 
        });

        console.log("🎟️ Admin JWT token payload:", {
            userId: adminUser._id.toString(),
            role: adminUser.role
        });

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
    getPublicProfile,
    getAllAdminProfiles,
    updateProfile,
    createAdminUser,
    forgotPassword,
    resetPassword,
    updatePassword
};
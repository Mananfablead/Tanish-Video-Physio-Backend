const Booking = require('../models/Booking.model');
const Service = require('../models/Service.model');
const User = require('../models/User.model');
const ApiResponse = require('../utils/apiResponse');

// Get all bookings for authenticated user
const getAllBookings = async (req, res, next) => {
    try {
        const bookings = await Booking.find({ userId: req.user.userId })
            .populate('serviceId', 'name price duration')
            .populate('therapistId', 'name email role');

        res.status(200).json(ApiResponse.success({ bookings }, 'Bookings retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Get booking by ID
const getBookingById = async (req, res, next) => {
    try {
        // Build query based on user role
        let query;
        if (req.user.role === 'admin') {
            // Admin can access any booking
            query = { _id: req.params.id };
        } else {
            // Regular user can only access their own bookings
            query = { _id: req.params.id, userId: req.user.userId };
        }
        
        const booking = await Booking.findOne(query)
            .populate('serviceId', 'name price duration')
            .populate('therapistId', 'name email role');

        if (!booking) {
            return res.status(404).json(ApiResponse.error('Booking not found or unauthorized'));
        }

        res.status(200).json(ApiResponse.success({ booking }, 'Booking retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Get booking details by ID for both guest and authenticated users (unified endpoint)
const getBookingDetails = async (req, res, next) => {
    try {
        const { id: bookingId } = req.params;
        
        // For guest users, we'll accept email in the request body to verify access
        const { clientEmail } = req.body;
        
        // Find the booking by ID
        const booking = await Booking.findById(bookingId)
            .populate('serviceId', 'name price duration description')
            .populate('therapistId', 'name email role profilePicture');
            
        if (!booking) {
            return res.status(404).json(ApiResponse.error('Booking not found'));
        }
        
        // Check access permissions
        let hasAccess = false;
        
        if (req.user) {
            // Authenticated user - check if booking belongs to them or they're admin
            if (req.user.role === 'admin' || booking.userId.equals(req.user.userId)) {
                hasAccess = true;
            }
        } else if (clientEmail) {
            // Guest user - verify by email
            const user = await User.findOne({ email: clientEmail });
            if (user && booking.userId.equals(user._id)) {
                hasAccess = true;
            }
        }
        
        if (!hasAccess) {
            return res.status(403).json(ApiResponse.error('Unauthorized to access this booking'));
        }
        
        res.status(200).json(ApiResponse.success({ booking }, 'Booking details retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Create a new booking
const createBooking = async (req, res, next) => {
    try {
        const { serviceId, date, time, notes, clientName } = req.body;

        // Validate service exists
        const service = await Service.findById(serviceId);

        if (!service || service.status !== 'active') {
            return res.status(404).json(ApiResponse.error('Service not found or not active'));
        }

        // Automatically assign an available therapist (admin user)
        const therapist = await User.findOne({
            role: 'admin',
            status: 'active'
        });

        if (!therapist) {
            return res.status(404).json(ApiResponse.error('No active therapists available'));
        }

        // Check if booking already exists for this date/time
        const existingBooking = await Booking.findOne({
            therapistId: therapist._id,
            date,
            time,
            status: { $ne: 'cancelled' }
        });

        // if (existingBooking) {
        //     return res.status(400).json(ApiResponse.error('Slot already booked'));
        // }

        const booking = new Booking({
            serviceId,
            serviceName: service.name, // Get from service model
            therapistId: therapist._id,
            therapistName: therapist.name, // Get from therapist model
            userId: req.user.userId, // Assign current user from auth middleware
            clientName: clientName || req.user.name, // Use provided clientName or fall back to authenticated user's name
            date,
            time,
            notes,
            amount: service.price // Get from service model
        });

        await booking.save();

        // Populate the response
        await booking.populate('serviceId', 'name price duration');
        await booking.populate('therapistId', 'name email role');

        res.status(201).json(ApiResponse.success({ booking }, 'Booking created successfully'));
    } catch (error) {
        next(error);
    }
};

// Update booking by ID
const updateBooking = async (req, res, next) => {
    try {
        const { date, time, notes, status } = req.body;

        // Build query based on user role
        let query;
        if (req.user.role === 'admin') {
            // Admin can update any booking
            query = { _id: req.params.id };
        } else {
            // Regular user can only update their own bookings
            query = { _id: req.params.id, userId: req.user.userId };
        }

        // Prepare update data
        const updateData = { date, time, notes };
        if (status !== undefined) {
            // Validate status if provided
            const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json(ApiResponse.error('Invalid status. Valid statuses: pending, confirmed, completed, cancelled'));
            }
            updateData.status = status;
        }

        const booking = await Booking.findOneAndUpdate(
            query,
            updateData,
            { new: true, runValidators: true }
        )
            .populate('serviceId', 'name price duration')
            .populate('therapistId', 'name email role');

        if (!booking) {
            return res.status(404).json(ApiResponse.error('Booking not found or unauthorized'));
        }

        res.status(200).json(ApiResponse.success({ booking }, 'Booking updated successfully'));
    } catch (error) {
        next(error);
    }
};

// Update booking status by ID
const updateBookingStatus = async (req, res, next) => {
    try {
        const { status } = req.body;

        // Validate status
        const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json(ApiResponse.error('Invalid status. Valid statuses: pending, confirmed, completed, cancelled'));
        }

        // Build query based on user role
        let query;
        if (req.user.role === 'admin') {
            // Admin can update status of any booking
            query = { _id: req.params.id };
        } else {
            // Regular user can only update status of their own bookings
            query = { _id: req.params.id, userId: req.user.userId };
        }
        
        const booking = await Booking.findOneAndUpdate(
            query,
            { status },
            { new: true, runValidators: true }
        )
            .populate('serviceId', 'name price duration')
            .populate('therapistId', 'name email role');

        if (!booking) {
            return res.status(404).json(ApiResponse.error('Booking not found or unauthorized'));
        }

        res.status(200).json(ApiResponse.success({ booking }, `Booking status updated to ${status} successfully`));
    } catch (error) {
        next(error);
    }
};

// Delete/cancel booking by ID
const deleteBooking = async (req, res, next) => {
    try {
        // Build query based on user role
        let query;
        if (req.user.role === 'admin') {
            // Admin can delete/cancel any booking
            query = { _id: req.params.id };
        } else {
            // Regular user can only delete/cancel their own bookings
            query = { _id: req.params.id, userId: req.user.userId };
        }
        
        const booking = await Booking.findOneAndUpdate(
            query,
            { status: 'cancelled' },
            { new: true }
        )
            .populate('serviceId', 'name price duration')
            .populate('therapistId', 'name email role');

        if (!booking) {
            return res.status(404).json(ApiResponse.error('Booking not found or unauthorized'));
        }

        res.status(200).json(ApiResponse.success({ booking }, 'Booking cancelled successfully'));
    } catch (error) {
        next(error);
    }
};

// Update booking status by ID for guest users
const updateGuestBookingStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        const { id: bookingId } = req.params; // Changed from bookingId to id to match the route parameter

        // Validate status
        const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json(ApiResponse.error('Invalid status. Valid statuses: pending, confirmed, completed, cancelled'));
        }

        // For guest users, we'll identify the booking by ID and require some identifying information
        // Since guest bookings might be associated with an email, we'll accept email in the request body
        const { clientEmail } = req.body;

        if (!clientEmail) {
            return res.status(400).json(ApiResponse.error('Client email is required for guest booking status update'));
        }

        // Find the booking by ID
        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return res.status(404).json(ApiResponse.error('Booking not found'));
        }

        // Verify that the booking is associated with the provided email
        // This can be done by checking if the user with the provided email owns this booking
        const user = await User.findOne({ email: clientEmail });

        if (user && booking.userId.equals(user._id)) {
            // If the user exists and the booking belongs to them, allow status update
            const updatedBooking = await Booking.findOneAndUpdate(
                { _id: bookingId, userId: user._id },
                { status },
                { new: true, runValidators: true }
            );

            if (!updatedBooking) {
                return res.status(404).json(ApiResponse.error('Booking not found or unauthorized'));
            }

            // Populate the booking before sending response
            await updatedBooking.populate('serviceId', 'name price duration');
            await updatedBooking.populate('therapistId', 'name email role');

            res.status(200).json(ApiResponse.success({ booking: updatedBooking }, `Booking status updated to ${status} successfully`));
        } else {
            // For guest bookings, we need to verify the booking is associated with the provided email
            // We can check if the booking was created for a user with this email
            const bookingUser = await User.findById(booking.userId);

            if (bookingUser && bookingUser.email === clientEmail) {
                // Update the booking status for guest bookings
                // Only allow certain status changes for guest bookings
                if (['cancelled'].includes(status)) {
                    // Only allow cancelling for guest bookings to prevent unauthorized status changes
                    const updatedBooking = await Booking.findByIdAndUpdate(
                        bookingId,
                        { status },
                        { new: true, runValidators: true }
                    );

                    if (!updatedBooking) {
                        return res.status(404).json(ApiResponse.error('Booking not found'));
                    }

                    // Populate the booking before sending response
                    await updatedBooking.populate('serviceId', 'name price duration');
                    await updatedBooking.populate('therapistId', 'name email role');

                    res.status(200).json(ApiResponse.success({ booking: updatedBooking }, `Booking status updated to ${status} successfully`));
                } else {
                    return res.status(403).json(ApiResponse.error('Unauthorized to update booking status to this value for guest bookings'));
                }
            } else {
                return res.status(403).json(ApiResponse.error('Unauthorized to update this booking status'));
            }
        }
    } catch (error) {
        next(error);
    }
};

// Get all bookings for admin
const getAllBookingsForAdmin = async (req, res, next) => {
    try {
        // Only allow admin users to access all bookings
        if (req.user.role !== 'admin') {
            return res.status(403).json(ApiResponse.error('Access denied. Admin access only.'));
        }

        const bookings = await Booking.find()
            .populate('serviceId', 'name price duration')
            .populate('therapistId', 'name email role')
            .populate('userId', 'name email phone');

        res.status(200).json(ApiResponse.success({ bookings }, 'All bookings retrieved successfully')); 
    } catch (error) {
        next(error);
    }
};

// Get bookings by status
const getBookingsByStatus = async (req, res, next) => {
    try {
        const { status } = req.params;

        // Build query based on user role
        let query;
        if (req.user.role === 'admin') {
            // Admin can see all bookings with the specified status
            query = { status: status };
        } else {
            // Regular user can only see their own bookings with the specified status
            query = { userId: req.user.userId, status: status };
        }
        
        const bookings = await Booking.find(query)
            .populate('serviceId', 'name price duration')
            .populate('therapistId', 'name email role');

        res.status(200).json(ApiResponse.success({ bookings }, `Bookings with status '${status}' retrieved successfully`));
    } catch (error) {
        next(error);
    }
};

// Create a new booking for guest users
const createGuestBooking = async (req, res, next) => {
    try {
        const { serviceId, date, time, notes, clientName, clientEmail, clientPhone } = req.body;

        // Validate required fields for guest booking
        if (!clientName || !clientEmail || !clientPhone) {
            return res.status(400).json(ApiResponse.error("Name, email, and phone are required for guest booking"));
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(clientEmail)) {
            return res.status(400).json(ApiResponse.error("Invalid email format"));
        }

        // Validate service exists
        const service = await Service.findById(serviceId);

        if (!service || service.status !== 'active') {
            return res.status(404).json(ApiResponse.error('Service not found or not active'));
        }

        // Check if user already exists
        let user = await User.findOne({ email: clientEmail });

        if (user) {
            // Check if there's already a booking with paid status for this user for the same slot
            const existingPaidBooking = await Booking.findOne({
                userId: user._id,
                paymentStatus: 'paid',
                serviceId: serviceId,
                date: date,
                time: time
            });

            if (existingPaidBooking) {
                // If there's already a paid booking for this slot, return appropriate message
                return res.status(409).json(ApiResponse.error(`You already have a paid booking for this time slot.`));
            }

            // If user exists but doesn't have a paid booking for this slot, use existing user
            // This allows users to make additional bookings
        } else {
            // Create a new user account with temporary password
            const tempPassword = Math.random().toString(36).slice(-8) + 'Temp1!'; // Generate temporary password

            user = new User({
                name: clientName,
                email: clientEmail,
                password: tempPassword, // Will be hashed by the pre-save hook
                phone: clientPhone,
                role: 'patient',
                status: 'active'
            });

            await user.save();
        }

        // Automatically assign an available therapist (admin user)
        const therapist = await User.findOne({
            role: 'admin',
            status: 'active'
        });

        if (!therapist) {
            return res.status(404).json(ApiResponse.error('No active therapists available'));
        }

        const booking = new Booking({
            serviceId,
            serviceName: service.name, // Get from service model
            therapistId: therapist._id,
            therapistName: therapist.name, // Get from therapist model
            userId: user._id, // Assign the newly created user
            clientName: clientName,
            date,
            time,
            notes,
            amount: service.price, // Get from service model
            paymentStatus: 'pending' // Initially pending until payment is made
        });

        await booking.save();

        // Populate the response
        await booking.populate('serviceId', 'name price duration');
        await booking.populate('therapistId', 'name email role');

        res.status(201).json(ApiResponse.success({
            booking,
            message: 'Account created and booking made successfully. Login credentials will be sent after payment verification.'
        }, 'Account created and booking made successfully. Login credentials will be sent after payment verification.'));
    } catch (error) {
        next(error);
    }
};

// Helper function to send welcome email with credentials
async function sendWelcomeEmail(email, name, username, password) {
    const nodemailer = require('nodemailer');
    const { createTransport } = nodemailer;

    const transporter = createTransport({
        service: 'gmail',
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    const message = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Welcome to Tanish Physio</title>
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
                Welcome to Tanish Physio
              </h2>

              <p style="font-size:15px; line-height:1.6;">
                Hello <strong>${name}</strong>,
              </p>

              <p style="font-size:15px; line-height:1.6;">
                Thank you for booking a session with us! Your account has been created successfully.
              </p>
              
              <p style="font-size:15px; line-height:1.6;">
                <strong>Login Credentials:</strong><br>
                Email: ${username}<br>
                Temporary Password: ${password}
              </p>
              
              <p style="font-size:15px; line-height:1.6; color: #ff6b6b; font-weight: bold;">
                IMPORTANT: Please change your password after first login for security.
              </p>

              <p style="font-size:15px; line-height:1.6;">
                You can now log in to your account and manage your bookings.
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
        to: email,
        from: process.env.EMAIL_USER,
        subject: 'Welcome to Tanish Physio - Account Created',
        html: message
    };

    // Send email
    await transporter.sendMail(mailOptions);
}

module.exports = {
    getAllBookings,
    getBookingById,
    createBooking,
    createGuestBooking, // Add the new function
    updateBooking,
    updateBookingStatus,
    updateGuestBookingStatus,
    deleteBooking,
    getBookingsByStatus,
    getAllBookingsForAdmin,
    getBookingDetails // Single unified function
};
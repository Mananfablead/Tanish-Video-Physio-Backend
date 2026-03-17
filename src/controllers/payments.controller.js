const razorpay = require('../config/razorpay');
const Booking = require('../models/Booking.model');
const Payment = require('../models/Payment.model');
const Service = require('../models/Service.model');
const Subscription = require('../models/Subscription.model');
const SubscriptionPlan = require('../models/SubscriptionPlan.model');
const User = require('../models/User.model');
const ApiResponse = require('../utils/apiResponse');
const { hashPassword } = require('../utils/auth.utils');
const { generateToken } = require('../config/jwt');
const NotificationService = require('../services/notificationService');
const { sendWelcomeEmail } = require('../services/email.service');

// Utility function to calculate end date based on plan validity
async function calculateEndDate(planId, startDate = new Date()) {
    const endDate = new Date(startDate);

    // Find the subscription plan to get validity days
    const plan = await SubscriptionPlan.findOne({ planId });

    if (!plan) {
        // Fallback to default monthly if plan not found
        endDate.setMonth(endDate.getMonth() + 1);
        return endDate;
    }

    // Use the plan's validityDays or calculate based on duration
    const validityDays = plan.validityDays ||
        (function () {
            switch (plan.duration) {
                case 'monthly': return 30;
                case 'quarterly': return 90;
                case 'half-yearly': return 180;
                case 'yearly': return 365;
                default: return 30;
            }
        })();

    endDate.setDate(endDate.getDate() + validityDays);
    return endDate;
}

// Utility function to update subscription status and dates
async function activateSubscription(subscriptionId) {
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) {
        throw new Error('Subscription not found');
    }

    // Calculate end date based on plan validity
    const endDate = await calculateEndDate(subscription.planId, new Date());

    // Calculate next billing date (same as end date for now)
    const nextBillingDate = new Date(endDate);

    // Update subscription
    await Subscription.findByIdAndUpdate(subscriptionId, {
        status: 'active',
        startDate: new Date(),
        endDate: endDate,
        nextBillingDate: nextBillingDate,
        activatedAt: new Date(),
        // Preserve coupon information
        finalAmount: subscription.finalAmount,
        discountAmount: subscription.discountAmount,
        couponCode: subscription.couponCode,
        // Preserve therapistId if it exists
        therapistId: subscription.therapistId
    });

    return await Subscription.findById(subscriptionId);
}
// Helper function to send welcome email with login credentials
async function sendWelcomeEmailWithCredentials(email, name, username, password) {
    const nodemailer = require('nodemailer');
    const { createTransport } = nodemailer;
    const { getEmailCredentials } = require('../utils/credentialsManager');

    try {


        // Get email credentials from database
        const emailCreds = await getEmailCredentials();
        if (!emailCreds) {
            console.error('Email configuration not found for welcome email');
            return;
        }

        console.log('📧 Email creds loaded', {
            host: emailCreds.host,
            port: emailCreds.port,
            user: emailCreds.user ? emailCreds.user.slice(0, 3) + '***' : null
        });

        // Use host/port config (works for Gmail/SMTP) with correct TLS flag
        const transporter = createTransport({
            host: emailCreds.host,
            port: emailCreds.port,
            secure: emailCreds.port === 465, // true for SMTPS
            auth: {
                user: emailCreds.user,
                pass: emailCreds.password
            }
        });

        // Ensure transporter is valid before attempting send
        await transporter.verify();
        console.log('✅ Transporter verified for welcome email');

        const message = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
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
                Thank you for booking a session with us and completing the payment! Your account has been created successfully and your booking is confirmed.
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
            // from: emailCreds.user,
            from: `"Tanish Physio & Fitness" <${emailCreds.user}>`,
            subject: 'Welcome to Tanish Physio - Account Created & Payment Verified',
            html: message
        };

        // Send email
        const info = await transporter.sendMail(mailOptions);

    } catch (error) {
        console.error('❌ Error sending welcome email', {
            message: error.message,
            code: error.code,
            command: error.command,
            response: error.response,
            stack: error.stack
        });
    }
}

// Create a payment order for Razorpay
const createOrder = async (req, res, next) => {
    try {
        const { bookingId, amount, currency = 'INR', couponCode } = req.body;

        // Verify the booking belongs to the user
        const booking = await Booking.findOne({ _id: bookingId, userId: req.user.userId }).populate('serviceId');
        if (!booking) {
            return res.status(404).json(ApiResponse.error('Booking not found'));
        }

        // Get original service price for coupon calculation
        const originalServicePrice = booking.serviceId ? booking.serviceId.price : amount;

        let validatedAmount = amount;

        // If coupon code is provided, re-validate it before creating payment order
        if (couponCode) {
            const Offer = require('../models/Offer');
            const offer = await Offer.findOne({ code: couponCode.toUpperCase() }).populate('appliesToUsers', '_id');

            if (offer) {
                // Re-validate the coupon
                const now = new Date();

                // Check if offer is active
                if (!offer.isActive) {
                    return res.status(400).json(ApiResponse.error('Offer is not active'));
                }

                // Check date range
                if (now < offer.startDate || now > offer.endDate) {
                    return res.status(400).json(ApiResponse.error('Offer is not valid at this time'));
                }

                // Check minimum amount
                if (offer.minimumAmount > originalServicePrice) {
                    return res.status(400).json(ApiResponse.error(`Minimum order amount ₹${offer.minimumAmount} required for this offer`));
                }

                // Check usage limit
                if (offer.usageLimit && offer.usedCount >= offer.usageLimit) {
                    return res.status(400).json(ApiResponse.error('Offer usage limit reached'));
                }

                // Check booking type limitation
                if (offer.allowedBookingTypes && offer.allowedBookingTypes.length > 0) {
                    if (!offer.allowedBookingTypes.includes('booking')) {
                        return res.status(400).json(ApiResponse.error('Offer is not applicable for booking type'));
                    }
                }

                // Check user-specific restrictions
                if (req.user.userId) {
                    // Check if offer is restricted to specific users
                    if (offer.appliesToUsers && offer.appliesToUsers.length > 0) {
                        const userFound = offer.appliesToUsers.some(user => user._id.toString() === req.user.userId);
                        if (!userFound) {
                            return res.status(400).json(ApiResponse.error('Offer is not applicable to this user'));
                        }
                    }

                    // Check if offer is for new users only
                    if (offer.appliesToNewUsersOnly) {
                        const User = require('../models/User.model');
                        const user = await User.findById(req.user.userId);
                        if (user && user.createdAt) {
                            // Check if user was created more than 30 days ago (considered not new)
                            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                            if (user.createdAt < thirtyDaysAgo) {
                                return res.status(400).json(ApiResponse.error('Offer is only available for new users'));
                            }
                        }
                    }
                }

                // Calculate discount based on original service price
                let discount = 0;
                if (offer.type === 'percentage') {
                    discount = Math.min(originalServicePrice * (offer.value / 100), offer.maxDiscountAmount || Infinity);
                } else {
                    discount = Math.min(offer.value, originalServicePrice);
                }

                validatedAmount = originalServicePrice - discount;

                // Update booking with coupon info
                booking.couponCode = couponCode;
                booking.discountAmount = discount;
                booking.finalAmount = validatedAmount;
                booking.originalAmount = originalServicePrice;
                await booking.save();
            }
        }

        // Create order in Razorpay
        const options = {
            amount: validatedAmount * 100, // Razorpay expects amount in paise
            currency: currency,
            receipt: `booking_${bookingId}`,
            payment_capture: 1 // Auto-capture payment
        };

        const order = await razorpay.orders.create(options);

        // Create payment record in our database
        const payment = new Payment({
            bookingId,
            userId: req.user.userId,
            amount: validatedAmount,
            originalAmount: amount,
            currency,
            orderId: order.id,
            status: 'created',
            couponCode: couponCode || null
        });

        await payment.save();

        // Get Razorpay credentials from database
        const { getRazorpayCredentials } = require('../utils/credentialsManager');
        const razorpayCreds = await getRazorpayCredentials();

        res.status(200).json(
            ApiResponse.success({
                orderId: order.id,
                key: razorpayCreds?.keyId,
                amount: order.amount,
                currency: order.currency
            }, 'Payment order created successfully')
        );
    } catch (error) {
        next(error);
    }
};

// Helper function to create session from booking
async function createSessionFromBooking(booking, service) {
    if (booking.scheduledDate && booking.scheduledTime) {
        const Session = require('../models/Session.model');
        const existingSession = await Session.findOne({ bookingId: booking._id });

        if (!existingSession) {
            try {
                // Extract start time from scheduledTime (handle both HH:MM and HH:MM-HH:MM formats)
                let startTimeValue = booking.scheduledTime;
                if (booking.scheduledTime && booking.scheduledTime.includes('-')) {
                    // If it's a time range like '19:20-20:05', extract just the start time
                    startTimeValue = booking.scheduledTime.split('-')[0].trim();
                }

                const session = new Session({
                    therapistId: booking.therapistId,
                    userId: booking.userId,
                    date: booking.scheduledDate,
                    time: startTimeValue, // Use extracted start time in HH:MM format
                    startTime: new Date(`${booking.scheduledDate}T${startTimeValue}`),
                    type: '1-on-1',
                    status: 'pending',
                    notes: `Session created automatically from booking #${booking._id}`,
                    bookingId: booking._id
                });

                if (service && service.duration) {
                    const durationMatch = service.duration.match(/(\d+)/);
                    if (durationMatch) {
                        const duration = parseInt(durationMatch[0]);
                        const endTime = new Date(session.startTime);
                        endTime.setMinutes(endTime.getMinutes() + duration);
                        session.endTime = endTime;
                        session.duration = duration;
                    }
                }

                await session.save();
                console.log(`✅ Automatic session created for booking ${booking._id}: Session ID ${session._id}`);
                await Booking.findByIdAndUpdate(booking._id, { status: 'session_created' });
            } catch (sessionError) {
                console.error(`❌ Failed to create automatic session for booking ${booking._id}:`, sessionError);
            }
        } else {
            console.log(`ℹ️ Session already exists for booking ${booking._id}: Session ID ${existingSession._id}`);
        }
    } else {
        console.log(`ℹ️ No scheduling information found for booking ${booking._id} - skipping automatic session creation`);
    }
}

// Verify payment after successful transaction
const verifyPayment = async (req, res, next) => {
    try {
        const { paymentId, orderId, signature } = req.body;
        const userId = req.user.userId;

        // Fetch payment details from our database
        const payment = await Payment.findOne({ orderId, userId });
        if (!payment) {
            return res.status(404).json(ApiResponse.error('Payment not found'));
        }

        // Verify the payment with Razorpay
        const crypto = require('crypto');

        // Get Razorpay credentials from database
        const { getRazorpayCredentials } = require('../utils/credentialsManager');
        const razorpayCreds = await getRazorpayCredentials();
        const secret = razorpayCreds?.keySecret || 'UsJaHKrfVtTzJUF391hBpYPf';

        if (!secret) {
            return res.status(500).json(ApiResponse.error('Server configuration error: Razorpay secret is not set'));
        }

        // Create the expected signature
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(orderId + '|' + paymentId)
            .digest('hex');

        // Compare signatures
        if (expectedSignature === signature) {
            // Payment verified successfully
            await Payment.findOneAndUpdate(
                { orderId },
                {
                    paymentId,
                    status: 'paid',
                    verifiedAt: new Date()
                }
            );

            // If coupon was used, increment its usage count
            if (payment.couponCode) {
                const Offer = require('../models/Offer');
                const offer = await Offer.findOne({ code: payment.couponCode.toUpperCase() });
                if (offer) {
                    // Increment usage count
                    offer.usedCount = offer.usedCount + 1;
                    await offer.save();
                }
            }

            // Update booking payment status and calculate service expiry
            const booking = await Booking.findById(payment.bookingId);
            if (booking) {
                // Set payment status to paid
                booking.paymentStatus = 'paid';

                // If booking has a scheduled date and time slot, update the availability status to 'booked'
                if (booking.scheduledDate && booking.timeSlot && booking.timeSlot.start && booking.timeSlot.end) {
                    // First, check if another booking has already been paid for this same slot
                    const conflictingBooking = await Booking.findOne({
                        _id: { $ne: booking._id }, // Exclude current booking
                        therapistId: booking.therapistId,
                        scheduledDate: booking.scheduledDate,
                        'timeSlot.start': booking.timeSlot.start,
                        'timeSlot.end': booking.timeSlot.end,
                        paymentStatus: 'paid' // Only check for other PAID bookings
                    });

                    if (conflictingBooking) {
                        // Another booking has already been paid for this slot
                        // Reject this payment and mark it as failed
                        await Payment.findOneAndUpdate(
                            { orderId },
                            {
                                paymentId,
                                status: 'failed',
                                failureReason: 'Time slot already booked by another user'
                            }
                        );

                        return res.status(409).json(
                            ApiResponse.error('Time slot already booked by another user')
                        );
                    }

                    const Availability = require('../models/Availability.model');

                    // Find the availability record for this therapist and date
                    const availability = await Availability.findOne({
                        therapistId: booking.therapistId,
                        date: booking.scheduledDate
                    });

                    if (availability) {
                        // Find and update the specific time slot
                        const slotIndex = availability.timeSlots.findIndex(slot =>
                            slot.start === booking.timeSlot.start &&
                            slot.end === booking.timeSlot.end
                        );

                        if (slotIndex !== -1) {
                            availability.timeSlots[slotIndex].status = 'booked';
                            await availability.save();
                            console.log(`Successfully booked slot ${booking.timeSlot.start}-${booking.timeSlot.end} for therapist ${booking.therapistId} on ${booking.scheduledDate}`);
                        } else {
                            console.log(`Time slot ${booking.timeSlot.start}-${booking.timeSlot.end} not found for therapist ${booking.therapistId} on ${booking.scheduledDate}`);
                        }
                    } else {
                        console.log(`No availability found for therapist ${booking.therapistId} on date ${booking.scheduledDate}`);
                    }
                }

                // Calculate service expiry based on the service's validity
                const service = await Service.findById(booking.serviceId);
                if (service && service.validity > 0) {
                    // Calculate expiry date based on service validity
                    const purchaseDate = booking.purchaseDate || booking.createdAt;
                    const expiryDate = new Date(purchaseDate);
                    expiryDate.setDate(purchaseDate.getDate() + service.validity);

                    booking.serviceExpiryDate = expiryDate;
                    booking.serviceValidityDays = service.validity;
                }

                await booking.save();

                // Create session from booking for regular users only if scheduleType is 'now'
                // For 'later' bookings, session will be created when user schedules it later
                if (booking.scheduleType === 'now') {
                    await createSessionFromBooking(booking, service);
                } else {
                    // For 'later' bookings, just update booking status to 'confirmed' instead of 'session_created'
                    await Booking.findByIdAndUpdate(booking._id, { status: 'confirmed' });
                }

                // Send payment success notifications to user and admin
                try {
                    // Get user information for notification
                    const user = await User.findById(booking.userId).select('email phone name');

                    if (user) {
                        // Send new booking notification to user (email and WhatsApp)
                        await NotificationService.sendNotification(
                            { email: user.email, phone: user.phone },
                            'new_booking',
                            {
                                clientName: user.name,
                                phone: user.phone || 'N/A',  // Ensure phone is always defined
                                serviceName: service?.name || 'Service',
                                date: booking?.date || booking?.scheduledDate || 'N/A',  // Fallback to scheduledDate
                                time: booking?.time || booking?.scheduledTime || 'N/A',  // Fallback to scheduledTime
                                amount: booking?.amount || service?.price || '0'  // Add amount from booking or service
                            }
                        );

                        // Send payment received notification to admin
                        // The notification service will handle getting admin contact from credentials/profile
                        await NotificationService.sendNotification(
                            { email: 'placeholder', phone: 'placeholder' }, // Will be replaced by notification service
                            'payment_received',
                            {
                                amount: payment.amount,
                                serviceName: service?.name || 'Service',
                                transactionId: paymentId,
                                orderId: orderId,
                                clientName: user.name
                            }
                        );
                    }
                } catch (notificationError) {
                    console.error('Error sending payment notifications:', notificationError);
                    // Don't fail the payment process if notifications fail
                }
            }

            // Generate JWT token for auto-login
            let authToken = null;
            if (payment.userId) {
                const user = await User.findById(payment.userId).select('-password');
                if (user) {
                    authToken = generateToken({
                        userId: user._id.toString(),
                        role: user.role
                    });
                }
            }

            res.status(200).json(
                ApiResponse.success({
                    paymentId,
                    orderId,
                    status: 'paid',
                    token: authToken,
                    userId: payment.userId
                }, 'Payment verified successfully')
            );
        } else {
            // Invalid signature
            await Payment.findOneAndUpdate(
                { orderId },
                {
                    paymentId,
                    status: 'failed',
                    failureReason: 'Invalid signature'
                }
            );

            return res.status(400).json(ApiResponse.error('Payment verification failed'));
        }
    } catch (error) {
        next(error);
    }
};

// Create a payment order for Razorpay for guest users
const createGuestOrder = async (req, res, next) => {
    try {
        const { bookingId, amount, currency = 'INR', clientName, clientEmail, clientPhone, couponCode } = req.body;

        // Validate required fields for guest payment
        if (!clientName || !clientEmail || !clientPhone) {
            return res.status(400).json(ApiResponse.error("Name, email, and phone are required for guest payment"));
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(clientEmail)) {
            return res.status(400).json(ApiResponse.error("Invalid email format"));
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email: clientEmail });

        if (existingUser) {
            // If user exists, check if they have any unpaid orders or bookings
            // If they do, we might want to link the payment to those
            // For now, we'll allow them to proceed with guest payment
            // This addresses the issue where paid users couldn't make additional payments
        }

        // Find the booking to associate with this payment
        const booking = await Booking.findById(bookingId).populate('serviceId');
        if (!booking) {
            return res.status(404).json(ApiResponse.error('Booking not found'));
        }

        // Get original service price for coupon calculation
        const originalServicePrice = booking.serviceId ? booking.serviceId.price : amount;

        let validatedAmount = amount;

        // If coupon code is provided, re-validate it before creating payment order
        if (couponCode) {
            const Offer = require('../models/Offer');
            const offer = await Offer.findOne({ code: couponCode.toUpperCase() }).populate('appliesToUsers', '_id');

            if (offer) {
                // Re-validate the coupon
                const now = new Date();

                // Check if offer is active
                if (!offer.isActive) {
                    return res.status(400).json(ApiResponse.error('Offer is not active'));
                }

                // Check date range
                if (now < offer.startDate || now > offer.endDate) {
                    return res.status(400).json(ApiResponse.error('Offer is not valid at this time'));
                }

                // Check minimum amount
                if (offer.minimumAmount > originalServicePrice) {
                    return res.status(400).json(ApiResponse.error(`Minimum order amount ₹${offer.minimumAmount} required for this offer`));
                }

                // Check usage limit
                if (offer.usageLimit && offer.usedCount >= offer.usageLimit) {
                    return res.status(400).json(ApiResponse.error('Offer usage limit reached'));
                }

                // Check booking type limitation
                if (offer.allowedBookingTypes && offer.allowedBookingTypes.length > 0) {
                    if (!offer.allowedBookingTypes.includes('booking')) {
                        return res.status(400).json(ApiResponse.error('Offer is not applicable for booking type'));
                    }
                }

                // Check user-specific restrictions
                if (existingUser) {
                    // Check if offer is restricted to specific users
                    if (offer.appliesToUsers && offer.appliesToUsers.length > 0) {
                        const userFound = offer.appliesToUsers.some(user => user._id.toString() === existingUser._id.toString());
                        if (!userFound) {
                            return res.status(400).json(ApiResponse.error('Offer is not applicable to this user'));
                        }
                    }

                    // Check if offer is for new users only
                    if (offer.appliesToNewUsersOnly) {
                        if (existingUser && existingUser.createdAt) {
                            // Check if user was created more than 30 days ago (considered not new)
                            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                            if (existingUser.createdAt < thirtyDaysAgo) {
                                return res.status(400).json(ApiResponse.error('Offer is only available for new users'));
                            }
                        }
                    }
                }

                // Calculate discount based on original service price
                let discount = 0;
                if (offer.type === 'percentage') {
                    discount = Math.min(originalServicePrice * (offer.value / 100), offer.maxDiscountAmount || Infinity);
                } else {
                    discount = Math.min(offer.value, originalServicePrice);
                }

                validatedAmount = originalServicePrice - discount;

                // Update booking with coupon info
                booking.couponCode = couponCode;
                booking.discountAmount = discount;
                booking.finalAmount = validatedAmount;
                booking.originalAmount = originalServicePrice;
                await booking.save();
            }
        }

        // Create order in Razorpay
        const options = {
            amount: validatedAmount * 100, // Razorpay expects amount in paise
            currency: currency,
            receipt: `booking_${bookingId}_guest`,
            payment_capture: 1 // Auto-capture payment
        };

        const order = await razorpay.orders.create(options);

        // Create payment record in our database
        // Store guest info temporarily without creating user account yet
        const payment = new Payment({
            bookingId,
            amount: validatedAmount,
            originalAmount: amount,
            currency,
            orderId: order.id,
            status: 'created',
            guestName: clientName,
            guestEmail: clientEmail,
            guestPhone: clientPhone,
            couponCode: couponCode || null
        });

        await payment.save();

        // Get Razorpay credentials from database
        const { getRazorpayCredentials } = require('../utils/credentialsManager');
        const razorpayCreds = await getRazorpayCredentials();

        res.status(200).json(
            ApiResponse.success({
                orderId: order.id,
                key: razorpayCreds?.keyId,
                amount: order.amount,
                currency: order.currency,
                message: 'Payment order created successfully. Account will be created after payment verification.'
            }, 'Guest payment order created successfully')
        );
    } catch (error) {
        next(error);
    }
};

// Handle payment verification for guest users
const verifyGuestPayment = async (req, res, next) => {
    try {
        const { paymentId, orderId, signature } = req.body;

        // Fetch payment details from our database
        const payment = await Payment.findOne({ orderId });

        if (!payment) {
            return res.status(404).json(ApiResponse.error('Payment not found'));
        }

        // Verify the payment with Razorpay
        const crypto = require('crypto');

        // Get Razorpay credentials from database
        const { getRazorpayCredentials } = require('../utils/credentialsManager');
        const razorpayCreds = await getRazorpayCredentials();
        const secret = razorpayCreds?.keySecret || 'UsJaHKrfVtTzJUF391hBpYPf';

        if (!secret) {
            return res.status(500).json(ApiResponse.error('Server configuration error: Razorpay secret is not set'));
        }

        // Create the expected signature
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(orderId + '|' + paymentId)
            .digest('hex');

        console.log('✍️ Signature compare', {
            expectedSignature,
            receivedSignature: signature,
            match: expectedSignature === signature
        });

        // Compare signatures
        if (expectedSignature === signature) {
            // Payment verified successfully

            let tempPassword = null; // Initialize to track if we created a new user with temp password

            // If this is a guest payment, create the user account first
            if (payment.guestName && payment.guestEmail && payment.guestPhone) {
                // Check if user already exists (shouldn't happen, but just in case)
                const existingUser = await User.findOne({ email: payment.guestEmail });
                console.log('👤 Guest user check', {
                    email: payment.guestEmail,
                    exists: !!existingUser
                });

                if (!existingUser) {
                    // Create the user account with temporary passwords
                    tempPassword = 'TempPass123!';

                    const newUser = new User({
                        name: payment.guestName,
                        email: payment.guestEmail,
                        password: tempPassword,
                        phone: payment.guestPhone,
                        role: 'patient',
                        status: 'active',
                        hasTempPassword: true
                    });

                    await newUser.save();

                    // Update the payment record with the new user ID
                    await Payment.findByIdAndUpdate(payment._id, { userId: newUser._id });

                    // Update the booking to assign the new user
                    await Booking.findByIdAndUpdate(payment.bookingId, { userId: newUser._id });

                    await sendWelcomeEmailWithCredentials(payment.guestEmail, payment.guestName, payment.guestEmail, tempPassword);
                } else {
                    // User already exists - generate a temporary password for them
                    tempPassword = Math.random().toString(36).slice(-8) + 'Temp1!';
                    
                    // Update existing user with new temporary password
                    existingUser.password = tempPassword;
                    existingUser.hasTempPassword = true;
                    await existingUser.save();
                    
                    // Send welcome email with credentials
                    await sendWelcomeEmailWithCredentials(payment.guestEmail, payment.guestName, payment.guestEmail, tempPassword);
                }
                // For existing users, no notification is sent as requested
            }

            await Payment.findOneAndUpdate(
                { orderId },
                {
                    paymentId,
                    status: 'paid',
                    verifiedAt: new Date()
                }
            );

            // If coupon was used, increment its usage count
            if (payment.couponCode) {
                const Offer = require('../models/Offer');
                const offer = await Offer.findOne({ code: payment.couponCode.toUpperCase() });
                if (offer) {
                    // Increment usage count
                    offer.usedCount = offer.usedCount + 1;
                    await offer.save();
                }
            }

            // Update the booking status as well
            // Update booking payment status and calculate service expiry
            const booking = await Booking.findById(payment.bookingId);
            if (booking) {
                // Set payment status to paid
                booking.paymentStatus = 'paid';

                // If booking has a scheduled date and time slot, update the availability status to 'booked'
                if (booking.scheduledDate && booking.timeSlot && booking.timeSlot.start && booking.timeSlot.end) {
                    // First, check if another booking has already been paid for this same slot
                    const conflictingBooking = await Booking.findOne({
                        _id: { $ne: booking._id }, // Exclude current booking
                        therapistId: booking.therapistId,
                        scheduledDate: booking.scheduledDate,
                        'timeSlot.start': booking.timeSlot.start,
                        'timeSlot.end': booking.timeSlot.end,
                        paymentStatus: 'paid' // Only check for other PAID bookings
                    });

                    if (conflictingBooking) {
                        // Another booking has already been paid for this slot
                        // Reject this payment and mark it as failed
                        await Payment.findOneAndUpdate(
                            { orderId },
                            {
                                paymentId,
                                status: 'failed',
                                failureReason: 'Time slot already booked by another user'
                            }
                        );

                        return res.status(409).json(
                            ApiResponse.error('Time slot already booked by another user')
                        );
                    }

                    const Availability = require('../models/Availability.model');

                    // Find the availability record for this therapist and date
                    const availability = await Availability.findOne({
                        therapistId: booking.therapistId,
                        date: booking.scheduledDate
                    });

                    if (availability) {
                        // Find and update the specific time slot
                        const slotIndex = availability.timeSlots.findIndex(slot =>
                            slot.start === booking.timeSlot.start &&
                            slot.end === booking.timeSlot.end
                        );

                        if (slotIndex !== -1) {
                            availability.timeSlots[slotIndex].status = 'booked';
                            await availability.save();
                            console.log(`Successfully booked slot ${booking.timeSlot.start}-${booking.timeSlot.end} for therapist ${booking.therapistId} on ${booking.scheduledDate}`);
                        } else {
                            console.log(`Time slot ${booking.timeSlot.start}-${booking.timeSlot.end} not found for therapist ${booking.therapistId} on ${booking.scheduledDate}`);
                        }
                    } else {
                        console.log(`No availability found for therapist ${booking.therapistId} on date ${booking.scheduledDate}`);
                    }
                }

                // Calculate service expiry based on the service's validity
                const service = await Service.findById(booking.serviceId);
                if (service && service.validity > 0) {
                    // Calculate expiry date based on service validity
                    const purchaseDate = booking.purchaseDate || booking.createdAt;
                    const expiryDate = new Date(purchaseDate);
                    expiryDate.setDate(purchaseDate.getDate() + service.validity);

                    booking.serviceExpiryDate = expiryDate;
                    booking.serviceValidityDays = service.validity;
                }

                await booking.save();


                // Create session from booking for guest users only if scheduleType is 'now'
                // For 'later' bookings, session will be created when user schedules it later
                if (booking.scheduleType === 'now') {
                    await createSessionFromBooking(booking, service);
                } else {
                    // For 'later' bookings, just update booking status to 'confirmed' instead of 'session_created'
                    await Booking.findByIdAndUpdate(booking._id, { status: 'confirmed' });
                }
            }

            // Generate JWT token for auto-login
            let authToken = null;
            if (payment.userId) {
                const user = await User.findById(payment.userId).select('-password');
                if (user) {
                    authToken = generateToken({
                        userId: user._id.toString(),
                        role: user.role
                    });
                }
            }

            // Send new booking notification to ADMIN (not to guest user)
            try {
                const NotificationService = require('../services/notificationService');
                const service = await Service.findById(booking.serviceId);

                await NotificationService.sendNotification(
                    { email: 'placeholder', phone: 'placeholder' }, // Admin will receive via notification service
                    'new_booking',
                    {
                        clientName: payment.guestName,
                        phone: payment.guestPhone || 'N/A',
                        serviceName: service?.name || 'Service',
                        date: booking?.scheduledDate || 'N/A',
                        time: booking?.scheduledTime || 'N/A',
                        amount: payment?.amount || booking?.amount || service?.price || '0'
                    }
                );
            } catch (notificationError) {
                console.error('Error sending admin booking notification:', notificationError);
                // Don't fail the process if notifications fail
            }

            res.status(200).json(
                ApiResponse.success({
                    paymentId,
                    orderId,
                    status: 'paid',
                    token: authToken,
                    userId: payment.userId
                }, 'Payment verified successfully')
            );
        } else {
            // Invalid signature
            await Payment.findOneAndUpdate(
                { orderId },
                {
                    paymentId,
                    status: 'failed',
                    failureReason: 'Invalid signature'
                }
            );

            return res.status(400).json(ApiResponse.error('Payment verification failed'));
        }
    } catch (error) {
        console.error('❌ verifyGuestPayment error', {
            message: error.message,
            stack: error.stack
        });
        next(error);
    }
};

// Handle Razorpay webhook
const handleWebhook = async (req, res) => {
    try {
        const { event, payload } = req.body;

        if (event === 'payment.captured') {
            // Payment was successful
            const paymentId = payload.payment.entity.id;
            const orderId = payload.payment.entity.order_id;

            // Update payment status in our database
            await Payment.findOneAndUpdate(
                { orderId },
                {
                    paymentId,
                    status: 'paid',
                    captured: true
                }
            );

            // You might want to update the booking status as well
            const payment = await Payment.findOne({ orderId });
            if (payment) {
                let tempPassword = null; // Initialize to track if we created a new user with temp password

                // If this is a guest payment, create the user account first
                if (payment.guestName && payment.guestEmail && payment.guestPhone) {
                    // Check if user already exists (shouldn't happen, but just in case)
                    const existingUser = await User.findOne({ email: payment.guestEmail });

                    if (!existingUser) {
                        // Create the user account with temporary password
                        tempPassword = Math.random().toString(36).slice(-8) + 'Temp1!';

                        const newUser = new User({
                            name: payment.guestName,
                            email: payment.guestEmail,
                            password: tempPassword,
                            phone: payment.guestPhone,
                            role: 'patient',
                            status: 'active'
                        });

                        await newUser.save();

                        // Update the payment record with the new user ID
                        await Payment.findByIdAndUpdate(payment._id, { userId: newUser._id });

                        // Update the booking to assign the new user
                        await Booking.findByIdAndUpdate(payment.bookingId, { userId: newUser._id });
                    }
                }

                // Update booking payment status and calculate service expiry
                const booking = await Booking.findById(payment.bookingId);
                if (booking) {
                    // Set payment status to paid
                    booking.paymentStatus = 'paid';

                    // Calculate service expiry based on the service's validity
                    const service = await Service.findById(booking.serviceId);
                    if (service && service.validity > 0) {
                        // Calculate expiry date based on service validity
                        const purchaseDate = booking.purchaseDate || booking.createdAt;
                        const expiryDate = new Date(purchaseDate);
                        expiryDate.setDate(purchaseDate.getDate() + service.validity);

                        booking.serviceExpiryDate = expiryDate;
                        booking.serviceValidityDays = service.validity;
                    }

                    await booking.save();

                    // Create session from booking for webhook payments only if scheduleType is 'now'
                    // For 'later' bookings, session will be created when user schedules it later
                    if (booking.scheduleType === 'now') {
                        await createSessionFromBooking(booking, service);
                    } else {
                        // For 'later' bookings, just update booking status to 'confirmed' instead of 'session_created'
                        await Booking.findByIdAndUpdate(booking._id, { status: 'confirmed' });
                    }

                    // Send payment success notifications to user and admin
                    try {
                        // Get user information for notification
                        const user = await User.findById(booking.userId).select('email phone name');

                        if (user) {
                            // Send payment success notification to user (email and WhatsApp)
                            await NotificationService.sendNotification(
                                { email: user.email, phone: user.phone },
                                'payment_successful',
                                {
                                    clientName: user.name,
                                    amount: payment.amount,
                                    serviceName: service?.name || 'Service',
                                    transactionId: paymentId,
                                    orderId: orderId
                                }
                            );

                            // Send payment received notification to admin
                            // Send payment received notification to admin
                            // The notification service will handle getting admin contact from credentials/profile
                            await NotificationService.sendNotification(
                                { email: 'placeholder', phone: 'placeholder' }, // Will be replaced by notification service
                                'payment_received',
                                {
                                    amount: payment.amount,
                                    serviceName: service?.name || 'Service',
                                    transactionId: paymentId,
                                    orderId: orderId,
                                    clientName: user.name
                                }
                            );
                        }
                    } catch (notificationError) {
                        console.error('Error sending payment notifications:', notificationError);
                        // Don't fail the payment process if notifications fail
                    }
                }

                // If this was a guest booking, send login credentials to the user's email
                // Since we know the temporary password, we pass it instead of the hashed one
                if (payment.guestEmail && tempPassword) {
                    // Send welcome email with login credentials to the user
                    await sendWelcomeEmailWithCredentials(payment.guestEmail, payment.guestName, payment.guestEmail, tempPassword);
                }
            }

            // Check if this is a subscription payment
            const subscription = await Subscription.findOne({ orderId });
            if (subscription) {
                let tempPassword = null; // Initialize to track if we created a new user with temp password

                // If this is a guest subscription, create the user account first
                if (subscription.guestName && subscription.guestEmail && subscription.guestPhone) {
                    // Check if user already exists (shouldn't happen, but just in case)
                    const existingUser = await User.findOne({ email: subscription.guestEmail });

                    if (!existingUser) {
                        // Create the user account with temporary password
                        tempPassword = Math.random().toString(36).slice(-8) + 'Temp1!';

                        const newUser = new User({
                            name: subscription.guestName,
                            email: subscription.guestEmail,
                            password: tempPassword,
                            phone: subscription.guestPhone,
                            role: 'patient',
                            status: 'active',
                            hasTempPassword: true
                        });

                        await newUser.save();

                        // Update the subscription record with the new user ID
                        await Subscription.findByIdAndUpdate(subscription._id, { userId: newUser._id });
                    } else {
                        // User already exists - generate a temporary password for them
                        tempPassword = Math.random().toString(36).slice(-8) + 'Temp1!';
                        
                        // Update existing user with new temporary password
                        existingUser.password = tempPassword;
                        existingUser.hasTempPassword = true;
                        await existingUser.save();
                        
                        // Update the subscription record with the existing user ID
                        await Subscription.findByIdAndUpdate(subscription._id, { userId: existingUser._id });
                    }
                }

                await Subscription.findOneAndUpdate(
                    { orderId },
                    {
                        paymentId,
                        status: 'paid',
                        captured: true
                    }
                );

                // Activate the subscription with calculated end date
                await activateSubscription(subscription._id);

                // If this was a guest subscription and we created a new user, send login credentials
                if (subscription.guestEmail && tempPassword) {
                    // Send welcome email with login credentials to the user
                    await sendWelcomeEmailWithCredentials(subscription.guestEmail, subscription.guestName, subscription.guestEmail, tempPassword);
                }

                // Send plan booking confirmation notification for guest user
                try {
                    const guestUser = await User.findOne({ email: subscription.guestEmail });
                    if (guestUser && guestUser.status === 'active') {
                        const NotificationService = require('../services/notificationService');
                        const notificationService = new NotificationService();

                        await notificationService.sendNotification(
                            {
                                email: guestUser.email,
                                phone: guestUser.phone ? `+91${guestUser.phone}` : null,
                                name: guestUser.name
                            },
                            'plan_booking_confirmation',
                            {
                                clientName: guestUser.name,
                                planName: updatedSubscription.planName,
                                serviceName: 'Subscription Plan',
                                date: updatedSubscription.startDate ? updatedSubscription.startDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                                time: 'Flexible',
                                sessions: 'Multiple sessions included in subscription'
                            }
                        );

                        console.log(`✅ Plan booking confirmation notification sent to guest user ${guestUser.email}`);
                    } else {
                        console.log(`⚠️ Guest user ${subscription.guestEmail} is not active or not found, skipping notification`);
                    }
                } catch (notificationError) {
                    console.error('Error sending plan booking notification to guest user:', notificationError);
                    // Don't fail the payment process if notifications fail
                }
            }
        } else if (event === 'payment.failed') {
            // Payment failed
            const orderId = payload.payment.entity.order_id;

            await Payment.findOneAndUpdate(
                { orderId },
                {
                    status: 'failed',
                    captured: false
                }
            );
        }

        // Acknowledge the webhook
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Create a subscription payment order for Razorpay
const createSubscriptionOrder = async (req, res, next) => {
    try {
        const { planId, amount, currency = 'INR', couponCode, scheduleType, scheduledDate, scheduledTime, timeSlot, therapistId } = req.body;

        console.log('🔍 Subscription order request:', { planId, amount, currency, couponCode, scheduleType, scheduledDate, scheduledTime, timeSlot, therapistId });

        // Validate plan exists in the database
        const plan = await SubscriptionPlan.findOne({ planId, status: 'active' });
        console.log('📊 Found plan:', plan ? { planId: plan.planId, name: plan.name, price: plan.price, duration: plan.duration } : 'NOT FOUND');
        if (!plan) {
            return res.status(400).json(ApiResponse.error('Invalid or inactive plan ID'));
        }

        // Use the provided amount if it's less than or equal to plan price (discount applied)
        // Otherwise use the actual plan price
        let planAmount = plan.price;
        let validatedAmount = amount <= planAmount ? amount : planAmount;
        console.log('💰 Amount calculation:', { planAmount, providedAmount: amount, validatedAmount });

        // If coupon code is provided, re-validate it before creating payment order
        if (couponCode) {
            const Offer = require('../models/Offer');
            const offer = await Offer.findOne({ code: couponCode.toUpperCase() }).populate('appliesToUsers', '_id');

            if (offer) {
                // Re-validate the coupon
                const now = new Date();

                // Check if offer is active
                if (!offer.isActive) {
                    return res.status(400).json(ApiResponse.error('Offer is not active'));
                }

                // Check date range
                if (now < offer.startDate || now > offer.endDate) {
                    return res.status(400).json(ApiResponse.error('Offer is not valid at this time'));
                }

                // Check minimum amount
                if (offer.minimumAmount > planAmount) {
                    return res.status(400).json(ApiResponse.error(`Minimum order amount ₹${offer.minimumAmount} required for this offer`));
                }

                // Check usage limit
                if (offer.usageLimit && offer.usedCount >= offer.usageLimit) {
                    return res.status(400).json(ApiResponse.error('Offer usage limit reached'));
                }

                // Check booking type limitation
                if (offer.allowedBookingTypes && offer.allowedBookingTypes.length > 0) {
                    if (!offer.allowedBookingTypes.includes('subscription')) {
                        return res.status(400).json(ApiResponse.error('Offer is not applicable for subscription type'));
                    }
                }

                // Check user-specific restrictions
                if (req.user.userId) {
                    // Check if offer is restricted to specific users
                    if (offer.appliesToUsers && offer.appliesToUsers.length > 0) {
                        const userFound = offer.appliesToUsers.some(user => user._id.toString() === req.user.userId);
                        if (!userFound) {
                            return res.status(400).json(ApiResponse.error('Offer is not applicable to this user'));
                        }
                    }

                    // Check if offer is for new users only
                    if (offer.appliesToNewUsersOnly) {
                        const User = require('../models/User.model');
                        const user = await User.findById(req.user.userId);
                        if (user && user.createdAt) {
                            // Check if user was created more than 30 days ago (considered not new)
                            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                            if (user.createdAt < thirtyDaysAgo) {
                                return res.status(400).json(ApiResponse.error('Offer is only available for new users'));
                            }
                        }
                    }
                }

                // Calculate discount
                let discount = 0;
                if (offer.type === 'percentage') {
                    discount = Math.min(planAmount * (offer.value / 100), offer.maxDiscountAmount || Infinity);
                } else {
                    discount = Math.min(offer.value, planAmount);
                }

                validatedAmount = planAmount - discount;
            }
        }

        // Create order in Razorpay
        // Sanitize planId for receipt (remove spaces and special characters)
        const sanitizedPlanId = planId.replace(/[^a-zA-Z0-9]/g, '_');
        console.log('📋 Original planId:', planId);
        console.log('📋 Sanitized planId:', sanitizedPlanId);

        // Create receipt with max 40 characters
        let receipt = `sub_${sanitizedPlanId}_${req.user.userId}`;
        if (receipt.length > 40) {
            // Truncate to fit within 40 characters
            const maxPlanIdLength = 40 - 4 - req.user.userId.length - 1; // 4 for 'sub_', 1 for '_'
            const truncatedPlanId = sanitizedPlanId.substring(0, maxPlanIdLength);
            receipt = `sub_${truncatedPlanId}_${req.user.userId}`;
        }

        const options = {
            amount: validatedAmount * 100, // Razorpay expects amount in paise
            currency: currency,
            receipt: receipt,
            payment_capture: 1 // Auto-capture payment
        };

        console.log('💳 Razorpay order options:', options);
        let order;
        try {
            order = await razorpay.orders.create(options);
            console.log('💳 Razorpay order created:', { orderId: order.id, amount: order.amount, currency: order.currency });
        } catch (razorpayError) {
            console.error('❌ Razorpay API Error:', razorpayError);
            console.error('❌ Razorpay Error Details:', {
                message: razorpayError.message,
                code: razorpayError.code,
                statusCode: razorpayError.statusCode,
                error: razorpayError.error
            });
            throw razorpayError;
        }

        // Calculate discount amount
        const discountAmount = planAmount - validatedAmount;

        // Create subscription record in our database
        const subscription = new Subscription({
            userId: req.user.userId,
            planId,
            planName: plan.name,
            amount: validatedAmount,
            originalAmount: planAmount,
            finalAmount: validatedAmount,
            discountAmount: discountAmount,
            currency,
            orderId: order.id,
            status: 'created',
            couponCode: couponCode || null,
            // Add scheduling information
            scheduleType: scheduleType || 'now',
            scheduledDate: scheduledDate || null,
            scheduledTime: scheduledTime || null,
            timeSlot: timeSlot || null,
            therapistId: therapistId || null
        });

        await subscription.save();

        // Get Razorpay credentials from database
        const { getRazorpayCredentials } = require('../utils/credentialsManager');
        const razorpayCreds = await getRazorpayCredentials();

        res.status(200).json(
            ApiResponse.success({
                orderId: order.id,
                key: razorpayCreds?.keyId, // Frontend needs this to initialize Razorpay
                amount: order.amount,
                currency: order.currency
            }, 'Subscription order created successfully')
        );
    } catch (error) {
        next(error);
    }
};

// Create a subscription payment order for Razorpay for guest users
const createGuestSubscriptionOrder = async (req, res, next) => {
    try {
        const { planId, amount, currency = 'INR', clientName, clientEmail, clientPhone, couponCode, scheduleType, scheduledDate, scheduledTime, timeSlot, therapistId } = req.body;

        // Validate required fields for guest subscription
        if (!clientName || !clientEmail || !clientPhone) {
            return res.status(400).json(ApiResponse.error("Name, email, and phone are required for guest subscription"));
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(clientEmail)) {
            return res.status(400).json(ApiResponse.error("Invalid email format"));
        }

        // Validate plan exists in the database
        const plan = await SubscriptionPlan.findOne({ planId, status: 'active' });
        if (!plan) {
            return res.status(400).json(ApiResponse.error('Invalid or inactive plan ID'));
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email: clientEmail });

        if (existingUser) {
            // If user exists, allow them to proceed with guest subscription
            // This addresses the issue where paid users couldn't subscribe again
        }

        // Use the provided amount if it's less than or equal to plan price (discount applied)
        // Otherwise use the actual plan price
        let planAmount = plan.price;
        let validatedAmount = amount <= planAmount ? amount : planAmount;

        // If coupon code is provided, re-validate it before creating payment order
        if (couponCode) {
            const Offer = require('../models/Offer');
            const offer = await Offer.findOne({ code: couponCode.toUpperCase() }).populate('appliesToUsers', '_id');

            if (offer) {
                // Re-validate the coupon
                const now = new Date();

                // Check if offer is active
                if (!offer.isActive) {
                    return res.status(400).json(ApiResponse.error('Offer is not active'));
                }

                // Check date range
                if (now < offer.startDate || now > offer.endDate) {
                    return res.status(400).json(ApiResponse.error('Offer is not valid at this time'));
                }

                // Check minimum amount
                if (offer.minimumAmount > planAmount) {
                    return res.status(400).json(ApiResponse.error(`Minimum order amount ₹${offer.minimumAmount} required for this offer`));
                }

                // Check usage limit
                if (offer.usageLimit && offer.usedCount >= offer.usageLimit) {
                    return res.status(400).json(ApiResponse.error('Offer usage limit reached'));
                }

                // Check booking type limitation
                if (offer.allowedBookingTypes && offer.allowedBookingTypes.length > 0) {
                    if (!offer.allowedBookingTypes.includes('subscription')) {
                        return res.status(400).json(ApiResponse.error('Offer is not applicable for subscription type'));
                    }
                }

                // Check user-specific restrictions
                if (existingUser) {
                    // Check if offer is restricted to specific users
                    if (offer.appliesToUsers && offer.appliesToUsers.length > 0) {
                        const userFound = offer.appliesToUsers.some(user => user._id.toString() === existingUser._id.toString());
                        if (!userFound) {
                            return res.status(400).json(ApiResponse.error('Offer is not applicable to this user'));
                        }
                    }

                    // Check if offer is for new users only
                    if (offer.appliesToNewUsersOnly) {
                        if (existingUser && existingUser.createdAt) {
                            // Check if user was created more than 30 days ago (considered not new)
                            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                            if (existingUser.createdAt < thirtyDaysAgo) {
                                return res.status(400).json(ApiResponse.error('Offer is only available for new users'));
                            }
                        }
                    }
                }

                // Calculate discount
                let discount = 0;
                if (offer.type === 'percentage') {
                    discount = Math.min(planAmount * (offer.value / 100), offer.maxDiscountAmount || Infinity);
                } else {
                    discount = Math.min(offer.value, planAmount);
                }

                validatedAmount = planAmount - discount;
            }
        }

        // Create order in Razorpay
        const options = {
            amount: validatedAmount * 100, // Razorpay expects amount in paise
            currency: currency,
            receipt: `sub_guest_${planId}`,
            payment_capture: 1 // Auto-capture payment
        };

        const order = await razorpay.orders.create(options);

        // Calculate discount amount
        const discountAmount = planAmount - validatedAmount;

        // Create subscription record in our database
        // Store guest info temporarily without creating user account yet
        const subscription = new Subscription({
            planId,
            planName: plan.name,
            amount: validatedAmount,
            originalAmount: planAmount,
            finalAmount: validatedAmount,
            discountAmount: discountAmount,
            currency,
            orderId: order.id,
            status: 'created',
            guestName: clientName,
            guestEmail: clientEmail,
            guestPhone: clientPhone,
            couponCode: couponCode || null,
            // Add scheduling information
            scheduleType: scheduleType || 'now',
            scheduledDate: scheduledDate || null,
            scheduledTime: scheduledTime || null,
            timeSlot: timeSlot || null,
            therapistId: therapistId || null
        });

        await subscription.save();

        // Get Razorpay credentials from database
        const { getRazorpayCredentials } = require('../utils/credentialsManager');
        const razorpayCreds = await getRazorpayCredentials();

        res.status(200).json(
            ApiResponse.success({
                orderId: order.id,
                key: razorpayCreds?.keyId, // Frontend needs this to initialize Razorpay
                amount: order.amount,
                currency: order.currency,
                message: 'Subscription order created successfully. Account will be created after payment verification.'
            }, 'Guest subscription order created successfully')
        );
    } catch (error) {
        next(error);
    }
};

// Verify subscription payment after successful transaction
const verifySubscriptionPayment = async (req, res, next) => {
    try {
        const { paymentId, orderId, signature } = req.body;
        const userId = req.user.userId;

        // Fetch subscription details from our database
        const subscription = await Subscription.findOne({ orderId, userId });
        if (!subscription) {
            return res.status(404).json(ApiResponse.error('Subscription not found'));
        }

        // Verify the payment with Razorpay
        const crypto = require('crypto');

        // Get Razorpay credentials from database
        const { getRazorpayCredentials } = require('../utils/credentialsManager');
        const razorpayCreds = await getRazorpayCredentials();
        const secret = razorpayCreds?.keySecret || 'UsJaHKrfVtTzJUF391hBpYPf';

        if (!secret) {
            return res.status(500).json(ApiResponse.error('Server configuration error: Razorpay secret is not set'));
        }

        // Create the expected signature
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(orderId + '|' + paymentId)
            .digest('hex');

        // Compare signatures
        if (expectedSignature === signature) {
            // Payment verified successfully
            await Subscription.findOneAndUpdate(
                { orderId },
                {
                    paymentId,
                    status: 'paid',
                    verifiedAt: new Date(),
                    // Preserve coupon information
                    finalAmount: subscription.finalAmount,
                    discountAmount: subscription.discountAmount,
                    couponCode: subscription.couponCode,
                    // Preserve therapistId if it exists
                    therapistId: subscription.therapistId
                }
            );

            // If coupon was used, increment its usage count
            if (subscription.couponCode) {
                const Offer = require('../models/Offer');
                const offer = await Offer.findOne({ code: subscription.couponCode.toUpperCase() });
                if (offer) {
                    // Increment usage count
                    offer.usedCount = offer.usedCount + 1;
                    await offer.save();
                }
            }

            // Activate the subscription with calculated end date
            const updatedSubscription = await activateSubscription(subscription._id);

            // Send plan booking confirmation notification
            try {
                const User = require('../models/User.model');
                const user = await User.findById(userId);

                if (user && user.status === 'active') {
                    const { NotificationService } = require('../services/notificationService');
                    const notificationService = new NotificationService();

                    await notificationService.sendNotification(
                        {
                            email: user.email,
                            phone: user.phone ? `+91${user.phone}` : null,
                            name: user.name
                        },
                        'plan_booking_confirmation',
                        {
                            clientName: user.name,
                            planName: updatedSubscription.planName,
                            serviceName: 'Subscription Plan',
                            date: updatedSubscription.startDate ? updatedSubscription.startDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                            time: 'Flexible',
                            sessions: 'Multiple sessions included in subscription'
                        }
                    );

                    console.log(`✅ Plan booking confirmation notification sent to ${user.email}`);
                } else {
                    console.log(`⚠️ User ${userId} is not active or not found, skipping notification`);
                }
            } catch (notificationError) {
                console.error('Error sending plan booking notification:', notificationError);
                // Don't fail the payment process if notifications fail
            }

            // If subscription has a therapist assigned, create a booking record
            if (subscription.therapistId) {
                try {
                    // Create a booking to associate the therapist with the subscription
                    // Use scheduled date/time from subscription if available, otherwise use current time
                    const bookingDate = subscription.scheduledDate || new Date().toISOString().split('T')[0];
                    const bookingTime = subscription.timeSlot?.start || subscription.scheduledTime || new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });

                    // Get therapist details to populate therapistName
                    let therapistName = '';
                    if (subscription.therapistId) {
                        const Therapist = require('../models/Therapist.model'); // Adjust path as needed
                        const therapist = await Therapist.findById(subscription.therapistId).select('name');
                        therapistName = therapist ? therapist.name : 'Assigned Therapist';
                    }

                    // Get user information for clientName
                    const bookingUser = await User.findById(subscription.userId).select('name');
                    const clientName = bookingUser ? bookingUser.name : 'Valued Customer';

                    const booking = new Booking({
                        serviceId: null, // Don't set serviceId for subscription bookings
                        serviceName: subscription.planName,
                        therapistId: subscription.therapistId,
                        therapistName: therapistName,
                        userId: subscription.userId,
                        clientName: clientName,
                        date: bookingDate,
                        time: bookingTime,
                        scheduleType: subscription.scheduleType || 'now', // Set schedule type based on subscription
                        status: 'confirmed', // Initially confirmed
                        notes: `Booking created automatically from subscription purchase (Order ID: ${orderId})`,
                        paymentStatus: 'paid',
                        amount: subscription.amount,
                        purchaseDate: new Date(),
                        serviceExpiryDate: updatedSubscription.endDate,
                        serviceValidityDays: 30, // Default, can be adjusted based on plan
                        bookingType: 'subscription-covered', // Mark as subscription covered booking
                        isServiceExpired: false,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    });

                    await booking.save();
                    console.log(`✅ Booking created for subscription with therapist: ${subscription.therapistId}, Booking ID: ${booking._id}`);

                    // Send plan booking confirmation notification for subscription purchase
                    try {
                        const User = require('../models/User.model');
                        const user = await User.findById(subscription.userId).select('email phone name');

                        if (user) {
                            const { NotificationService } = require('../services/notificationService');
                            const notificationService = new NotificationService();

                            // Wait for notification service to initialize
                            await new Promise(resolve => setTimeout(resolve, 1000));

                            const notificationData = {
                                clientName: user.name,
                                planName: subscription.planName,
                                serviceName: subscription.planName,
                                date: bookingDate,
                                time: bookingTime
                            };

                            await notificationService.sendNotification(
                                { email: user.email, phone: user.phone },
                                'plan_booking_confirmation',
                                notificationData
                            );

                            console.log(`✅ Plan booking confirmation notification sent for subscription purchase to ${user.email}`);
                        }
                    } catch (notificationError) {
                        console.error('❌ Error sending plan booking confirmation notification for subscription purchase:', notificationError);
                        // Don't fail the booking creation if notification fails
                    }

                    // If the subscription has scheduled date and time slot, update the availability status to 'booked'
                    if (subscription.scheduledDate && subscription.timeSlot && subscription.timeSlot.start && subscription.timeSlot.end) {
                        // First, check if another booking has already been paid for this same slot
                        const conflictingBooking = await Booking.findOne({
                            therapistId: subscription.therapistId,
                            scheduledDate: subscription.scheduledDate,
                            'timeSlot.start': subscription.timeSlot.start,
                            'timeSlot.end': subscription.timeSlot.end,
                            paymentStatus: 'paid' // Only check for other PAID bookings
                        });

                        if (conflictingBooking) {
                            // Another booking has already been paid for this slot
                            // Reject this subscription payment and mark it as failed
                            await Subscription.findOneAndUpdate(
                                { orderId },
                                {
                                    paymentId,
                                    status: 'failed',
                                    failureReason: 'Time slot already booked by another user'
                                }
                            );

                            return res.status(409).json(
                                ApiResponse.error('Time slot already booked by another user')
                            );
                        }

                        const Availability = require('../models/Availability.model');

                        // Find the availability record for this therapist and date
                        const availability = await Availability.findOne({
                            therapistId: subscription.therapistId,
                            date: subscription.scheduledDate
                        });

                        if (availability) {
                            // Find and update the specific time slot from 'tentative' to 'booked'
                            const slotIndex = availability.timeSlots.findIndex(slot =>
                                slot.start === subscription.timeSlot.start &&
                                slot.end === subscription.timeSlot.end
                            );

                            if (slotIndex !== -1) {
                                availability.timeSlots[slotIndex].status = 'booked';
                                await availability.save();
                                console.log(`Successfully booked slot ${subscription.timeSlot.start}-${subscription.timeSlot.end} for therapist ${subscription.therapistId} on ${subscription.scheduledDate}`);
                            } else {
                                console.log(`Time slot ${subscription.timeSlot.start}-${subscription.timeSlot.end} not found for therapist ${subscription.therapistId} on ${subscription.scheduledDate}`);
                            }
                        } else {
                            console.log(`No availability found for therapist ${subscription.therapistId} on date ${subscription.scheduledDate}`);
                        }
                    }
                } catch (bookingError) {
                    console.error('Error creating booking for subscription:', bookingError);
                    // Don't fail the subscription process if booking creation fails
                }
            }

            // Send payment success notifications to user and admin
            try {
                // Get user information for notification
                const user = await User.findById(subscription.userId).select('email phone name');

                if (user) {
                    // DISABLED: Send payment success notification to user (email and WhatsApp)
                    /*
                    await NotificationService.sendNotification(
                        { email: user.email, phone: user.phone },
                        'payment_successful',
                        {
                            clientName: user.name,
                            amount: subscription.amount,
                            serviceName: 'Subscription Plan',
                            transactionId: paymentId,
                            orderId: orderId
                        }
                    );
                    */

                    // DISABLED: Send payment received notification to admin
                    /*
                    const admins = await User.find({ role: 'admin' }).select('email phone name');
                    for (const admin of admins) {
                        await NotificationService.sendNotification(
                            { email: admin.email, phone: admin.phone },
                            'payment_received',
                            {
                                amount: subscription.amount,
                                serviceName: 'Subscription Plan',
                                transactionId: paymentId,
                                orderId: orderId,
                                clientName: user.name
                            }
                        );
                    }
                    */
                }
            } catch (notificationError) {
                console.error('Error sending subscription payment notifications:', notificationError);
                // Don't fail the payment process if notifications fail
            }

            // Check if there's a pending booking that should create a session
            // This would be for cases where user scheduled during the booking process
            if (subscription.userId) {
                // Find all pending bookings for this user that are scheduled and paid
                // Only process bookings with scheduleType 'now', skip 'later' bookings
                const pendingBookings = await Booking.find({
                    userId: subscription.userId,
                    paymentStatus: 'paid',
                    status: 'pending',
                    scheduleType: { $ne: 'later' }, // Skip 'later' scheduled bookings
                    scheduledDate: { $exists: true, $ne: null },
                    scheduledTime: { $exists: true, $ne: null }
                }).sort({ createdAt: -1 });

                // Process all pending bookings to create sessions
                for (const pendingBooking of pendingBookings) {
                    if (pendingBooking.scheduledDate && pendingBooking.scheduledTime) {
                        const Session = require('../models/Session.model');
                        const Service = require('../models/Service.model');

                        // Check if a session already exists for this booking to avoid duplicates
                        const existingSession = await Session.findOne({
                            bookingId: pendingBooking._id
                        });

                        if (!existingSession) {
                            try {
                                // Extract start time from scheduledTime (handle both HH:MM and HH:MM-HH:MM formats)
                                let startTimeValue = pendingBooking.scheduledTime;
                                if (pendingBooking.scheduledTime && pendingBooking.scheduledTime.includes('-')) {
                                    // If it's a time range like '19:20-20:05', extract just the start time
                                    startTimeValue = pendingBooking.scheduledTime.split('-')[0].trim();
                                }

                                // Create a new session based on the booking
                                // Use therapistId from booking first, fall back to subscription therapistId
                                const session = new Session({
                                    therapistId: pendingBooking.therapistId || subscription.therapistId,
                                    userId: pendingBooking.userId,
                                    date: pendingBooking.scheduledDate,
                                    time: startTimeValue, // Use extracted start time in HH:MM format
                                    startTime: new Date(`${pendingBooking.scheduledDate}T${startTimeValue}`),
                                    type: '1-on-1',
                                    status: 'pending',
                                    notes: `Session created automatically from subscription booking #${pendingBooking._id}`,
                                    bookingId: pendingBooking._id,
                                    subscriptionId: subscription._id
                                });

                                // Calculate end time if duration is available
                                const service = await Service.findById(pendingBooking.serviceId);
                                if (service && service.duration) {
                                    const durationMatch = service.duration.match(/(\d+)/);
                                    if (durationMatch) {
                                        const duration = parseInt(durationMatch[0]);
                                        const endTime = new Date(session.startTime);
                                        endTime.setMinutes(endTime.getMinutes() + duration);
                                        session.endTime = endTime;
                                        session.duration = duration;
                                    }
                                }

                                await session.save();
                                console.log(`✅ Automatic session created for subscription booking ${pendingBooking._id}: Session ID ${session._id}`);

                                // Update the booking status to indicate session has been created
                                await Booking.findByIdAndUpdate(pendingBooking._id, {
                                    status: 'session_created'
                                });
                            } catch (sessionError) {
                                console.error(`❌ Failed to create automatic session for subscription booking ${pendingBooking._id}:`, sessionError);
                                // Don't fail the subscription verification if session creation fails
                            }
                        } else {
                            console.log(`ℹ️ Session already exists for subscription booking ${pendingBooking._id}: Session ID ${existingSession._id}`);
                        }
                    } else {
                        console.log(`ℹ️ No scheduling information found for subscription booking ${pendingBooking._id} - skipping automatic session creation`);
                    }
                }

                // ALSO create direct subscription sessions for subscription-based plans
                // This handles the case where users subscribe directly without creating bookings first
                // ONLY create sessions for 'now' scheduled subscriptions, NOT for 'later' scheduled ones
                if ((subscription.scheduleType === 'now' || !subscription.scheduleType) && subscription.scheduleType !== 'later') {
                    const Session = require('../models/Session.model');
                    const SubscriptionPlan = require('../models/SubscriptionPlan.model');

                    // Get the subscription plan to determine session parameters
                    const plan = await SubscriptionPlan.findOne({ planId: subscription.planId });
                    if (plan) {
                        try {
                            // For subscription plans, we can create sessions directly without bookings
                            // This is for plans where users subscribe directly (like the subscription flow)

                            // Create one initial session for demonstration purposes
                            // In a real implementation, this might be configurable per plan
                            console.log('DEBUG: subscription scheduledDate:', subscription.scheduledDate);
                            console.log('DEBUG: subscription scheduledTime:', subscription.scheduledTime);
                            // Determine time to use for session based on available data
                            const sessionDate = subscription.scheduledDate || new Date().toISOString().split('T')[0];
                            const sessionTime = subscription.timeSlot?.start || subscription.scheduledTime ;

                            // Calculate start and end times
                            const startTime = subscription.scheduledDate && (subscription.timeSlot?.start || subscription.scheduledTime)
                                ? new Date(`${subscription.scheduledDate}T${sessionTime}`)
                                : new Date(new Date().setHours(9, 0, 0, 0));

                            // Calculate end time based on timeSlot or default duration
                            let endTime = new Date(startTime);
                            if (subscription.timeSlot?.end) {
                                // If timeSlot has end time, calculate duration from that
                                const [endHour, endMinute] = subscription.timeSlot.end.split(':').map(Number);
                                endTime = new Date(startTime);
                                endTime.setHours(endHour, endMinute, 0, 0);
                            } else {
                                // Use default duration if no end time in timeSlot
                                endTime.setMinutes(endTime.getMinutes() + (plan.duration ? parseInt(plan.duration.match(/(\d+)/)?.[1] || '60') : 60));
                            }

                            const session = new Session({
                                therapistId: subscription.therapistId, // Use therapist from subscription if available
                                userId: subscription.userId,
                                date: sessionDate, // Use scheduled date or today's date
                                time: sessionTime, // Use timeSlot start or scheduled time or default
                                startTime: startTime,
                                endTime: endTime,
                                type: '1-on-1',
                                status: 'pending', // Changed from 'scheduled' to 'pending' as requested
                                notes: `Initial session created automatically from subscription plan ${plan.name}`,
                                subscriptionId: subscription._id,
                                duration: Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60)) // Calculate duration in minutes
                            });

                            // Set end time based on duration
                            if (session.duration > 0) {
                                const endTime = new Date(session.startTime);
                                endTime.setMinutes(endTime.getMinutes() + session.duration);
                                session.endTime = endTime;
                            }

                            await session.save();
                            console.log(`✅ Automatic initial session created for subscription ${subscription._id}: Session ID ${session._id}`);
                        } catch (sessionError) {
                            console.error(`❌ Failed to create automatic initial session for subscription ${subscription._id}:`, sessionError);
                            // Don't fail the subscription verification if session creation fails
                        }
                    } else {
                        console.log(`ℹ️ No subscription plan found for subscription ${subscription._id} - skipping automatic session creation`);
                    }
                } else {
                    console.log(`ℹ️ Skipping automatic session creation for subscription ${subscription._id} with scheduleType '${subscription.scheduleType}'`);
                }
            }

            // Generate JWT token for auto-login
            let authToken = null;
            if (subscription.userId) {
                const user = await User.findById(subscription.userId).select('-password');
                if (user) {
                    authToken = generateToken({
                        userId: user._id.toString(),
                        role: user.role
                    });
                }
            }

            res.status(200).json(
                ApiResponse.success({
                    paymentId,
                    orderId,
                    status: 'paid',
                    token: authToken,
                    userId: subscription.userId,
                    subscription: {
                        id: updatedSubscription._id,
                        planId: updatedSubscription.planId,
                        planName: updatedSubscription.planName,
                        status: updatedSubscription.status,
                        startDate: updatedSubscription.startDate,
                        endDate: updatedSubscription.endDate,
                        nextBillingDate: updatedSubscription.nextBillingDate
                    }
                }, 'Subscription payment verified and activated successfully')
            );
        } else {
            // Invalid signature
            await Subscription.findOneAndUpdate(
                { orderId },
                {
                    paymentId,
                    status: 'failed',
                    failureReason: 'Invalid signature'
                }
            );

            return res.status(400).json(ApiResponse.error('Subscription payment verification failed'));
        }
    } catch (error) {
        next(error);
    }
};

// Verify guest subscription payment after successful transaction
const verifyGuestSubscriptionPayment = async (req, res, next) => {
    try {
        const { paymentId, orderId, signature } = req.body;

        // Fetch subscription details from our database (no user authentication required)
        const subscription = await Subscription.findOne({ orderId });
        if (!subscription) {
            return res.status(404).json(ApiResponse.error('Subscription not found'));
        }

        // Verify the payment with Razorpay
        const crypto = require('crypto');

        // Get Razorpay credentials from database
        const { getRazorpayCredentials } = require('../utils/credentialsManager');
        const razorpayCreds = await getRazorpayCredentials();
        const secret = razorpayCreds?.keySecret || 'UsJaHKrfVtTzJUF391hBpYPf';

        if (!secret) {
            return res.status(500).json(ApiResponse.error('Server configuration error: Razorpay secret is not set'));
        }

        // Create the expected signature
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(orderId + '|' + paymentId)
            .digest('hex');

        // Compare signatures
        if (expectedSignature === signature) {
            // Payment verified successfully
            let tempPassword = null;
            let newUser = null;

            // If this is a guest subscription, create the user account first
            if (subscription.guestName && subscription.guestEmail && subscription.guestPhone) {
                // Check if user already exists (shouldn't happen, but just in case)
                const existingUser = await User.findOne({ email: subscription.guestEmail });

                if (!existingUser) {
                    // Create the user account with temporary password
                    tempPassword = Math.random().toString(36).slice(-8) + 'Temp1!';

                    newUser = new User({
                        name: subscription.guestName,
                        email: subscription.guestEmail,
                        password: tempPassword,
                        phone: subscription.guestPhone,
                        role: 'patient',
                        status: 'active',
                        hasTempPassword: true
                    });

                    await newUser.save();

                    // Update the subscription record with the new user ID
                    await Subscription.findByIdAndUpdate(subscription._id, { userId: newUser._id });
                } else {
                    // If user already existed, update the subscription with the existing user ID
                    await Subscription.findByIdAndUpdate(subscription._id, { userId: existingUser._id });
                }
            }

            // Update subscription status and payment details
            await Subscription.findOneAndUpdate(
                { orderId },
                {
                    paymentId,
                    status: 'paid',
                    verifiedAt: new Date(),
                    // Preserve coupon information
                    finalAmount: subscription.finalAmount,
                    discountAmount: subscription.discountAmount,
                    couponCode: subscription.couponCode,
                    // Preserve therapistId if it exists
                    therapistId: subscription.therapistId
                }
            );

            // If coupon was used, increment its usage count (async to not block main flow)
            if (subscription.couponCode) {
                // Run this in background to not delay response
                (async () => {
                    try {
                        const Offer = require('../models/Offer');
                        const offer = await Offer.findOne({ code: subscription.couponCode.toUpperCase() });
                        if (offer) {
                            // Use atomic update to increment usage count
                            await Offer.updateOne(
                                { _id: offer._id },
                                { $inc: { usedCount: 1 } }
                            );
                        }
                    } catch (couponError) {
                        console.error('Error updating coupon usage count:', couponError);
                    }
                })();
            }

            // Activate the subscription with calculated end date
            const updatedSubscription = await activateSubscription(subscription._id);

            // If subscription has a therapist assigned, create a booking record (async to not block main flow)
            if (subscription.therapistId) {
                // Run booking creation in background to not delay response
                (async () => {
                    try {
                        const userIdToCheck = subscription.userId || (newUser ? newUser._id : null);
                        const userForBooking = await User.findById(userIdToCheck).select('name');

                        // Create a booking to associate the therapist with the subscription
                        const bookingDate = subscription.scheduledDate || new Date().toISOString().split('T')[0];
                        const bookingTime = subscription.timeSlot?.start || subscription.scheduledTime || new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });

                        // Get therapist details to populate therapistName
                        let therapistName = '';
                        if (subscription.therapistId) {
                            const Therapist = require('../models/Therapist.model');
                            const therapist = await Therapist.findById(subscription.therapistId).select('name');
                            therapistName = therapist ? therapist.name : 'Assigned Therapist';
                        }

                        const booking = new Booking({
                            serviceId: null, // Don't set serviceId for subscription bookings
                            serviceName: subscription.planName,
                            therapistId: subscription.therapistId,
                            therapistName: therapistName,
                            userId: userIdToCheck,
                            clientName: userForBooking?.name || subscription.guestName || '',
                            clientEmail: subscription.guestEmail || '',
                            clientPhone: subscription.guestPhone || '',
                            date: bookingDate,
                            time: bookingTime,
                            status: 'confirmed', // Initially confirmed
                            notes: `Booking created automatically from guest subscription purchase (Order ID: ${orderId})`,
                            paymentStatus: 'paid',
                            amount: subscription.amount,
                            purchaseDate: new Date(),
                            serviceExpiryDate: updatedSubscription.endDate,
                            serviceValidityDays: 30, // Default, can be adjusted based on plan
                            isServiceExpired: false,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        });

                        await booking.save();
                        console.log(`✅ Booking created for guest subscription with therapist: ${subscription.therapistId}, Booking ID: ${booking._id}`);

                        // Send plan booking confirmation notification for guest subscription purchase
                        try {
                            const User = require('../models/User.model');
                            const user = await User.findById(userIdToCheck).select('email phone name');

                            if (user) {
                                const NotificationService = require('../services/notificationService');
                                const notificationService = new NotificationService();

                                // Wait for notification service to initialize
                                await new Promise(resolve => setTimeout(resolve, 1000));

                                const notificationData = {
                                    clientName: user.name || subscription.guestName,
                                    planName: subscription.planName,
                                    serviceName: subscription.planName,
                                    date: bookingDate,
                                    time: bookingTime
                                };

                                await notificationService.sendNotification(
                                    { email: user.email || subscription.guestEmail, phone: user.phone || subscription.guestPhone },
                                    'plan_booking_confirmation',
                                    notificationData
                                );

                                console.log(`✅ Plan booking confirmation notification sent for guest subscription purchase to ${user.email || subscription.guestEmail}`);
                            }
                        } catch (notificationError) {
                            console.error('❌ Error sending plan booking confirmation notification for guest subscription purchase:', notificationError);
                            // Don't fail the booking creation if notification fails
                        }
                    } catch (bookingError) {
                        console.error('Error creating booking for guest subscription:', bookingError);
                    }
                })();
            }

            // Send payment success notifications asynchronously to not block response
            (async () => {
                try {
                    const userIdToCheck = subscription.userId || (newUser ? newUser._id : null);
                    const user = await User.findById(userIdToCheck).select('email phone name');

                    if (user) {
                        // DISABLED: Send payment success notification to user (email and WhatsApp)
                        /*
                        await NotificationService.sendNotification(
                            { email: user.email, phone: user.phone },
                            'payment_successful',
                            {
                                clientName: user.name,
                                amount: subscription.amount,
                                serviceName: 'Subscription Plan',
                                transactionId: paymentId,
                                orderId: orderId
                            }
                        );
                        */

                        // DISABLED: Send payment received notification to admin
                        /*
                        const admins = await User.find({ role: 'admin' }).select('email phone name');
                        for (const admin of admins) {
                            await NotificationService.sendNotification(
                                { email: admin.email, phone: admin.phone },
                                'payment_received',
                                {
                                    amount: subscription.amount,
                                    serviceName: 'Subscription Plan',
                                    transactionId: paymentId,
                                    orderId: orderId,
                                    clientName: user.name
                                }
                            );
                        }
                        */
                    }
                } catch (notificationError) {
                    console.error('Error sending guest subscription payment notifications:', notificationError);
                }

                // Send welcome email with credentials if applicable
                if (subscription.guestEmail && tempPassword) {
                    try {
                        await sendWelcomeEmailWithCredentials(subscription.guestEmail, subscription.guestName, subscription.guestEmail, tempPassword);
                    } catch (emailError) {
                        console.error('Error sending welcome email:', emailError);
                    }
                }
            })();

            // Process pending bookings and create sessions asynchronously
            (async () => {
                try {
                    const userIdToCheck = subscription.userId || (newUser ? newUser._id : null);
                    if (userIdToCheck) {
                        // Look for existing bookings to convert to sessions
                        let pendingBookings = [];

                        // First, look for bookings by userId
                        pendingBookings = await Booking.find({
                            userId: userIdToCheck,
                            paymentStatus: 'paid',
                            status: 'pending',
                            scheduleType: 'now',
                            scheduledDate: { $exists: true, $ne: null },
                            scheduledTime: { $exists: true, $ne: null }
                        }).sort({ createdAt: -1 });

                        // Additionally, for guest users, also look for bookings with guest email
                        if (subscription.guestEmail) {
                            const emailBasedBookings = await Booking.find({
                                clientEmail: subscription.guestEmail,
                                paymentStatus: 'paid',
                                status: 'pending',
                                scheduleType: 'now',
                                scheduledDate: { $exists: true, $ne: null },
                                scheduledTime: { $exists: true, $ne: null }
                            }).sort({ createdAt: -1 });

                            // Combine and deduplicate bookings
                            const allBookingsMap = new Map();
                            [...pendingBookings, ...emailBasedBookings].forEach(booking => {
                                allBookingsMap.set(booking._id.toString(), booking);
                            });
                            pendingBookings = Array.from(allBookingsMap.values());
                        }

                        // Process all pending bookings to create sessions
                        for (const pendingBooking of pendingBookings) {
                            if (pendingBooking.scheduledDate && pendingBooking.scheduledTime) {
                                const Session = require('../models/Session.model');
                                const Service = require('../models/Service.model');

                                // Check if a session already exists for this booking to avoid duplicates
                                const existingSession = await Session.findOne({
                                    bookingId: pendingBooking._id
                                });

                                if (!existingSession) {
                                    // Extract start time from scheduledTime (handle both HH:MM and HH:MM-HH:MM formats)
                                    let startTimeValue = pendingBooking.scheduledTime;
                                    if (pendingBooking.scheduledTime && pendingBooking.scheduledTime.includes('-')) {
                                        // If it's a time range like '19:20-20:05', extract just the start time
                                        startTimeValue = pendingBooking.scheduledTime.split('-')[0].trim();
                                    }

                                    const session = new Session({
                                        therapistId: pendingBooking.therapistId || subscription.therapistId,
                                        userId: pendingBooking.userId || userIdToCheck,
                                        date: pendingBooking.scheduledDate,
                                        time: startTimeValue, // Use extracted start time in HH:MM format
                                        startTime: new Date(`${pendingBooking.scheduledDate}T${startTimeValue}`),
                                        type: '1-on-1',
                                        status: 'pending',
                                        notes: `Session created from subscription booking #${pendingBooking._id}`,
                                        bookingId: pendingBooking._id,
                                        subscriptionId: subscription._id
                                    });

                                    // Calculate end time if duration is available
                                    const service = await Service.findById(pendingBooking.serviceId);
                                    if (service && service.duration) {
                                        const durationMatch = service.duration.match(/(\d+)/);
                                        if (durationMatch) {
                                            const duration = parseInt(durationMatch[0]);
                                            const endTime = new Date(session.startTime);
                                            endTime.setMinutes(endTime.getMinutes() + duration);
                                            session.endTime = endTime;
                                            session.duration = duration;
                                        }
                                    }

                                    await session.save();

                                    // Update the booking status
                                    await Booking.findByIdAndUpdate(pendingBooking._id, {
                                        status: 'session_created'
                                    });
                                }
                            }
                        }

                        // Create direct subscription sessions
                        const Session = require('../models/Session.model');
                        const SubscriptionPlan = require('../models/SubscriptionPlan.model');

                        const plan = await SubscriptionPlan.findOne({ planId: subscription.planId });
                        if (plan) {
                            const sessionDate = subscription.scheduledDate || new Date().toISOString().split('T')[0];
                            const sessionTime = subscription.timeSlot?.start || subscription.scheduledTime ;

                            const startTime = subscription.scheduledDate && (subscription.timeSlot?.start || subscription.scheduledTime)
                                ? new Date(`${subscription.scheduledDate}T${sessionTime}`)
                                : new Date(new Date().setHours(9, 0, 0, 0));

                            let endTime = new Date(startTime);
                            if (subscription.timeSlot?.end) {
                                const [endHour, endMinute] = subscription.timeSlot.end.split(':').map(Number);
                                endTime = new Date(startTime);
                                endTime.setHours(endHour, endMinute, 0, 0);
                            } else {
                                endTime.setMinutes(endTime.getMinutes() + (plan.duration ? parseInt(plan.duration.match(/(\d+)/)?.[1] || '60') : 60));
                            }

                            const session = new Session({
                                therapistId: subscription.therapistId,
                                userId: userIdToCheck,
                                date: sessionDate,
                                time: sessionTime,
                                startTime: startTime,
                                endTime: endTime,
                                type: '1-on-1',
                                status: 'pending',
                                notes: `Initial session created from subscription #${subscription._id}`,
                                subscriptionId: subscription._id,
                                duration: Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60))
                            });

                            if (session.duration > 0) {
                                const endTime = new Date(session.startTime);
                                endTime.setMinutes(endTime.getMinutes() + session.duration);
                                session.endTime = endTime;
                            }

                            await session.save();
                        }
                    }
                } catch (sessionError) {
                    console.error('Error processing sessions for guest subscription:', sessionError);
                }
            })();

            // Generate JWT token for auto-login
            let authToken = null;
            const finalUserId = subscription.userId || (newUser ? newUser._id : null);
            if (finalUserId) {
                const user = await User.findById(finalUserId).select('-password');
                if (user) {
                    authToken = generateToken({
                        userId: user._id.toString(),
                        role: user.role
                    });
                }
            }

            // Return response immediately without waiting for async operations
            res.status(200).json(
                ApiResponse.success({
                    paymentId,
                    orderId,
                    status: 'paid',
                    token: authToken,
                    userId: finalUserId,
                    subscription: {
                        id: updatedSubscription._id,
                        planId: updatedSubscription.planId,
                        planName: updatedSubscription.planName,
                        status: updatedSubscription.status,
                        startDate: updatedSubscription.startDate,
                        endDate: updatedSubscription.endDate,
                        nextBillingDate: updatedSubscription.nextBillingDate
                    }
                }, 'Guest subscription payment verified and activation initiated successfully')
            );
        } else {
            // Invalid signature
            await Subscription.findOneAndUpdate(
                { orderId },
                {
                    paymentId,
                    status: 'failed',
                    failureReason: 'Invalid signature'
                }
            );

            return res.status(400).json(ApiResponse.error('Guest subscription payment verification failed'));
        }
    } catch (error) {
        next(error);
    }
};

// Get payments for authenticated user
const getUserPayments = async (req, res, next) => {
    try {
        const payments = await Payment.find({ userId: req.user.userId })
            .populate('bookingId', 'serviceName therapistName date time')
            .select('-userId') // Don't expose user ID in response for security
            .sort({ createdAt: -1 });

        res.status(200).json(ApiResponse.success({ payments }, 'User payments retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Get payment details by ID (Admin only)
const getPaymentById = async (req, res, next) => {
    try {
        const { paymentId } = req.params;

        const payment = await Payment.findById(paymentId)
            .populate('userId', 'name email phone role status createdAt')
            .populate('bookingId', 'serviceName therapistName date time status paymentStatus clientName purchaseDate serviceExpiryDate serviceValidityDays')
            .populate('subscriptionId', 'planName status startDate endDate nextBillingDate');

        if (!payment) {
            return res.status(404).json(ApiResponse.error('Payment not found'));
        }

        // Fetch additional payment details from Razorpay if payment was captured
        let razorpayDetails = null;
        if (payment.paymentId && payment.captured) {
            try {
                const razorpayInstance = require('../config/razorpay');
                razorpayDetails = await razorpayInstance.payments.fetch(payment.paymentId);

                // Add additional Razorpay payment details to response
                payment.rzp_details = {
                    method: razorpayDetails.method,           // card, netbanking, wallet, upi
                    card_network: razorpayDetails.card?.network || null,
                    card_last_digits: razorpayDetails.card?.last4 || null,
                    bank: razorpayDetails.bank || null,
                    upi_id: razorpayDetails.upi?.vpa || null,
                    wallet: razorpayDetails.wallet || null,
                    vpa: razorpayDetails.vpa || null,
                    email: razorpayDetails.email || null,
                    contact: razorpayDetails.contact || null,
                    notes: razorpayDetails.notes || {},
                    refund_status: razorpayDetails.refund_status || null,
                    captured_at: razorpayDetails.captured_at || null,
                    fee: razorpayDetails.fee || null,
                    tax_amount: razorpayDetails.tax_amount || null
                };
            } catch (rzpError) {
                console.error('Error fetching Razorpay payment details:', rzpError.message);
                // Continue without Razorpay details if fetch fails
            }
        }

        res.status(200).json(ApiResponse.success({ payment }, 'Payment details retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Get all payments (Admin only)
const getAllPayments = async (req, res, next) => {
    try {
        const payments = await Payment.find()
            .populate('userId', 'name email')
            .populate('bookingId', 'serviceName therapistName date time')
            .sort({ createdAt: -1 });

        res.status(200).json(ApiResponse.success({ payments }, 'All payments retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Get Razorpay configuration for client
const getRazorpayConfig = async (req, res, next) => {
    try {
        // Get Razorpay credentials from database
        const { getRazorpayCredentials } = require('../utils/credentialsManager');
        const razorpayCreds = await getRazorpayCredentials();

        if (!razorpayCreds || !razorpayCreds.keyId) {
            return res.status(500).json(ApiResponse.error('Razorpay is not configured properly'));
        }

        res.status(200).json(
            ApiResponse.success({
                key: razorpayCreds.keyId
            }, 'Razorpay configuration retrieved successfully')
        );
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createOrder,
    createGuestOrder,
    verifyPayment,
    verifyGuestPayment,
    handleWebhook,
    createSubscriptionOrder,
    createGuestSubscriptionOrder,
    verifySubscriptionPayment,
    verifyGuestSubscriptionPayment,
    getUserPayments,
    getAllPayments,
    getPaymentById,
    getRazorpayConfig
};

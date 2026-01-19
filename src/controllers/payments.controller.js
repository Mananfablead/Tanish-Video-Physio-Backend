const razorpay = require('../config/razorpay');
const Booking = require('../models/Booking.model');
const Payment = require('../models/Payment.model');
const Subscription = require('../models/Subscription.model');
const SubscriptionPlan = require('../models/SubscriptionPlan.model');
const ApiResponse = require('../utils/apiResponse');

// Create a payment order for Razorpay
const createOrder = async (req, res, next) => {
    try {
        const { bookingId, amount, currency = 'INR' } = req.body;

        // Verify the booking belongs to the user
        const booking = await Booking.findOne({ _id: bookingId, userId: req.user.userId });
        if (!booking) {
            return res.status(404).json(ApiResponse.error('Booking not found'));
        }

        // Create order in Razorpay
        const options = {
            amount: amount * 100, // Razorpay expects amount in paise
            currency: currency,
            receipt: `booking_${bookingId}`,
            payment_capture: 1 // Auto-capture payment
        };

        const order = await razorpay.orders.create(options);

        // Create payment record in our database
        const payment = new Payment({
            bookingId,
            userId: req.user.userId,
            amount,
            currency,
            orderId: order.id,
            status: 'created'
        });

        await payment.save();

        res.status(200).json(
            ApiResponse.success({
                orderId: order.id,
                key: process.env.RAZORPAY_KEY_ID,
                amount: order.amount,
                currency: order.currency
            }, 'Payment order created successfully')
        );
    } catch (error) {
        next(error);
    }
};

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
        
        // Check if the required environment variable is available
        if (!process.env.RAZORPAY_KEY_SECRET) {
            return res.status(500).json(ApiResponse.error('Server configuration error: Razorpay secret is not set'));
        }
        
        const secret = process.env.RAZORPAY_KEY_SECRET; // Using the correct environment variable name

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
                    status: 'verified',
                    verifiedAt: new Date()
                }
            );

            // Update the booking status as well
            await Booking.findByIdAndUpdate(
                payment.bookingId,
                { paymentStatus: 'verified' }
            );

            res.status(200).json(
                ApiResponse.success({
                    paymentId,
                    orderId,
                    status: 'verified'
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

// Handle payment verification for guest users (without authentication)
const verifyGuestPayment = async (req, res, next) => {
    try {
        const { paymentId, orderId, signature } = req.body;
        // Note: No userId required as this is for guest users

        // Fetch payment details from our database
        const payment = await Payment.findOne({ orderId });
        if (!payment) {
            return res.status(404).json(ApiResponse.error('Payment not found'));
        }

        // Verify the payment with Razorpay
        const crypto = require('crypto');

        // Check if the required environment variable is available
        if (!process.env.RAZORPAY_KEY_SECRET) {
            return res.status(500).json(ApiResponse.error('Server configuration error: Razorpay secret is not set'));
        }

        const secret = process.env.RAZORPAY_KEY_SECRET; // Using the correct environment variable name

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
                    status: 'verified',
                    verifiedAt: new Date()
                }
            );

            // Update the booking status as well
            await Booking.findByIdAndUpdate(
                payment.bookingId,
                { paymentStatus: 'verified' }
            );

            // If this was a guest booking, send login credentials to the user's email
            const booking = await Booking.findById(payment.bookingId).populate('userId', 'email name password');
            if (booking && booking.userId) {
                // Send welcome email with login credentials to the user
                await sendWelcomeEmailWithCredentials(booking.userId.email, booking.userId.name, booking.userId.email, booking.userId.password);
            }

            res.status(200).json(
                ApiResponse.success({
                    paymentId,
                    orderId,
                    status: 'verified'
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

// Helper function to send booking confirmation email
async function sendBookingConfirmationEmail(email, name, bookingId) {
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
  <title>Booking Confirmation</title>
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
                Booking Confirmed Successfully!
              </h2>

              <p style="font-size:15px; line-height:1.6;">
                Hello <strong>${name}</strong>,
              </p>

              <p style="font-size:15px; line-height:1.6;">
                Your booking has been confirmed successfully! Here are the details:
              </p>
              
              <p style="font-size:15px; line-height:1.6;">
                <strong>Booking ID:</strong> ${bookingId}<br>
              </p>

              <p style="font-size:15px; line-height:1.6;">
                Thank you for choosing Tanish Physio. You can log in to your account to manage your bookings.
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
        subject: 'Booking Confirmed - Tanish Physio',
        html: message
    };

    // Send email
    await transporter.sendMail(mailOptions);
}

// Helper function to send welcome email with login credentials
async function sendWelcomeEmailWithCredentials(email, name, username, password) {
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
        from: process.env.EMAIL_USER,
        subject: 'Welcome to Tanish Physio - Account Created & Payment Verified',
        html: message
    };

    // Send email
    await transporter.sendMail(mailOptions);
}

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
                await Booking.findByIdAndUpdate(
                    payment.bookingId,
                    { paymentStatus: 'paid' }
                );

                // If this was a guest booking, send login credentials to the user's email
                const booking = await Booking.findById(payment.bookingId).populate('userId', 'email name password');
                if (booking && booking.userId) {
                    // Send welcome email with login credentials to the user
                    await sendWelcomeEmailWithCredentials(booking.userId.email, booking.userId.name, booking.userId.email, booking.userId.password);
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
        const { planId, amount, currency = 'INR' } = req.body;

        // Validate plan exists in the database
        const plan = await SubscriptionPlan.findOne({ planId, status: 'active' });
        if (!plan) {
            return res.status(400).json(ApiResponse.error('Invalid or inactive plan ID'));
        }

        // Use the actual plan price instead of the provided amount
        const planAmount = plan.price;

        // Create order in Razorpay
        const options = {
            amount: planAmount * 100, // Razorpay expects amount in paise
            currency: currency,
            receipt: `sub_${planId}_${req.user.userId}`,
            payment_capture: 1 // Auto-capture payment
        };

        const order = await razorpay.orders.create(options);

        // Create subscription record in our database
        const subscription = new Subscription({
            userId: req.user.userId,
            planId,
            planName: plan.name,
            amount: planAmount,
            currency,
            orderId: order.id,
            status: 'created'
        });

        await subscription.save();

        res.status(200).json(
            ApiResponse.success({
                orderId: order.id,
                key: process.env.RAZORPAY_KEY_ID, // Frontend needs this to initialize Razorpay
                amount: order.amount,
                currency: order.currency
            }, 'Subscription order created successfully')
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
        
        // Check if the required environment variable is available
        if (!process.env.RAZORPAY_KEY_SECRET) {
            return res.status(500).json(ApiResponse.error('Server configuration error: Razorpay secret is not set'));
        }
        
        const secret = process.env.RAZORPAY_KEY_SECRET; // Using the correct environment variable name

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
                    status: 'verified',
                    verifiedAt: new Date()
                }
            );

            res.status(200).json(
                ApiResponse.success({
                    paymentId,
                    orderId,
                    status: 'verified'
                }, 'Subscription payment verified successfully')
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

module.exports = {
    createOrder,
    verifyPayment,
    verifyGuestPayment,
    handleWebhook,
    createSubscriptionOrder,
    verifySubscriptionPayment,
    getUserPayments,
    getAllPayments
};
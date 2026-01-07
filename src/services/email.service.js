const nodemailer = require('nodemailer');
const config = require('../config/env');
const logger = require('../utils/logger');

// Create transporter
const transporter = nodemailer.createTransporter({
    host: config.EMAIL_HOST,
    port: config.EMAIL_PORT,
    secure: config.EMAIL_PORT === 465, // true for 465, false for other ports
    auth: {
        user: config.EMAIL_USER,
        pass: config.EMAIL_PASS,
    },
});

// Verify transporter configuration
transporter.verify((error, success) => {
    if (error) {
        logger.error('Email transporter configuration error:', error);
    } else {
        logger.info('Email transporter is ready to send messages');
    }
});

// Send email
const sendEmail = async (options) => {
    try {
        const mailOptions = {
            from: config.EMAIL_USER,
            to: options.to,
            subject: options.subject,
            text: options.text,
            html: options.html,
        };

        const result = await transporter.sendMail(mailOptions);
        logger.info(`Email sent to ${options.to}`);
        return result;
    } catch (error) {
        logger.error('Error sending email:', error);
        throw error;
    }
};

// Send welcome email
const sendWelcomeEmail = async (user) => {
    const options = {
        to: user.email,
        subject: 'Welcome to Tanish Physio',
        html: `
      <h1>Welcome to Tanish Physio, ${user.name}!</h1>
      <p>Thank you for registering with us. We're excited to have you on board.</p>
      <p>Your account has been created successfully.</p>
    `,
    };

    return sendEmail(options);
};

// Send booking confirmation email
const sendBookingConfirmation = async (user, booking) => {
    const options = {
        to: user.email,
        subject: 'Booking Confirmation - Tanish Physio',
        html: `
      <h1>Booking Confirmation</h1>
      <p>Dear ${user.name},</p>
      <p>Your booking has been confirmed.</p>
      <p><strong>Service:</strong> ${booking.serviceName}</p>
      <p><strong>Therapist:</strong> ${booking.therapistName}</p>
      <p><strong>Date:</strong> ${booking.date}</p>
      <p><strong>Time:</strong> ${booking.time}</p>
      <p><strong>Status:</strong> ${booking.status}</p>
      <p>If you have any questions, please contact us.</p>
    `,
    };

    return sendEmail(options);
};

// Send payment confirmation email
const sendPaymentConfirmation = async (user, payment) => {
    const options = {
        to: user.email,
        subject: 'Payment Confirmation - Tanish Physio',
        html: `
      <h1>Payment Confirmation</h1>
      <p>Dear ${user.name},</p>
      <p>Your payment has been processed successfully.</p>
      <p><strong>Amount:</strong> ₹${payment.amount}</p>
      <p><strong>Transaction ID:</strong> ${payment.paymentId}</p>
      <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
      <p>Thank you for choosing Tanish Physio.</p>
    `,
    };

    return sendEmail(options);
};

module.exports = {
    sendEmail,
    sendWelcomeEmail,
    sendBookingConfirmation,
    sendPaymentConfirmation
};
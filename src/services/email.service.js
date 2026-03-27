const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const { getEmailCredentials } = require('../utils/credentialsManager');

// Transporter will be initialized dynamically when sending emails
let transporter = null;

// Initialize transporter with credentials
const initializeTransporter = async () => {
    try {
        const emailCreds = await getEmailCredentials();
        if (!emailCreds) {
            throw new Error('Email configuration not found in database');
        }

        // Configure security settings based on encryption type
        let secure = false;
        let requireTLS = false;

        if (emailCreds.encryption) {
            switch (emailCreds.encryption.toUpperCase()) {
                case 'SSL':
                    secure = true;
                    break;
                case 'TLS':
                case 'STARTTLS':
                    requireTLS = true;
                    break;
                case 'NONE':
                    secure = false;
                    requireTLS = false;
                    break;
                default:
                    // Default behavior based on port
                    secure = emailCreds.port === 465;
                    break;
            }
        } else {
            // Default behavior based on port if no encryption specified
            secure = emailCreds.port === 465;
        }

        transporter = nodemailer.createTransport({
            host: emailCreds.host,
            port: emailCreds.port,
            secure: secure, // true for 465, false for other ports
            requireTLS: requireTLS, // Enable STARTTLS if required
            connectionTimeout: 15000,
            greetingTimeout: 15000,
            socketTimeout: 20000,
            auth: {
                user: emailCreds.user,
                pass: emailCreds.password,
            },
        });

        // Verify transporter configuration
        await transporter.verify();
        logger.info('Email transporter is ready to send messages');

        return true;
    } catch (error) {
        logger.error('Email transporter configuration error', {
            message: error.message,
            code: error.code,
            command: error.command,
            host: error?.host,
            port: error?.port
        });
        return false;
    }
};

// Function to ensure transporter is ready
const getTransporter = async () => {
    if (!transporter) {
        const initialized = await initializeTransporter();
        if (!initialized) {
            throw new Error('Failed to initialize email transporter');
        }
    }
    return transporter;
};

// Initialize transporter on module load
initializeTransporter();

// Send email
const sendEmail = async (options) => {
    try {
        // Get fresh credentials for each email send
        const emailCreds = await getEmailCredentials();
        if (!emailCreds) {
            throw new Error('Email configuration not found in database');
        }

        // Create a fresh transporter with current credentials to avoid caching issues
        const freshTransporter = nodemailer.createTransport({
            host: emailCreds.host,
            port: emailCreds.port,
            secure: emailCreds.port === 465, // true for 465, false for other ports
            connectionTimeout: 15000,
            greetingTimeout: 15000,
            socketTimeout: 20000,
            auth: {
                user: emailCreds.user,
                pass: emailCreds.password,
            },
        });

        // Verify transporter configuration before sending
        try {
            await freshTransporter.verify();
        } catch (verifyError) {
            logger.error('Email transporter verification failed', {
                message: verifyError.message,
                code: verifyError.code,
                command: verifyError.command
            });
            // Still attempt to send, as verification sometimes fails but sending succeeds
        }

        const mailOptions = {
            // from: emailCreds.user,
            from: `"Tanish Physio & Fitness" <${emailCreds.user}>`,

            to: options.to,
            subject: options.subject,
            text: options.text,
            html: options.html,
        };

        const sendWithRetry = async () => {
            try {
                return await freshTransporter.sendMail(mailOptions);
            } catch (firstError) {
                const isTransientSocketError =
                    firstError?.code === 'ESOCKET' ||
                    firstError?.code === 'ECONNRESET' ||
                    (typeof firstError?.message === 'string' && firstError.message.includes('ECONNRESET'));

                if (!isTransientSocketError) {
                    throw firstError;
                }

                logger.warn('Transient SMTP socket error while sending email, retrying once', {
                    message: firstError.message,
                    code: firstError.code
                });
                await new Promise(resolve => setTimeout(resolve, 1200));
                return await freshTransporter.sendMail(mailOptions);
            }
        };

        const result = await sendWithRetry();
        logger.info(`Email sent successfully to ${options.to}`);
        return result;
    } catch (error) {
        logger.error('Error sending email:', {
            message: error.message,
            code: error.code,
            command: error.command,
            to: options?.to,
            subject: options?.subject
        });

        // Log specific authentication error
        if (error.code === 'EAUTH' || error.message.includes('535') || error.message.includes('Username and Password not accepted')) {
            logger.error('Authentication error: Please check your email credentials in the admin panel. If using Gmail, ensure you are using an App Password, not your regular password.');
        }

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
        <p>If you have any questions or need assistance, feel free to contact our support team.</p>
        <p>Best regards,<br>Tanish Physio Team</p>
        
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
    sendPaymentConfirmation,
    initializeTransporter
};
// Notification Service - WhatsApp & Email Integration (Modified)
// Works with existing notification system
// Uses credentials from database instead of environment variables
// Removed payment_received notifications as requested, new_booking notifications are active

const nodemailer = require('nodemailer');
const axios = require('axios');
const EmailTemplates = require('../templates/emailTemplates');
const SessionReminderTemplates = require('../templates/sessionReminderTemplates');
const { getWhatsAppCredentials, getEmailCredentials } = require('../utils/credentialsManager');
const Credentials = require('../models/Credentials.model');
const { validateWhatsAppToken, addCountryCode } = require('../utils/whatsapp.utils');
const User = require('../models/User.model'); // Import User model for admin profile

class NotificationService {
    // WhatsApp Templates (Approved templates from Facebook Business Manager)
    static whatsappTemplates = {
        welcome_message: {
            name: 'welcome_message',
            language: 'en',
            components: [
                {
                    type: 'body',
                    parameters: [
                        { type: 'text', text: '{{1}}' }  // Client name
                    ]
                },

            ]
        },

        booking_confirmation: {
            name: 'booking_confirmation',
            language: 'en',
            components: [
                {
                    type: 'body',
                    parameters: [
                        { type: 'text', text: '{{1}}' },  // Client name
                        { type: 'text', text: '{{2}}' },  // Service name
                        { type: 'text', text: '{{3}}' },  // Date
                        { type: 'text', text: '{{4}}' },  // Time
                    ]
                }
            ]
        },

        /* DISABLED: payment_successful: {
            name: 'payment_successful',
            language: 'en',
            components: [
                {
                    type: 'body',
                    parameters: [
                        { type: 'text', text: '{{1}}' },  // Client name
                        { type: 'text', text: '{{2}}' },  // Amount
                        { type: 'text', text: '{{3}}' },  // Service name
                        { type: 'text', text: '{{4}}' }   // Transaction ID
                    ]
                }
            ]
        }, */

        /* DISABLED: payment_reminder: {
            name: 'payment_reminder',
            language: 'en',
            components: [
                {
                    type: 'body',
                    parameters: [
                        { type: 'text', text: '{{1}}' },  // Client name
                        { type: 'text', text: '{{2}}' },  // Service name
                        { type: 'text', text: '{{3}}' }   // Amount
                    ]
                }
            ]
        }, */

        booking_cancelled: {
            name: 'booking_cancelled',
            language: 'en',
            components: [
                {
                    type: 'body',
                    parameters: [
                        { type: 'text', text: '{{1}}' },  // Client name
                        { type: 'text', text: '{{2}}' },  // Service name
                        { type: 'text', text: '{{3}}' }   // Reason
                    ]
                }
            ]
        },

        session_reminder: {
            name: 'session_reminder',
            language: 'en',
            components: [
                {
                    type: 'body',
                    parameters: [
                        { type: 'text', text: '{{1}}' },  // Service name
                        { type: 'text', text: '{{2}}' },  // Date
                        { type: 'text', text: '{{3}}' },  // Time
                        { type: 'text', text: '{{4}}' }   // Meeting link
                    ]
                },
                {
                    type: 'button',
                    sub_type: 'url',
                    index: '0',
                    parameters: [
                        { type: 'text', text: '{{4}}' }  // Meeting link
                    ]
                }
            ]
        },

        appointment_rescheduled: {
            name: 'appointment_rescheduled',
            language: 'en',
            components: [
                {
                    type: 'body',
                    parameters: [
                        { type: 'text', text: '{{1}}' },  // Service name
                        { type: 'text', text: '{{2}}' },  // Old date
                        { type: 'text', text: '{{3}}' },  // Old time
                        { type: 'text', text: '{{4}}' },  // New date
                        { type: 'text', text: '{{5}}' },  // New time
                        { type: 'text', text: '{{6}}' }   // Client name
                    ]
                },

            ]
        },

        new_booking: {
            name: 'new_booking_request',
            language: 'en',
            components: [
                {
                    type: 'body',
                    parameters: [
                        { type: 'text', text: '{{1}}' },  // Patient Name
                        { type: 'text', text: '{{2}}' },  // Phone
                        { type: 'text', text: '{{3}}' },  // Service Name
                        { type: 'text', text: '{{4}}' },  // Date
                        { type: 'text', text: '{{5}}' }   // Time
                    ]
                }
            ]
        },

        payment_received: {
            name: 'payment_received',
            language: 'en',
            components: [
                {
                    type: 'body',
                    parameters: [
                        { type: 'text', text: '{{1}}' },  // Amount
                        { type: 'text', text: '{{2}}' },  // Service name
                        { type: 'text', text: '{{3}}' },  // Transaction ID
                        { type: 'text', text: '{{4}}' }   // Client name
                    ]
                }
            ]
        }
    };

    // Prepare WhatsApp template with actual data
    static prepareWhatsAppTemplate(templateName, data) {
        const template = { ...this.whatsappTemplates[templateName] };
        if (!template) return null;

        // Replace template variables with actual data
        let preparedTemplate = { ...template };

        switch (templateName) {
            case 'welcome_message':
                preparedTemplate.components = [
                    {
                        type: 'body',
                        parameters: [
                            { type: 'text', text: data.clientName || 'Valued Customer' }
                        ]
                    }
                ];
                break;

            case 'booking_confirmation':
                // Ensure we have all required data - template expects exactly 4 parameters
                const clientName = data.clientName || 'Valued Customer';
                const serviceName = data.serviceName || 'Physiotherapy Session';
                const date = data.date || 'TBD';
                const time = data.time || 'TBD';

                // Ensure we provide exactly 4 parameters as expected by the template
                preparedTemplate.components = [
                    {
                        type: 'body',
                        parameters: [
                            { type: 'text', text: clientName },      // Parameter 1
                            { type: 'text', text: serviceName },     // Parameter 2
                            { type: 'text', text: date },            // Parameter 3
                            { type: 'text', text: time }             // Parameter 4
                        ]
                    }
                ];
                break;

            case 'booking_cancelled':
                // Ensure we have all required data - template expects exactly 3 parameters
                const cancelClientName = data.clientName || 'Customer';
                const cancelServiceName = data.serviceName || 'Physiotherapy Session';
                const cancelReason = data.reason || data.cancellationReason || 'No reason provided';

                console.log('📋 Booking Cancelled Data:', {
                    clientName: cancelClientName,
                    serviceName: cancelServiceName,
                    reason: cancelReason,
                    originalData: data
                });

                preparedTemplate.components = [
                    {
                        type: 'body',
                        parameters: [
                            { type: 'text', text: cancelClientName },
                            { type: 'text', text: cancelServiceName },
                            { type: 'text', text: cancelReason }
                        ]
                    }
                ];
                break;

            /* DISABLED: case 'payment_successful':
                preparedTemplate.components = [
                    {
                        type: 'body',
                        parameters: [
                            { type: 'text', text: data.clientName || 'Customer' },
                            { type: 'text', text: data.amount || '0' },
                            { type: 'text', text: data.serviceName || 'Service' },
                            { type: 'text', text: data.transactionId || 'N/A' }
                        ]
                    }
                ];
                break; */

            /* DISABLED: case 'payment_reminder':
                preparedTemplate.components = [
                    {
                        type: 'body',
                        parameters: [
                            { type: 'text', text: data.clientName || 'Customer' },
                            { type: 'text', text: data.serviceName || 'Service' },
                            { type: 'text', text: data.amount || '0' }
                        ]
                    }
                ];
                break; */

            case 'session_reminder':
                // Ensure we have all required data
                const sessionServiceName = data.serviceName || 'Physiotherapy Session';
                const sessionDate = data.date || 'TBD';
                const sessionTime = data.time || 'TBD';
                const sessionMeetingLink = data.meetingLink || 'Meeting Link TBD';

                console.log('📋 Session Reminder Data:', {
                    serviceName: sessionServiceName,
                    date: sessionDate,
                    time: sessionTime,
                    meetingLink: sessionMeetingLink,
                    originalData: data
                });

                preparedTemplate.components = [
                    {
                        type: 'body',
                        parameters: [
                            { type: 'text', text: sessionServiceName },
                            { type: 'text', text: sessionDate },
                            { type: 'text', text: sessionTime },
                            { type: 'text', text: sessionMeetingLink }
                        ]
                    },
                    {
                        type: 'button',
                        sub_type: 'url',
                        index: '0',
                        parameters: [
                            {
                                type: 'text',
                                text: sessionMeetingLink
                            }
                        ]
                    }
                ];
                break;
                
            case 'session_reminder_24h':
                messageContent = SessionReminderTemplates.sessionReminder24hWhatsApp(data);
                break;
                
            case 'session_reminder_1h':
                messageContent = SessionReminderTemplates.sessionReminder1hWhatsApp(data);
                break;

            case 'appointment_rescheduled':
                preparedTemplate.components = [
                    {
                        type: 'body',
                        parameters: [
                            { type: 'text', text: data.serviceName || 'Service' },
                            { type: 'text', text: data.oldDate || 'TBD' },
                            { type: 'text', text: data.oldTime || 'TBD' },
                            { type: 'text', text: data.newDate || 'TBD' },
                            { type: 'text', text: data.newTime || 'TBD' },
                            { type: 'text', text: data.clientName || 'Customer' }
                        ]
                    }
                ];
                break;

            case 'payment_received':
                preparedTemplate.components = [
                    {
                        type: 'body',
                        parameters: [
                            { type: 'text', text: data.amount || '0' },
                            { type: 'text', text: data.serviceName || 'Service' },
                            { type: 'text', text: data.transactionId || 'N/A' },
                            { type: 'text', text: data.clientName || 'Customer' }
                        ]
                    }
                ];
                break;

            case 'new_booking':
                preparedTemplate.components = [
                    {
                        type: 'body',
                        parameters: [
                            { type: 'text', text: data.clientName || data.patientName || 'Patient' },  // Patient Name
                            { type: 'text', text: data.phone || 'N/A' },  // Phone
                            { type: 'text', text: data.serviceName || 'Service' },  // Service Name
                            { type: 'text', text: data.date || 'N/A' },  // Date
                            { type: 'text', text: data.time || 'N/A' }   // Time
                        ]
                    }
                ];
                break;
        }

        return preparedTemplate;
    }

    // Get admin email from credentials
    static async getAdminEmail() {
        try {
            const emailCreds = await getEmailCredentials();
            return emailCreds?.adminEmail || null;
        } catch (error) {
            console.error('Error getting admin email from credentials:', error);
            return null;
        }
    }

    // Get admin phone from credentials
    static async getAdminPhone() {
        try {
            const emailCreds = await getEmailCredentials();
            return emailCreds?.adminPhone || null;
        } catch (error) {
            console.error('Error getting admin phone from credentials:', error);
            return null;
        }
    }

    constructor() {
        // Initialize transports (will be set in async init method)
        this.emailTransporter = null;
        this.whatsappConfig = null;
        this.whatsappEnabled = false;
        this.emailEnabled = false;

        // Initialize credentials asynchronously
        this.init();
    }

    // Validate WhatsApp access token with Facebook API
    async validateWhatsAppToken(accessToken) {
        // Use the utility function
        return await validateWhatsAppToken(accessToken);
    }

    // Async initialization to load credentials from database
    async init() {
        try {
            // Load WhatsApp credentials from database
            const whatsappCreds = await getWhatsAppCredentials();
            if (whatsappCreds) {
                this.whatsappConfig = {
                    accessToken: whatsappCreds.accessToken,
                    phoneNumberId: whatsappCreds.phoneNumberId,
                    businessId: whatsappCreds.businessId,
                    apiUrl: 'https://graph.facebook.com/v21.0'
                };

                // Validate the access token with Facebook API
                const tokenValidation = await this.validateWhatsAppToken(whatsappCreds.accessToken);

                if (tokenValidation.valid) {
                    this.whatsappEnabled = !!(this.whatsappConfig.accessToken && this.whatsappConfig.phoneNumberId);
                    console.log('✅ WhatsApp configured and token validated successfully');
                } else {
                    console.warn('⚠️ WhatsApp token validation failed:', tokenValidation.error);
                    this.whatsappEnabled = false;
                }
            } else {
                console.log('No WhatsApp credentials found in database');
            }
            console.log('WhatsApp Config:', this.whatsappConfig);

            // Load Email credentials from database
            const emailCreds = await getEmailCredentials();
            if (emailCreds) {
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

                this.emailConfig = {
                    host: emailCreds.host,
                    port: emailCreds.port,
                    secure: secure, // true for 465, false for other ports like 587
                    requireTLS: requireTLS, // Enable STARTTLS if required
                    auth: {
                        user: emailCreds.user,
                        pass: emailCreds.password
                    }
                };

                this.emailTransporter = nodemailer.createTransport(this.emailConfig);

                try {
                    // Verify transporter configuration
                    await this.emailTransporter.verify();
                    console.log('✅ Notification email transporter verified and ready');
                    this.emailEnabled = !!(emailCreds.user && emailCreds.password);
                } catch (verifyError) {
                    console.warn('⚠️ Notification email transporter verification failed:', verifyError.message);
                // Still enable email functionality but log the issue
                    this.emailEnabled = !!(emailCreds.user && emailCreds.password);
                }
            }

            // Initialize notification templates (without payment_received only, new_booking added)
            this.templates = {
                // User notifications
                welcome_message: {
                    email: {
                        subject: (data) => `Welcome to Tanish Physio, ${data.clientName || 'there'}!`,
                        template: EmailTemplates.welcome
                    },
                    whatsapp: 'welcome_message'
                },

                // Booking notifications
                booking_confirmation: {
                    email: {
                        subject: 'Booking Confirmed - Tanish Physio',
                        template: EmailTemplates.bookingConfirmed
                    }
                },

                booking_cancelled: {
                    email: {
                        subject: 'Booking Cancelled - Tanish Physio',
                        template: EmailTemplates.bookingCancelled
                    },
                    whatsapp: 'booking_cancelled'
                },

                /* DISABLED: payment_successful: {
                    email: {
                        subject: 'Payment Successful - Tanish Physio',
                        template: EmailTemplates.paymentSuccess
                    },
                    whatsapp: 'payment_successful'
                }, */

                /* DISABLED: payment_reminder: {
                    email: {
                        subject: 'Payment Reminder - Tanish Physio',
                        template: EmailTemplates.paymentReminder
                    },
                    whatsapp: 'payment_reminder'
                }, */

                session_reminder: {
                    email: {
                        subject: 'Session Reminder - Tanish Physio',
                        template: EmailTemplates.sessionReminder
                    },
                    whatsapp: 'session_reminder'
                },

                // Admin notifications (without payment_received)
                new_booking: {
                    email: {
                        subject: 'New Booking Request - Admin',
                        template: EmailTemplates.adminNewBooking
                    },
                    whatsapp: 'new_booking_request'
                },

                upcoming_session: {
                    email: {
                        subject: 'Upcoming Session - Admin',
                        template: EmailTemplates.adminUpcomingSession
                    },
                    whatsapp: 'upcoming_session'
                },

                payment_received: {
                    email: {
                        subject: 'Payment Received - Admin',
                        template: EmailTemplates.adminPaymentReceived
                    },
                    whatsapp: 'payment_received'
                }
            };
        } catch (error) {
            console.error('Error initializing notification service credentials:', error);
        }
    }

    // Main notification dispatcher
    async sendNotification(recipient, type, data) {
        try {
            const template = this.templates[type];
            if (!template) {
                throw new Error(`Notification template '${type}' not found`);
            }

            const results = {
                email: null,
                whatsapp: null
            };

            // For admin notifications, get admin email from credentials instead of recipient
            const isAdminNotification = ['new_booking', 'upcoming_session'].includes(type);

            if (isAdminNotification) {
                // Get admin email from credentials
                const adminEmail = await NotificationService.getAdminEmail();
                if (adminEmail) {
                    recipient.email = adminEmail;
                    console.log('📧 Using admin email from credentials:', adminEmail);
                } else {
                    console.warn('⚠️ No admin email found in credentials, using recipient email:', recipient.email);
                }
            }

            // Send email if configured
            if (this.emailEnabled && template.email) {
                results.email = await this.sendEmail(recipient.email, template.email, data);
            }

            // Send WhatsApp if configured
            if (this.whatsappEnabled && template.whatsapp) {
                let recipientPhone = null;

                // Determine recipient based on notification type
                // For user-specific notifications, use the user's phone from recipient
                // For admin notifications, get admin's phone from user profile
                const userSpecificTemplates = ['welcome_message', 'booking_confirmation', 'booking_cancelled', 'session_reminder', 'session_reminder_24h', 'session_reminder_1h', 'appointment_rescheduled', 'payment_successful', 'payment_reminder'];

                if (userSpecificTemplates.includes(template.whatsapp)) {
                    // Use user's phone from the recipient parameter
                    recipientPhone = recipient.phone;
                } else {
                    // For admin notifications, get admin phone from user profile (not credentials)
                    const adminUser = await User.findOne({ role: 'admin' }).select('phone');
                    if (adminUser && adminUser.phone) {
                        recipientPhone = adminUser.phone;
                        console.log('📱 Using admin phone from user profile:', adminUser.phone);
                    } else {
                        console.warn('⚠️ No admin phone found in user profile');
                    }
                }

                if (recipientPhone) {
                    // Log the data being sent to the template
                    console.log('📤 Sending WhatsApp template:', {
                        templateName: template.whatsapp,
                        recipientPhone: recipientPhone,
                        dataKeys: Object.keys(data || {}),
                        data: data
                    });

                    results.whatsapp = await this.sendWhatsAppTemplate(
                        recipientPhone,
                        template.whatsapp,
                        data
                    );
                } else {
                    console.warn(`No phone number available for WhatsApp template: ${template.whatsapp}`);
                }
            }

            return results;
        } catch (error) {
            console.error('Notification service error:', error);
            throw error;
        }
    }

    // Generate subject line based on template type
    generateSubjectFromTemplate(templateName, data) {
        const subjectMap = {
            'welcome_message': `Welcome to Tanish Physio, ${data.clientName || 'there'}!`,
            'booking_created': `Booking Request Submitted - ${data.serviceName || 'Your Service'}`,
            'booking_confirmation': `Booking Confirmed - ${data.serviceName || 'Your Appointment'}`,
            'booking_cancelled': `Booking Cancelled - ${data.serviceName || 'Your Appointment'}`,
            /* 'payment_reminder': `Payment Reminder - ${data.serviceName || 'Your Booking'}`, */
            /* 'payment_successful': `Payment Successful - ${data.serviceName || 'Your Service'}`, */
            'session_reminder': `Session Reminder - ${data.serviceName || 'Your Appointment'}`,
            'session_reminder_24h': `Session Reminder - 24 Hours - ${data.serviceName || 'Your Appointment'}`,
            'session_reminder_1h': `Session Reminder - 1 Hour - ${data.serviceName || 'Your Appointment'}`,
            'appointment_rescheduled': `Appointment Rescheduled - ${data.serviceName || 'Your Session'}`,
            'new_booking': `New Booking Request - ${data.serviceName || 'Service'}`,
            'upcoming_session': `Upcoming Session - ${data.serviceName || 'Tomorrow'}`,
            'custom_notification': data.title || 'Notification from Tanish Physio'
        };

        return subjectMap[templateName] || 'Notification from Tanish Physio';
    }

    // Send email notification
    async sendEmail(to, template, data) {
        try {
            console.log('📧 Processing email template:', typeof template, template);

            // Validate inputs
            if (!to) {
                throw new Error('Recipient email is required');
            }

            if (!template) {
                throw new Error('Email template is required');
            }

            // Validate data
            if (!data || typeof data !== 'object') {
                console.warn('📧 Invalid data provided, using empty object');
                data = {};
            }

            // Handle template mapping - if template is a string, map to EmailTemplates function
            let htmlContent;
            let subject;

            if (typeof template === 'string') {
                // Map template names to EmailTemplates functions (without payment_received, new_booking template added)
                const templateMap = {
                    'welcome_message': EmailTemplates.welcome,
                    'booking_confirmation': EmailTemplates.bookingConfirmed,
                    'booking_cancelled': EmailTemplates.bookingCancelled,
                    'new_booking': EmailTemplates.adminNewBooking,  // Added for admin notifications
                    /* 'payment_reminder': EmailTemplates.paymentReminder, */
                    /* 'payment_successful': EmailTemplates.paymentSuccess, */
                    'session_reminder': EmailTemplates.sessionReminder,
                    'session_reminder_24h': SessionReminderTemplates.sessionReminder24hEmail,
                    'session_reminder_1h': SessionReminderTemplates.sessionReminder1hEmail,
                    'appointment_rescheduled': EmailTemplates.appointmentRescheduled,
                    'upcoming_session': EmailTemplates.adminUpcomingSession,
                    'custom_notification': EmailTemplates.customNotification
                };

                const templateFunction = templateMap[template];
                if (!templateFunction) {
                    throw new Error(`Template '${template}' not found`);
                }

                htmlContent = templateFunction(data);
                // Generate subject based on template type
                subject = this.generateSubjectFromTemplate(template, data);
            } else {
                // Handle legacy template objects or invalid templates
                console.log('📧 Processing legacy template object:', template);

                // Check if template has the required structure
                if (template && typeof template.template === 'function') {
                    subject = typeof template.subject === 'function'
                        ? template.subject(data) 
                        : template.subject || 'Notification from Tanish Physio';
                    htmlContent = template.template(data);
                } else {
                    // Fallback for malformed templates
                    console.warn('📧 Invalid template structure, using fallback');
                    subject = 'Notification from Tanish Physio';
                    htmlContent = `
                        <div style="font-family: Arial, sans-serif; padding: 20px;">
                            <h2>Notification</h2>
                            <p>${data.message || 'You have received a notification.'}</p>
                            <p>Best regards,<br>Tanish Physio Team</p>
                        </div>
                    `;
                }
            }

            const mailOptions = {
                from: process.env.EMAIL_FROM || this.emailConfig?.auth?.user || 'no-reply@tanishphysio.com',
                to: to,
                subject: subject,
                html: htmlContent
            };

            // Verify transporter before sending (in case credentials changed since initialization)
            if (this.emailTransporter && this.emailTransporter.verify) {
                try {
                    await this.emailTransporter.verify();
                } catch (verifyError) {
                    console.warn('Email transporter verification failed, attempting to reinitialize:', verifyError.message);

                    // Re-fetch credentials and recreate transporter
                    const emailCreds = await getEmailCredentials();
                    if (emailCreds) {
                        this.emailConfig = {
                            host: emailCreds.host,
                            port: emailCreds.port,
                            secure: emailCreds.port === 465,
                            auth: {
                                user: emailCreds.user,
                                pass: emailCreds.password
                            }
                        };
                        this.emailTransporter = nodemailer.createTransport(this.emailConfig);
                        this.emailEnabled = !!(emailCreds.user && emailCreds.password);
                    }
                }
            }

            const result = await this.emailTransporter.sendMail(mailOptions);
            console.log('Email sent successfully:', result.messageId);
            return { success: true, messageId: result.messageId };
        } catch (error) {
            console.error('❌ Email sending failed:', {
                message: error.message,
                code: error.code,
                command: error.command,
                stack: error.stack,
                templateType: typeof template,
                templateValue: template
            });

            // Log specific authentication error
            if (error.code === 'EAUTH' || error.message.includes('535') || error.message.includes('Username and Password not accepted')) {
                console.error('Authentication error: Please check your email credentials in the admin panel. If using Gmail, ensure you are using an App Password, not your regular password.');
            }

            return { success: false, error: error.message };
        }
    }

    // Send WhatsApp notification via WhatsApp Business API
    async sendWhatsApp(to, template, data) {
        // Declare variables at method scope to be accessible in catch block
        let formattedPhone = '';
        let messageContent = '';
        let response = null;

        try {
            // Get admin phone number from admin user profile instead of CMS Contact
            const adminUser = await User.findOne({ role: 'admin' }).select('phone');
            if (!adminUser || !adminUser.phone) {
                throw new Error('Admin phone number not configured in admin profile');
            }
            
            // Format admin phone number with country code if needed
            formattedPhone = addCountryCode(adminUser.phone);

            // Generate message content
            messageContent = typeof template === 'function' ? template(data) : template;

            // Log the complete message being sent
            console.log('📱 WhatsApp Message Being Sent to admin:', {
                original_to: to,
                to: formattedPhone,
                message: messageContent,
                type: 'text',
                timestamp: new Date().toISOString()
            });

            // Log API request details
            const requestData = {
                messaging_product: 'whatsapp',
                to: formattedPhone,
                text: {
                    body: messageContent
                }
            };
            this.logWhatsAppApiRequest(requestData, `${this.whatsappConfig.apiUrl}/${this.whatsappConfig.phoneNumberId}/messages`);

            // Send via WhatsApp Business API
            const url = `${this.whatsappConfig.apiUrl}/${this.whatsappConfig.phoneNumberId}/messages`;

            response = await axios.post(url, {
                messaging_product: 'whatsapp',
                to: formattedPhone,
                text: {
                    body: messageContent
                }
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.whatsappConfig.accessToken}`,
                }

            });
            console.log('WhatsApp API Request:', response.data);  

            // Analyze the response
            const analysis = this.analyzeWhatsAppResponse(response, requestData);

            console.log('✅ WhatsApp message sent successfully:', {
                response: response.data,
                message_sent: messageContent,
                recipient: formattedPhone,
                message_id: response.data?.messages?.[0]?.id,
                status: response.status,
                headers: response.headers,
                analysis: analysis,
                timestamp: new Date().toISOString()
            });

            // Log detailed WhatsApp response for debugging
            console.log('📱 WhatsApp API Response Details:', {
                success: true,
                message_id: response.data?.messages?.[0]?.id,
                recipient_id: response.data?.contacts?.[0]?.wa_id,
                response_data: response.data,
                http_status: response.status,
                response_headers: Object.fromEntries(
                    Object.entries(response.headers).filter(([key]) =>
                        key.toLowerCase().includes('content') ||
                        key.toLowerCase().includes('request') ||
                        key.toLowerCase().includes('date')
                    )
                ),
                timestamp: new Date().toISOString()
            });
            return { success: true, messageId: response.data?.messages?.[0]?.id };

        } catch (error) {
            console.error('❌ WhatsApp sending failed:', {
                error: error.message,
                phone: formattedPhone,
                message_attempted: messageContent,
                response: response?.data,
                response_status: response?.status,
                response_headers: response?.headers,
                error_code: error.code,
                error_response: error.response?.data,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });

            // Log detailed error response from WhatsApp API
            if (error.response) {
                console.error('📱 WhatsApp API Error Response:', {
                    status: error.response.status,
                    status_text: error.response.statusText,
                    error_data: error.response.data,
                    error_headers: Object.fromEntries(
                        Object.entries(error.response.headers).filter(([key]) =>
                            key.toLowerCase().includes('content') ||
                            key.toLowerCase().includes('request') ||
                            key.toLowerCase().includes('www-authenticate')
                        )
                    ),
                    request_url: error.config?.url,
                    request_method: error.config?.method,
                    timestamp: new Date().toISOString()
                });

                // Check if the error is related to access token issues
                if (error.response.data?.error?.code === 190) {
                    console.error('🚨 WhatsApp Access Token Error: The access token may be invalid, expired, or malformed');
                    console.error('💡 Solution: Please regenerate your WhatsApp access token in the Facebook Business Manager and update it in the admin panel');
                }
            }
            return {
                success: false,
                error: error.message,
                phone: formattedPhone
            };
        }
    }

    // Send WhatsApp template message (for approved templates)
    async sendWhatsAppTemplate(to, templateName, data) {
        // Declare variables at method scope to be accessible in catch block
        let formattedPhone = '';
        let response = null;

        try {
            if (!this.whatsappEnabled) {
                throw new Error('WhatsApp not configured');
            }

            // Format phone number with country code if needed
            formattedPhone = addCountryCode(to);

            // Prepare template
            console.log('🔧 Preparing template:', templateName, 'with data:', data);
            const preparedTemplate = NotificationService.prepareWhatsAppTemplate(templateName, data);
            if (!preparedTemplate) {
                throw new Error(`Template ${templateName} not found`);
            }

            // Restructure template for Facebook API - proper format required by Meta
            const templateNameToUse = preparedTemplate.name || templateName;

            const facebookTemplate = {
                name: templateNameToUse,
                language: {
                    code: preparedTemplate.language || 'en'
                },
                components: preparedTemplate.components || []
            };

            // Log API request details
            const templateRequestData = {
                messaging_product: 'whatsapp',
                to: formattedPhone,
                type: 'template',
                template: facebookTemplate
            };
            this.logWhatsAppApiRequest(templateRequestData, `${this.whatsappConfig.apiUrl}/${this.whatsappConfig.phoneNumberId}/messages`);

            // Send via WhatsApp Business API
            const url = `${this.whatsappConfig.apiUrl}/${this.whatsappConfig.phoneNumberId}/messages`;

            const response = await axios.post(url, {
                messaging_product: 'whatsapp',
                to: formattedPhone,
                type: 'template',
                template: {
                    name: facebookTemplate.name,
                    language: facebookTemplate.language,
                    components: facebookTemplate.components
                }
            }, {
                headers: {
                    'Authorization': `Bearer ${this.whatsappConfig.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            // Analyze the template response
            const analysis = this.analyzeWhatsAppResponse(response, templateRequestData);

            console.log('✅ WhatsApp template message sent successfully:', {
                response: response.data,
                template_name: templateName,
                recipient: formattedPhone,
                template_data: data,
                message_id: response.data?.messages?.[0]?.id,
                status: response.status,
                analysis: analysis,
                timestamp: new Date().toISOString()
            });

            // Log detailed WhatsApp template response

            return { success: true, messageId: response.data?.messages?.[0]?.id };

        } catch (error) {
            // Log detailed template error response
            if (error.response) {
                console.error('❌ WhatsApp Template API Error Response:', error.response.data);

                // Check if the error is related to access token issues
                if (error.response.data?.error?.code === 190) {
                    console.error('🚨 WhatsApp Access Token Error: The access token may be invalid, expired, or malformed');
                    console.error('💡 Solution: Please regenerate your WhatsApp access token in the Facebook Business Manager and update it in the admin panel');
                }
            }
            return { success: false, error: error.message };
        }
    }

    // Log incoming WhatsApp webhook responses
    logWhatsAppWebhookResponse(webhookData) {
        try {

            // Log detailed message content based on type
            const message = webhookData?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
            if (message) {
                switch (message.type) {
                    case 'text':
                        console.log('📝 Text Message Content:', {
                            body: message.text?.body,
                            from: message.from,
                            id: message.id
                        });
                        break;
                    case 'interactive':
                        console.log('🔘 Interactive Message Response:', {
                            type: message.interactive?.type,
                            response: message.interactive,
                            from: message.from,
                            id: message.id
                        });
                        break;
                    case 'button':
                        console.log('🔘 Button Response:', {
                            button_text: message.button?.text,
                            payload: message.button?.payload,
                            from: message.from,
                            id: message.id
                        });
                        break;
                    case 'status':
                        console.log('📊 Message Status Update:', {
                            status: message.status,
                            message_id: message.id,
                            recipient_id: message.recipient_id,
                            timestamp: message.timestamp
                        });
                        break;
                }
            }
        } catch (error) {
            console.error('❌ Error logging WhatsApp webhook:', error.message);
        }
    }

    // Log WhatsApp API request details
    logWhatsAppApiRequest(requestData, endpoint) {
        console.log('📤 WhatsApp API Request:', {
            endpoint: endpoint,
            request_data: requestData,
            messaging_product: requestData?.messaging_product,
            to: requestData?.to,
            message_type: requestData?.type || requestData?.text ? 'text' : 'unknown',
            timestamp: new Date().toISOString()
        });
    }
    async sendBulkNotifications(recipients, type, data) {
        const results = [];

        for (const recipient of recipients) {
            const result = await this.sendNotification(recipient, type, data);
            results.push(result);
        }

        return results;
    }

    // Analyze WhatsApp response for common issues
    analyzeWhatsAppResponse(response, requestData) {
        const analysis = {
            success: response?.data?.messages?.[0]?.id ? true : false,
            message_id: response?.data?.messages?.[0]?.id,
            recipient_status: response?.data?.contacts?.[0]?.input,
            recipient_wa_id: response?.data?.contacts?.[0]?.wa_id,
            has_errors: false,
            errors: [],
            warnings: []
        };

        // Check for common issues
        if (!response?.data?.messages?.[0]?.id) {
            analysis.has_errors = true;
            analysis.errors.push('No message ID returned from WhatsApp API');
        }

        if (!response?.data?.contacts?.[0]?.wa_id) {
            analysis.warnings.push('No WhatsApp ID returned for recipient');
        }

        // Check if recipient is valid
        if (response?.data?.contacts?.[0]?.status === 'invalid') {
            analysis.has_errors = true;
            analysis.errors.push('Invalid recipient phone number');
        }

        // Log analysis results
        console.log('🔍 WhatsApp Response Analysis:', {
            analysis: analysis,
            request_data: requestData,
            response_summary: {
                status: response?.status,
                message_count: response?.data?.messages?.length || 0,
                contact_count: response?.data?.contacts?.length || 0
            },
            timestamp: new Date().toISOString()
        });

        return analysis;
    }
    validateConfiguration() {
        const issues = [];

        // Check if init has completed
        if (!this.emailTransporter && !this.whatsappConfig) {
            issues.push('Notification service not initialized yet');
        }

        // Check email configuration
        if (!this.emailEnabled) {
            issues.push('Email configuration incomplete or not found in database');
        }

        // Check WhatsApp Business API configuration (optional)
        if (this.whatsappConfig) {
            if (!this.whatsappConfig.businessId) {
                issues.push('WhatsApp Business ID not configured');
            }
        }

        return {
            valid: issues.length === 0,
            issues,
            hasEmail: this.emailEnabled,
            hasWhatsApp: this.whatsappEnabled
        };
    }
}

module.exports = new NotificationService();
module.exports.NotificationService = NotificationService;

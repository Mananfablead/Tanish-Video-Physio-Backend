// Notification Service - WhatsApp & Email Integration
// Works with existing notification system
// Uses credentials from database instead of environment variables

const nodemailer = require('nodemailer');
const axios = require('axios');
const EmailTemplates = require('../templates/emailTemplates');
const { getWhatsAppCredentials, getEmailCredentials } = require('../utils/credentialsManager');

class NotificationService {
    // WhatsApp Templates (Approved templates from Facebook Business Manager)
    static whatsappTemplates = {
        // Welcome template - for first contact with new users
        welcome_template: {
            name: 'welcome_message',
            language: 'en',
            components: [
                {
                    type: 'body',
                    parameters: [
                        { type: 'text', text: '{{1}}' }  // Client name
                    ]
                },
                {
                    type: 'button',
                    sub_type: 'url',
                    index: 0,
                    parameters: [
                        { type: 'text', text: '{{2}}' }  // Website URL
                    ]
                }
            ]
        },

        // Booking confirmation template
        booking_confirmation_template: {
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
                        { type: 'text', text: '{{5}}' }   // Meeting link
                    ]
                },
                {
                    type: 'button',
                    sub_type: 'url',
                    index: 0,
                    parameters: [
                        { type: 'text', text: '{{5}}' }  // Meeting link
                    ]
                }
            ]
        },

        // Payment confirmation template
        payment_confirmation_template: {
            name: 'payment_confirmation',
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
        },

        // Session reminder template
        session_reminder_template: {
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
                    index: 0,
                    parameters: [
                        { type: 'text', text: '{{4}}' }  // Meeting link
                    ]
                }
            ]
        },

        // Appointment rescheduled template
        appointment_rescheduled_template: {
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
                {
                    type: 'button',
                    sub_type: 'url',
                    index: 0,
                    parameters: [
                        { type: 'text', text: '{{7}}' }  // New meeting link
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
            case 'welcome_template':
                preparedTemplate.components = [
                    {
                        type: 'body',
                        parameters: [
                            { type: 'text', text: data.clientName || 'Valued Customer' }
                        ]
                    },
                    {
                        type: 'button',
                        sub_type: 'url',
                        index: 0,
                        parameters: [
                            { type: 'text', text: data.websiteUrl || 'https://yourwebsite.com' }
                        ]
                    }
                ];
                break;

            case 'booking_confirmation_template':
                preparedTemplate.components = [
                    {
                        type: 'body',
                        parameters: [
                            { type: 'text', text: data.clientName || 'Customer' },
                            { type: 'text', text: data.serviceName || 'Service' },
                            { type: 'text', text: data.date || 'TBD' },
                            { type: 'text', text: data.time || 'TBD' },
                            { type: 'text', text: data.meetingLink || 'https://meet.jit.si/session' }
                        ]
                    },
                    {
                        type: 'button',
                        sub_type: 'url',
                        index: 0,
                        parameters: [
                            { type: 'text', text: data.meetingLink || 'https://meet.jit.si/session' }
                        ]
                    }
                ];
                break;

            case 'payment_confirmation_template':
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
                break;

            case 'session_reminder_template':
                preparedTemplate.components = [
                    {
                        type: 'body',
                        parameters: [
                            { type: 'text', text: data.serviceName || 'Service' },
                            { type: 'text', text: data.date || 'TBD' },
                            { type: 'text', text: data.time || 'TBD' },
                            { type: 'text', text: data.meetingLink || 'https://meet.jit.si/session' }
                        ]
                    },
                    {
                        type: 'button',
                        sub_type: 'url',
                        index: 0,
                        parameters: [
                            { type: 'text', text: data.meetingLink || 'https://meet.jit.si/session' }
                        ]
                    },
                    {
                        type: 'button',
                        sub_type: 'quick_reply',
                        index: 1,
                        parameters: [
                            { type: 'payload', payload: 'RESCHEDULE' }
                        ]
                    }
                ];
                break;

            case 'appointment_rescheduled_template':
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
                    },
                    {
                        type: 'button',
                        sub_type: 'url',
                        index: 0,
                        parameters: [
                            { type: 'text', text: data.newMeetingLink || 'https://meet.jit.si/new-session' }
                        ]
                    }
                ];
                break;
        }

        return preparedTemplate;
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
                this.whatsappEnabled = !!(this.whatsappConfig.accessToken && this.whatsappConfig.phoneNumberId);
            }

            // Load Email credentials from database
            const emailCreds = await getEmailCredentials();
            if (emailCreds) {
                this.emailConfig = {
                    host: emailCreds.host,
                    port: emailCreds.port,
                    secure: false,
                    auth: {
                        user: emailCreds.user,
                        pass: emailCreds.password
                    }
                };
                this.emailTransporter = nodemailer.createTransport(this.emailConfig);
                this.emailEnabled = !!(emailCreds.user && emailCreds.password);
            }

            // Initialize notification templates
            this.templates = {
            // User notifications
                booking_confirmation: {
                    email: {
                        subject: 'Booking Confirmed - Tanish Physio',
                        template: EmailTemplates.bookingConfirmation
                    },
                    whatsapp: (data) => `✅ Booking confirmed!\n\nHello ${data.clientName},\nYour booking for ${data.serviceName} on ${data.date} at ${data.time} has been confirmed.\n\nMeeting Link: ${data.meetingLink}\n\nThank you for choosing Tanish Physio!`
                },

                payment_confirmation: {
                    email: {
                        subject: 'Payment Successful - Tanish Physio',
                        template: EmailTemplates.paymentConfirmation
                    },
                    whatsapp: (data) => `💰 Payment Confirmed!\n\nDear ${data.clientName},\nWe've received your payment of ₹${data.amount} for ${data.serviceName}.\n\nTransaction ID: ${data.transactionId}\n\nThank you for your payment!`
                },

                session_reminder: {
                    email: {
                        subject: 'Session Reminder - Tanish Physio',
                        template: EmailTemplates.sessionReminder
                    },
                    whatsapp: (data) => `⏰ Session Reminder\n\nHello ${data.clientName},\nThis is a reminder for your ${data.serviceName} session today at ${data.time}.\n\nMeeting Link: ${data.meetingLink}\n\nPlease join on time!`
                },

                appointment_rescheduled: {
                    email: {
                        subject: 'Appointment Rescheduled - Tanish Physio',
                        template: EmailTemplates.appointmentRescheduled
                    },
                    whatsapp: (data) => `📅 Appointment Rescheduled\n\nHello ${data.clientName},\nYour appointment for ${data.serviceName} has been rescheduled.\n\nNew Date: ${data.newDate}\nNew Time: ${data.newTime}\n\nMeeting Link: ${data.newMeetingLink}\n\nWe apologize for any inconvenience.`
                },

                // Admin notifications
                new_booking: {
                    email: {
                        subject: 'New Booking Request - Admin',
                        template: EmailTemplates.adminNewBooking
                    },
                    whatsapp: (data) => `📋 New Booking Request\n\nClient: ${data.clientName}\nService: ${data.serviceName}\nDate: ${data.date}\nTime: ${data.time}\nStatus: ${data.status}\n\nPlease review and confirm.`
                },

                payment_received: {
                    email: {
                        subject: 'Payment Received - Admin',
                        template: EmailTemplates.adminPaymentReceived
                    },
                    whatsapp: (data) => `💰 Payment received: ₹${data.amount} for ${data.serviceName}. Transaction ID: ${data.transactionId}.`
                },

                upcoming_session: {
                    email: {
                        subject: 'Upcoming Session - Admin',
                        template: EmailTemplates.adminUpcomingSession
                    },
                    whatsapp: (data) => `Upcoming session reminder: ${data.clientName} (${data.serviceName}) at ${data.time} with ${data.therapistName}.`
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

            // Send email if configured
            if (this.emailEnabled && template.email) {
                results.email = await this.sendEmail(recipient.email, template.email, data);
            }

            // Send WhatsApp if configured
            if (this.whatsappEnabled && recipient.phone && template.whatsapp) {
                results.whatsapp = await this.sendWhatsApp(recipient.phone, template.whatsapp, data);
            }

            return results;
        } catch (error) {
            console.error('Notification service error:', error);
            throw error;
        }
    }

    // Send email notification
    async sendEmail(to, template, data) {
        try {
            // Handle both string subjects and function subjects
            const subject = typeof template.subject === 'function'
                ? template.subject(data) 
                : template.subject;

            const mailOptions = {
                from: process.env.EMAIL_FROM || this.emailConfig?.auth?.user || 'no-reply@tanishphysio.com',
                to: to,
                subject: subject,
                html: template.template(data)
            };

            const result = await this.emailTransporter.sendMail(mailOptions);
            console.log('Email sent successfully:', result.messageId);
            return { success: true, messageId: result.messageId };
        } catch (error) {
            console.error('Email sending failed:', error);
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
            // Format phone number (remove + and spaces)
            formattedPhone = to.replace(/[\s\+]/g, '');

            // Generate message content
            messageContent = typeof template === 'function' ? template(data) : template;

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
                    'Authorization': `Bearer ${this.whatsappConfig.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('WhatsApp message sent successfully:', response.data);
            return { success: true, messageId: response.data?.messages?.[0]?.id };

        } catch (error) {
            console.error('WhatsApp sending failed:', {
                error: error.message,
                phone: formattedPhone,
                message: messageContent,
                response: response?.data
            });
            return {
                success: false,
                error: error.message,
                phone: formattedPhone
            };
        }
    }

    // Send WhatsApp template message (for approved templates)
    async sendWhatsAppTemplate(to, templateName, data) {
        try {
            if (!this.whatsappEnabled) {
                throw new Error('WhatsApp not configured');
            }

            // Format phone number
            const formattedPhone = to.replace(/[\s\+]/g, '');

            // Prepare template
            const preparedTemplate = NotificationService.prepareWhatsAppTemplate(templateName, data);
            if (!preparedTemplate) {
                throw new Error(`Template ${templateName} not found`);
            }

            // Send via WhatsApp Business API
            const url = `${this.whatsappConfig.apiUrl}/${this.whatsappConfig.phoneNumberId}/messages`;

            const response = await axios.post(url, {
                messaging_product: 'whatsapp',
                to: formattedPhone,
                type: 'template',
                template: preparedTemplate
            }, {
                headers: {
                    'Authorization': `Bearer ${this.whatsappConfig.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('WhatsApp template message sent:', response.data);
            return { success: true, messageId: response.data?.messages?.[0]?.id };

        } catch (error) {
            console.error('WhatsApp template sending failed:', error);
            return { success: false, error: error.message };
        }
    }

    // Bulk notification sender
    async sendBulkNotifications(recipients, type, data) {
        const results = [];

        for (const recipient of recipients) {
            const result = await this.sendNotification(recipient, type, data);
            results.push(result);
        }

        return results;
    }

    // Validate notification configuration
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
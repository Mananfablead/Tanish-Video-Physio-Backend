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

            ]
        },

        // Payment confirmation template
        payment_confirmation_template: {
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
        },

        // Payment reminder template
        payment_reminder_template: {
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
        },

        // Booking cancelled template
        booking_cancelled_template: {
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
                    }
                ];
                break;

            case 'booking_confirmation':
                preparedTemplate.components = [
                    {
                        type: 'body',
                        parameters: [
                            { type: 'text', text: data.clientName || 'Customer' },
                            { type: 'text', text: data.serviceName || 'Service' },
                            { type: 'text', text: data.date || 'TBD' },
                            { type: 'text', text: data.time || 'TBD' },
                        ]
                    }
                ];
                break;

            case 'booking_cancelled':
                preparedTemplate.components = [
                    {
                        type: 'body',
                        parameters: [
                            { type: 'text', text: data.clientName || 'Customer' },
                            { type: 'text', text: data.serviceName || 'Service' },
                            { type: 'text', text: data.reason || 'No reason provided' }
                        ]
                    }
                ];
                break;

            case 'payment_successful':
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

            case 'payment_reminder':
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
                break;

            case 'session_reminder':
                preparedTemplate.components = [
                    {
                        type: 'body',
                        parameters: [
                            { type: 'text', text: data.serviceName || 'Service' },
                            { type: 'text', text: data.date || 'TBD' },
                            { type: 'text', text: data.time || 'TBD' },
                        ]
                    }
                ];
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
                        template: EmailTemplates.bookingConfirmed
                    },
                    whatsapp: (data) => `✅ Booking confirmed!\n\nHello ${data.clientName},\nYour booking for ${data.serviceName} on ${data.date} at ${data.time} has been confirmed.\n\nMeeting Link: ${data.meetingLink}\n\nThank you for choosing Tanish Physio!`
                },

                booking_cancelled: {
                    email: {
                        subject: 'Booking Cancelled - Tanish Physio',
                        template: EmailTemplates.bookingCancelled
                    },
                    whatsapp: (data) => `❌ Booking Cancelled\n\nHello ${data.clientName},\nWe regret to inform you that your booking for ${data.serviceName} has been cancelled.\n\nReason: ${data.reason || 'No reason provided'}\n\nWe apologize for any inconvenience.`
                },

                payment_successful: {
                    email: {
                        subject: 'Payment Successful - Tanish Physio',
                        template: EmailTemplates.paymentSuccess
                    },
                    whatsapp: (data) => `💰 Payment Confirmed!\n\nDear ${data.clientName},\nWe've received your payment of ₹${data.amount} for ${data.serviceName}.\n\nTransaction ID: ${data.transactionId}\n\nThank you for your payment!`
                },

                payment_reminder: {
                    email: {
                        subject: 'Payment Reminder - Tanish Physio',
                        template: EmailTemplates.paymentReminder
                    },
                    whatsapp: (data) => `🔔 Payment Reminder\n\nHello ${data.clientName},\nThis is a reminder to complete your payment of ₹${data.amount} for ${data.serviceName}.\n\nPlease complete your payment to secure your booking.\n\nThank you!`
                },

                session_reminder: {
                    email: {
                        subject: 'Session Reminder - Tanish Physio',
                        template: EmailTemplates.sessionReminder
                    },
                    whatsapp: (data) => `⏰ Session Reminder\n\nHello ${data.clientName},\nThis is a reminder for your ${data.serviceName} session today at ${data.time}.\n\nMeeting Link: ${data.meetingLink}\n\nPlease join on time!`
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

    // Generate subject line based on template type
    generateSubjectFromTemplate(templateName, data) {
        const subjectMap = {
            'booking_created': `Booking Request Submitted - ${data.serviceName || 'Your Service'}`,
            'booking_confirmation': `Booking Confirmed - ${data.serviceName || 'Your Appointment'}`,
            'booking_cancelled': `Booking Cancelled - ${data.serviceName || 'Your Appointment'}`,
            'payment_reminder': `Payment Reminder - ${data.serviceName || 'Your Booking'}`,
            'payment_successful': `Payment Successful - ${data.serviceName || 'Your Service'}`,
            'session_reminder': `Session Reminder - ${data.serviceName || 'Your Appointment'}`,
            'appointment_rescheduled': `Appointment Rescheduled - ${data.serviceName || 'Your Session'}`,
            'new_booking': `New Booking Request - ${data.clientName || 'Client'}`,
            'payment_received': `Payment Received - ₹${data.amount || '0'}`,
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
                // Map template names to EmailTemplates functions
                const templateMap = {
                    'booking_confirmation': EmailTemplates.bookingConfirmed,
                    'booking_cancelled': EmailTemplates.bookingCancelled,
                    'payment_reminder': EmailTemplates.paymentReminder,
                    'payment_successful': EmailTemplates.paymentSuccess,
                    'session_reminder': EmailTemplates.sessionReminder,
                    'appointment_rescheduled': EmailTemplates.appointmentRescheduled,
                    'new_booking': EmailTemplates.adminNewBooking,
                    'payment_received': EmailTemplates.adminPaymentReceived,
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

            const result = await this.emailTransporter.sendMail(mailOptions);
            console.log('Email sent successfully:', result.messageId);
            return { success: true, messageId: result.messageId };
        } catch (error) {
            console.error('❌ Email sending failed:', {
                message: error.message,
                stack: error.stack,
                templateType: typeof template,
                templateValue: template
            });
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

            // Log the complete message being sent
            console.log('📱 WhatsApp Message Being Sent:', {
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
                    'Authorization': `Bearer ${this.whatsappConfig.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

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

            // Log the complete template message being sent
            console.log('📱 WhatsApp Template Message Being Sent:', {
                to: formattedPhone,
                template_name: templateName,
                template_data: data,
                prepared_template: preparedTemplate,
                type: 'template',
                timestamp: new Date().toISOString()
            });

            // Log API request details
            const templateRequestData = {
                messaging_product: 'whatsapp',
                to: formattedPhone,
                type: 'template',
                template: preparedTemplate
            };
            this.logWhatsAppApiRequest(templateRequestData, `${this.whatsappConfig.apiUrl}/${this.whatsappConfig.phoneNumberId}/messages`);

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
            console.log('📱 WhatsApp Template API Response Details:', {
                success: true,
                message_id: response.data?.messages?.[0]?.id,
                recipient_id: response.data?.contacts?.[0]?.wa_id,
                template_name: templateName,
                template_data_sent: data,
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
            console.error('❌ WhatsApp template sending failed:', {
                error: error.message,
                template_name: templateName,
                template_data: data,
                phone: formattedPhone,
                response: response?.data,
                response_status: response?.status,
                error_code: error.code,
                error_response: error.response?.data,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });

            // Log detailed template error response
            if (error.response) {
                console.error('📱 WhatsApp Template API Error Response:', {
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
                    template_name: templateName,
                    template_data_sent: data,
                    timestamp: new Date().toISOString()
                });
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
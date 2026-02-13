// Notification Service - WhatsApp & Email Integration
// Works with existing notification system

const nodemailer = require('nodemailer');
const axios = require('axios');
const EmailTemplates = require('../templates/emailTemplates');

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
                        { type: 'text', text: '{{1}}' },  // Service name
                        { type: 'text', text: '{{2}}' },  // Date
                        { type: 'text', text: '{{3}}' },  // Time
                        { type: 'text', text: '{{4}}' }   // Client name
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
        
        // Booking cancellation template
        booking_cancellation_template: {
            name: 'booking_cancellation',
            language: 'en',
            components: [
                {
                    type: 'body',
                    parameters: [
                        { type: 'text', text: '{{1}}' },  // Service name
                        { type: 'text', text: '{{2}}' },  // Reason
                        { type: 'text', text: '{{3}}' }   // Client name
                    ]
                },
                {
                    type: 'button',
                    sub_type: 'quick_reply',
                    index: 0,
                    parameters: [
                        { type: 'payload', payload: 'BOOK_AGAIN' }
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
                },
                {
                    type: 'button',
                    sub_type: 'url',
                    index: 0,
                    parameters: [
                        { type: 'text', text: '{{4}}' }  // Payment link
                    ]
                }
            ]
        },
        
        // Payment success template
        payment_success_template: {
            name: 'payment_success',
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
                },
                {
                    type: 'button',
                    sub_type: 'url',
                    index: 0,
                    parameters: [
                        { type: 'text', text: '{{5}}' }  // View receipt link
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
                        { type: 'text', text: '{{1}}' },  // Client name
                        { type: 'text', text: '{{2}}' },  // Service name
                        { type: 'text', text: '{{3}}' },  // Date
                        { type: 'text', text: '{{4}}' }   // Time
                    ]
                },
                {
                    type: 'button',
                    sub_type: 'url',
                    index: 0,
                    parameters: [
                        { type: 'text', text: '{{5}}' }  // Meeting link
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
    // Helper method to prepare template with actual data
    static prepareTemplate(templateKey, data) {
        const template = this.whatsappTemplates[templateKey];
        if (!template) {
            throw new Error(`Template ${templateKey} not found`);
        }

        // Create a copy of the template
        const preparedTemplate = { ...template };
        
        // Replace parameters based on template type
        switch (templateKey) {
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
                            { type: 'text', text: data.websiteUrl || 'https://tanishphysio.com' }
                        ]
                    }
                ];
                break;
                
            case 'booking_confirmation_template':
                preparedTemplate.components = [
                    {
                        type: 'body',
                        parameters: [
                            { type: 'text', text: data.serviceName || 'Service' },
                            { type: 'text', text: data.date || 'TBD' },
                            { type: 'text', text: data.time || 'TBD' },
                            { type: 'text', text: data.clientName || 'Customer' }
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
                
            case 'booking_cancellation_template':
                preparedTemplate.components = [
                    {
                        type: 'body',
                        parameters: [
                            { type: 'text', text: data.serviceName || 'Service' },
                            { type: 'text', text: data.reason || 'No reason provided' },
                            { type: 'text', text: data.clientName || 'Customer' }
                        ]
                    },
                    {
                        type: 'button',
                        sub_type: 'quick_reply',
                        index: 0,
                        parameters: [
                            { type: 'payload', payload: 'BOOK_AGAIN' }
                        ]
                    }
                ];
                break;
                
            case 'payment_reminder_template':
                preparedTemplate.components = [
                    {
                        type: 'body',
                        parameters: [
                            { type: 'text', text: data.clientName || 'Customer' },
                            { type: 'text', text: data.serviceName || 'Service' },
                            { type: 'text', text: data.amount || '0' }
                        ]
                    },
                    {
                        type: 'button',
                        sub_type: 'url',
                        index: 0,
                        parameters: [
                            { type: 'text', text: data.paymentLink || 'https://payment.link' }
                        ]
                    }
                ];
                break;
                
            case 'payment_success_template':
                preparedTemplate.components = [
                    {
                        type: 'body',
                        parameters: [
                            { type: 'text', text: data.clientName || 'Customer' },
                            { type: 'text', text: data.amount || '0' },
                            { type: 'text', text: data.serviceName || 'Service' },
                            { type: 'text', text: data.transactionId || 'N/A' }
                        ]
                    },
                    {
                        type: 'button',
                        sub_type: 'url',
                        index: 0,
                        parameters: [
                            { type: 'text', text: data.receiptLink || 'https://receipt.link' }
                        ]
                    }
                ];
                break;
                
            case 'session_reminder_template':
                preparedTemplate.components = [
                    {
                        type: 'body',
                        parameters: [
                            { type: 'text', text: data.clientName || 'Customer' },
                            { type: 'text', text: data.serviceName || 'Service' },
                            { type: 'text', text: data.date || 'TBD' },
                            { type: 'text', text: data.time || 'TBD' }
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
        // Email configuration from environment
        this.emailConfig = {
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        };

        // WhatsApp Business API configuration (if available)
        this.whatsappConfig = {
            accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
            phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
            businessId: process.env.WHATSAPP_BUSINESS_ID,
            apiUrl: 'https://graph.facebook.com/v21.0'
        };

        // Initialize transports
        this.emailTransporter = nodemailer.createTransport(this.emailConfig);

        // Initialize WhatsApp Business API client if credentials exist
        this.whatsappEnabled = !!(this.whatsappConfig.accessToken && this.whatsappConfig.phoneNumberId);

        // Notification templates
        this.templates = {
            // User notifications


            booking_confirmed: {
                email: {
                    subject: 'Booking Confirmed - Tanish Physio',
                    template: EmailTemplates.bookingConfirmed
                },
                whatsapp: (data) => {
                    const formattedDate = data.date ? 
                        new Date(data.date).toLocaleDateString('en-IN', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                        }) : 'Not specified';
                    
                    const formattedTime = data.time || 'Not specified';
                    
                    return `✅ Booking Confirmed!

Service: ${data.serviceName || 'Unknown Service'}
Date: ${formattedDate}
Time: ${formattedTime}

${data.paymentStatus === 'pending' ? '⚠️ Please complete payment to secure your session.' : '✅ Payment received - session confirmed!'}

Thank you for choosing Tanish Physio!`;
                }
            },

            booking_cancelled: {
                email: {
                    subject: 'Booking Cancelled - Tanish Physio',
                    template: EmailTemplates.bookingCancelled
                },
                whatsapp: (data) => `Your ${data.serviceName} booking has been cancelled. ${data.reason ? `Reason: ${data.reason}` : ''} ${data.paymentStatus === 'paid' ? 'Refund will be processed.' : ''}`
            },

            payment_reminder: {
                email: {
                    subject: 'Payment Reminder - Tanish Physio',
                    template: EmailTemplates.paymentReminder
                },
                whatsapp: (data) => `Payment reminder: Please pay ₹${data.amount} for ${data.serviceName}. Pay now: ${data.paymentLink}`
            },

            payment_success: {
                email: {
                    subject: 'Payment Successful - Tanish Physio',
                    template: EmailTemplates.paymentSuccess
                },
                whatsapp: (data) => `Payment successful! ₹${data.amount} received for ${data.serviceName}. Transaction ID: ${data.transactionId}. Booking confirmed.`
            },

            session_reminder: {
                email: {
                    subject: 'Session Reminder - Tanish Physio',
                    template: EmailTemplates.sessionReminder
                },
                whatsapp: (data) => `Session reminder: ${data.serviceName} tomorrow at ${data.time} with ${data.therapistName}. ${data.meetLink ? `Join: ${data.meetLink}` : ''}`
            },

            // Custom admin notifications
            custom_notification: {
                email: {
                    subject: (data) => data.title || 'Notification from Tanish Physio',
                    template: EmailTemplates.customNotification
                },
                whatsapp: (data) => `${data.title}: ${data.message}`
            },
            
            // Admin notifications
            new_booking: {
                email: {
                    subject: 'New Booking Request - Admin',
                    template: EmailTemplates.adminNewBooking
                },
                whatsapp: (data) => `New booking request from ${data.clientName} for ${data.serviceName}. Status: Pending.`
            },

            payment_received: {
                email: {
                    subject: 'Payment Received - Admin',
                    template: EmailTemplates.adminPaymentReceived
                },
                whatsapp: (data) => `Payment received: ₹${data.amount} for ${data.serviceName}. Transaction ID: ${data.transactionId}.`
            },

            upcoming_session: {
                email: {
                    subject: 'Upcoming Session - Admin',
                    template: EmailTemplates.adminUpcomingSession
                },
                whatsapp: (data) => `Upcoming session reminder: ${data.clientName} (${data.serviceName}) at ${data.time} with ${data.therapistName}.`
            }
        };
    }

    // Main notification dispatcher
    async sendNotification(recipient, type, data) {
        try {
            const template = this.templates[type];
            if (!template) {
                throw new Error(`Notification template '${type}' not found`);
            }

            const results = {};

            // Send email notification
            if (recipient.email) {
                results.email = await this.sendEmail(recipient.email, template.email, data);
            }

            // Send WhatsApp notification
            if (recipient.phone && this.whatsappEnabled) {
                results.whatsapp = await this.sendWhatsApp(recipient.phone, template.whatsapp, data);
            }

            return {
                success: true,
                recipient: recipient.email || recipient.phone,
                channels: Object.keys(results),
                results
            };
        } catch (error) {
            console.error('Notification sending failed:', error);
            return {
                success: false,
                error: error.message,
                recipient: recipient.email || recipient.phone
            };
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
                from: process.env.EMAIL_USER,
                to: to,
                subject: subject,
                html: template.template(data)
            };

            const info = await this.emailTransporter.sendMail(mailOptions);
            console.log('Email sent:', info.messageId);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('Email sending failed:', error);
            return { success: false, error: error.message };
        }
    }

    // Send WhatsApp notification via WhatsApp Business API
    async sendWhatsApp(to, template, data) {
        // Declare variables at method scope to be accessible in catch block
        let formattedPhone = '';
        let payload = null;
        
        try {
            if (!this.whatsappEnabled) {
                return { success: false, error: 'WhatsApp Business API not configured' };
            }

            // Validate required configuration
            if (!this.whatsappConfig.phoneNumberId) {
                return { success: false, error: 'WhatsApp phone number ID not configured' };
            }

            if (!this.whatsappConfig.accessToken) {
                return { success: false, error: 'WhatsApp access token not configured' };
            }

            // Format phone number for WhatsApp Business API
            // Remove +, spaces, and other non-numeric characters
            // WhatsApp requires country code without +
            formattedPhone = to.replace(/[^0-9]/g, '');
            
            // If number starts with +, remove it
            if (to.startsWith('+')) {
                formattedPhone = formattedPhone.substring(1);
            }
            
            // Validate phone number length (should be 10-15 digits)
            if (formattedPhone.length < 10 || formattedPhone.length > 15) {
                return { success: false, error: 'Invalid phone number format' };
            }

            // Check if this is a template message or text message
            if (typeof template === 'object' && template.name) {
                // Template message format
                payload = {
                    messaging_product: 'whatsapp',
                    to: formattedPhone,
                    type: 'template',
                    template: {
                        name: template.name,
                        language: {
                            code: template.language || 'en'
                        },
                        components: template.components || []
                    }
                };
            } else {
                // Text message format (for replies to existing conversations)
                const message = typeof template === 'function' ? template(data) : template;
                payload = {
                    messaging_product: 'whatsapp',
                    to: formattedPhone,
                    type: 'text',
                    text: {
                        body: message
                    }
                };
            }

            const url = `${this.whatsappConfig.apiUrl}/${this.whatsappConfig.phoneNumberId}/messages`;
            
            const response = await axios.post(
                url,
                payload,
                {
                    headers: {
                        'Authorization': `Bearer ${this.whatsappConfig.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('WhatsApp message sent:', response.data.messages[0].id);
            return { success: true, messageId: response.data.messages[0].id };
        } catch (error) {
            console.error('WhatsApp sending failed:', {
                error: error.response?.data || error.message,
                phoneNumber: to,
                formattedPhone: formattedPhone,
                url: `${this.whatsappConfig.apiUrl}/${this.whatsappConfig.phoneNumberId}/messages`,
                payload: payload
            });
            
            const errorMessage = error.response?.data?.error?.message || 
                               error.response?.data?.message || 
                               error.message || 
                               'Unknown WhatsApp API error';
            
            // Check if the error is specifically about phone number not being in allowed list
            if (errorMessage.includes('(#131030) Recipient phone number not in allowed list')) {
                console.warn(`WhatsApp message blocked: Phone number ${formattedPhone} is not in the approved list. This is a sandbox limitation.`);

                return {
                    success: false,
                    error: `WhatsApp message blocked: Phone number ${formattedPhone} is not in the approved list. This is a sandbox limitation.`,
                    details: {
                        status: error.response?.status,
                        statusText: error.response?.statusText,
                        url: error.response?.config?.url
                    }
                };
            }

            return { 
                success: false, 
                error: errorMessage,
                details: {
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    url: error.response?.config?.url
                }
            };
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

        // Check email configuration
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            issues.push('Email configuration incomplete');
        }

        // Check WhatsApp Business API configuration (optional)
        if (process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
            if (!process.env.WHATSAPP_BUSINESS_ID) {
                issues.push('WhatsApp Business ID not configured');
            }
        }

        return {
            valid: issues.length === 0,
            issues,
            hasEmail: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS),
            hasWhatsApp: !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_BUSINESS_ID)
        };
    }
}

module.exports = new NotificationService();
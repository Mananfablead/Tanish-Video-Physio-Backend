const nodemailer = require('nodemailer');
const config = require('../config/env');

// Create transporter
const transporter = nodemailer.createTransport({
    host: config.EMAIL_HOST,
    port: config.EMAIL_PORT,
    secure: false,
    auth: {
        user: config.EMAIL_USER,
        pass: config.EMAIL_PASS
    }
});

// Send contact notification email to admin
const sendContactNotificationEmail = async (contactMessage) => {
    const mailOptions = {
        from: `"Tanish Physio & Fitness" <${config.EMAIL_USER}>`,
        to: config.ADMIN_EMAIL || config.EMAIL_USER,
        subject: `New Contact Message: ${contactMessage.subject}`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>New Contact Message</title>
                <style>
                    body {
                        font-family: 'Plus Jakarta Sans', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        line-height: 1.6;
                        color: #2a2a2a;
                        margin: 0;
                        padding: 0;
                        background-color: #f0f9f9;
                    }
                    .container {
                        max-width: 600px;
                        margin: 20px auto;
                        background: white;
                        border-radius: 16px;
                        overflow: hidden;
                        box-shadow: 0 10px 30px rgba(26, 188, 194, 0.15);
                    }
                    .header {
                        background: linear-gradient(135deg, #1abcbe 0%, #2dd4bf 100%);
                        color: white;
                        padding: 30px 25px;
                        text-align: center;
                    }
                    .header h1 {
                        margin: 0;
                        font-size: 28px;
                        font-weight: 700;
                        letter-spacing: -0.5px;
                    }
                    .header p {
                        margin: 8px 0 0 0;
                        opacity: 0.9;
                        font-size: 16px;
                    }
                    .content {
                        padding: 35px 25px;
                        background: #f8feff;
                    }
                    .field {
                        margin-bottom: 22px;
                        padding: 20px;
                        background: white;
                        border-radius: 12px;
                        border-left: 4px solid #1abcbe;
                        box-shadow: 0 4px 12px rgba(26, 188, 194, 0.08);
                    }
                    .label {
                        font-weight: 600;
                        color: #1abcbe;
                        font-size: 14px;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        margin-bottom: 8px;
                    }
                    .value {
                        font-size: 16px;
                        color: #333;
                        line-height: 1.5;
                    }
                    .message-box {
                        background: white;
                        padding: 25px;
                        border-radius: 12px;
                        border-left: 4px solid #1abcbe;
                        box-shadow: 0 4px 12px rgba(26, 188, 194, 0.08);
                        margin-top: 8px;
                        white-space: pre-line;
                    }
                    .info-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 15px;
                        margin-bottom: 25px;
                    }
                    .info-item {
                        background: white;
                        padding: 18px;
                        border-radius: 12px;
                        box-shadow: 0 4px 12px rgba(26, 188, 194, 0.08);
                    }
                    .info-item .label {
                        margin-bottom: 6px;
                    }
                    .info-item .value {
                        font-weight: 500;
                    }
                    .footer {
                        text-align: center;
                        padding: 25px;
                        background: #f0f9f9;
                        color: #666;
                        font-size: 13px;
                        border-top: 1px solid #e0f2f1;
                    }
                    .footer p {
                        margin: 5px 0;
                    }
                    .brand {
                        font-weight: 600;
                        color: #1abcbe;
                    }
                    @media (max-width: 600px) {
                        .container {
                            margin: 10px;
                            border-radius: 12px;
                        }
                        .header {
                            padding: 25px 20px;
                        }
                        .header h1 {
                            font-size: 24px;
                        }
                        .content {
                            padding: 25px 20px;
                        }
                        .info-grid {
                            grid-template-columns: 1fr;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>📩 New Contact Message</h1>
                        <p>A visitor has reached out through your website</p>
                    </div>
                    <div class="content">
                        <div class="info-grid">
                            <div class="info-item">
                                <div class="label">Name</div>
                                <div class="value">${contactMessage.name}</div>
                            </div>
                            <div class="info-item">
                                <div class="label">Email</div>
                                <div class="value">${contactMessage.email}</div>
                            </div>
                            ${contactMessage.phone ? `
                            <div class="info-item">
                                <div class="label">Phone</div>
                                <div class="value">${contactMessage.phone}</div>
                            </div>
                            ` : ''}
                            <div class="info-item">
                                <div class="label">Received</div>
                                <div class="value">${new Date(contactMessage.createdAt).toLocaleString()}</div>
                            </div>
                        </div>
                        
                        <div class="field">
                            <div class="label">Subject</div>
                            <div class="value">${contactMessage.subject}</div>
                        </div>
                        
                        <div class="field">
                            <div class="label">Message</div>
                            <div class="message-box">
                                ${contactMessage.message}
                            </div>
                        </div>
                    </div>
                    <div class="footer">
                        <p>This message was sent from the <span class="brand">Tanish Physio & Fitness</span> website contact form.</p>
                        <p>Please log in to the admin panel to manage this message.</p>
                    </div>
                </div>
            </body>
            </html>
        `
    };

    return await transporter.sendMail(mailOptions);
};

// Send reply to customer
const sendContactReplyEmail = async (contactMessage) => {
    const mailOptions = {
        from: `"Tanish Physio & Fitness" <${config.EMAIL_USER}>`,
        to: contactMessage.email,
        subject: `Re: ${contactMessage.subject}`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Thank You for Your Message</title>
                <style>
                    body {
                        font-family: 'Plus Jakarta Sans', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        line-height: 1.6;
                        color: #2a2a2a;
                        margin: 0;
                        padding: 0;
                        background-color: #f0f9f9;
                    }
                    .container {
                        max-width: 600px;
                        margin: 20px auto;
                        background: white;
                        border-radius: 16px;
                        overflow: hidden;
                        box-shadow: 0 10px 30px rgba(26, 188, 194, 0.15);
                    }
                    .header {
                        background: linear-gradient(135deg, #1abcbe 0%, #2dd4bf 100%);
                        color: white;
                        padding: 30px 25px;
                        text-align: center;
                    }
                    .header h1 {
                        margin: 0;
                        font-size: 28px;
                        font-weight: 700;
                        letter-spacing: -0.5px;
                    }
                    .header p {
                        margin: 8px 0 0 0;
                        opacity: 0.9;
                        font-size: 16px;
                    }
                    .content {
                        padding: 35px 25px;
                        background: #f8feff;
                    }
                    .greeting {
                        font-size: 18px;
                        margin-bottom: 25px;
                        color: #333;
                        line-height: 1.6;
                    }
                    .field {
                        margin-bottom: 25px;
                        padding: 20px;
                        background: white;
                        border-radius: 12px;
                        box-shadow: 0 4px 12px rgba(26, 188, 194, 0.08);
                    }
                    .label {
                        font-weight: 600;
                        color: #1abcbe;
                        font-size: 14px;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        margin-bottom: 12px;
                        display: flex;
                        align-items: center;
                    }
                    .label.original::before {
                        content: "💬";
                        margin-right: 8px;
                    }
                    .label.reply::before {
                        content: "✅";
                        margin-right: 8px;
                    }
                    .value {
                        font-size: 16px;
                        color: #333;
                        line-height: 1.6;
                    }
                    .message-box {
                        background: white;
                        padding: 25px;
                        border-radius: 12px;
                        border-left: 4px solid #1abcbe;
                        box-shadow: 0 4px 12px rgba(26, 188, 194, 0.08);
                        margin-top: 8px;
                        white-space: pre-line;
                    }
                    .reply-box {
                        background: white;
                        padding: 25px;
                        border-radius: 12px;
                        border-left: 4px solid #10b981;
                        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.1);
                        margin-top: 8px;
                        white-space: pre-line;
                        background: linear-gradient(145deg, #f0fdf4 0%, #dcfce7 100%);
                    }
                    .divider {
                        height: 1px;
                        background: linear-gradient(90deg, transparent, #1abcbe, transparent);
                        margin: 30px 0;
                    }
                    .closing {
                        background: white;
                        padding: 25px;
                        border-radius: 12px;
                        text-align: center;
                        margin: 25px 0;
                        box-shadow: 0 4px 12px rgba(26, 188, 194, 0.08);
                    }
                    .closing p {
                        margin: 0;
                        color: #555;
                        font-size: 15px;
                    }
                    .footer {
                        text-align: center;
                        padding: 25px;
                        background: #f0f9f9;
                        color: #666;
                        font-size: 13px;
                        border-top: 1px solid #e0f2f1;
                    }
                    .footer p {
                        margin: 5px 0;
                    }
                    .brand {
                        font-weight: 700;
                        color: #1abcbe;
                        font-size: 18px;
                        margin: 10px 0;
                    }
                    .tagline {
                        color: #777;
                        font-size: 14px;
                    }
                    @media (max-width: 600px) {
                        .container {
                            margin: 10px;
                            border-radius: 12px;
                        }
                        .header {
                            padding: 25px 20px;
                        }
                        .header h1 {
                            font-size: 24px;
                        }
                        .content {
                            padding: 25px 20px;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Thank You for Your Message</h1>
                        <p>We've received your inquiry and are here to help</p>
                    </div>
                    <div class="content">
                        <p class="greeting">Dear ${contactMessage.name},</p>
                        
                        <p>Thank you for contacting <strong>Tanish Physio & Fitness</strong>. We have received your message and our team will get back to you shortly.</p>
                        
                        <div class="field">
                            <div class="label original">Your Original Message</div>
                            <div class="message-box">
                                ${contactMessage.message}
                            </div>
                        </div>
                        
                        ${contactMessage.replyMessage ? `
                        <div class="divider"></div>
                        
                        <div class="field">
                            <div class="label reply">Our Response</div>
                            <div class="reply-box">
                                ${contactMessage.replyMessage}
                            </div>
                        </div>
                        ` : `
                        <div class="divider"></div>
                        
                        <div class="closing">
                            <p>We're currently reviewing your message and will respond as soon as possible. Our team typically responds within 24 hours during business days.</p>
                        </div>
                        `}
                        
                        <div class="closing">
                            <p>If you have any urgent inquiries, please feel free to call us directly.</p>
                        </div>
                    </div>
                    <div class="footer">
                        <div class="brand">Tanish Physio & Fitness</div>
                        <div class="tagline">Providing quality physiotherapy services</div>
                        <p>📍 Your trusted partner in health and wellness</p>
                    </div>
                </div>
            </body>
            </html>
        `
    };

    return await transporter.sendMail(mailOptions);
};

module.exports = {
    sendContactNotificationEmail,
    sendContactReplyEmail
};
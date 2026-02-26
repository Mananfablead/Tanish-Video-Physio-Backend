// Beautiful Email Templates for Tanish Physio
// Professional, Responsive, Healthcare-Focused Designs

class EmailTemplates {
    // Utility method to generate consistent headers
    static generateHeader(title, subtitle, backgroundColor, icon) {
        return `
            <tr>
                <td style="background: linear-gradient(135deg, ${backgroundColor.start} 0%, ${backgroundColor.end} 100%); padding: 40px 40px 30px 40px; text-align: center;">
                    <div style="background-color: rgba(255,255,255,0.2); width: 70px; height: 70px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
                        <span style="font-size: 32px; color: white;">${icon}</span>
                    </div>
                    <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700;">${title}</h1>
                    <p style="color: ${backgroundColor.text}; margin: 10px 0 0 0; font-size: 18px;">${subtitle}</p>
                </td>
            </tr>
        `;
    }

    // Utility method to generate consistent footers
    static generateFooter(primaryColor, textColor, copyrightText) {
        return `
            <tr>
                <td style="background-color: ${primaryColor}; padding: 30px 40px; text-align: center;">
                    <p style="color: ${textColor.light}; margin: 0 0 15px 0; font-size: 14px;">
                        ${copyrightText}
                    </p>
                    <p style="color: #ffffff; margin: 0; font-size: 16px; font-weight: 600;">
                        📞 +91 XXXXXXXXXX | 📧 info@tanishphysio.com
                    </p>
                    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid ${textColor.border};">
                        <p style="color: ${textColor.accent}; margin: 0; font-size: 12px;">
                            © 2024 Tanish Physio. Professional Healthcare Services.
                        </p>
                    </div>
                </td>
            </tr>
        `;
    }

    // Template 1: Custom Notification
    static customNotification(data) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.title || 'Notification'}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f7fa;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f7fa; padding: 20px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); overflow: hidden;">
                    ${EmailTemplates.generateHeader(
                        data.title || 'Important Notification',
                        '',
                        { start: '#1e3a8a', end: '#3b82f6', text: '#e0f2fe' },
                        '📢'
                    )}
                    
                    <tr>
                        <td style="padding: 40px;">
                            <p style="font-size: 18px; color: #1f2937; margin: 0 0 20px 0;">
                                Dear <strong>${data.userName || 'Valued User'}</strong>,
                            </p>
                            
                            <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
                                <p style="font-size: 16px; color: #374151; line-height: 1.6; margin: 0;">
                                    ${data.message || 'You have received an important notification.'}
                                </p>
                            </div>
                            
                            <p style="font-size: 16px; color: #4b5563; margin: 30px 0 0 0; line-height: 1.6;">
                                If you have any questions or need assistance, please don't hesitate to reach out to our support team.
                            </p>
                        </td>
                    </tr>
                    
                    ${EmailTemplates.generateFooter(
                        '#1e293b',
                        { light: '#cbd5e1', accent: '#94a3b8', border: '#334155' },
                        'Best regards, Tanish Physio Team'
                    )}
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `;
    }

    // Template: Welcome Email for new users
    static welcome(data) {
        const userName = data.clientName || data.userName || 'Valued User';

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #eef2ff;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #eef2ff; padding: 20px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 8px 20px rgba(0,0,0,0.08); overflow: hidden; border: 1px solid #e0e7ff;">
                    ${EmailTemplates.generateHeader(
                        'Welcome to Tanish Physio',
                        'Your recovery journey starts here',
                        { start: '#4f46e5', end: '#6366f1', text: '#e0e7ff' },
                        '✨'
                    )}
                    
                    <tr>
                        <td style="padding: 40px;">
                            <p style="font-size: 20px; color: #312e81; margin: 0 0 20px 0; font-weight: 600;">
                                Hi ${userName},
                            </p>

                            <p style="font-size: 16px; color: #4338ca; margin: 0 0 18px 0; line-height: 1.7;">
                                Thanks for creating your account with <strong>Tanish Physio</strong>! We're excited to support your wellness goals.
                            </p>

                            <div style="background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%); border-radius: 12px; padding: 20px 24px; margin: 20px 0; border: 1px solid #c7d2fe;">
                                <h3 style="color: #312e81; margin: 0 0 12px 0; font-size: 18px;">Here's what you can do next:</h3>
                                <ul style="color: #4338ca; margin: 0; padding-left: 18px; line-height: 1.6;">
                                    <li>Book a physiotherapy session that fits your schedule</li>
                                    <li>Explore personalized programs crafted by our experts</li>
                                    <li>Get reminders and updates right on WhatsApp and email</li>
                                </ul>
                            </div>

                            <p style="font-size: 16px; color: #4338ca; margin: 22px 0 0 0; line-height: 1.6;">
                                Need help? Just reply to this email or message us on WhatsApp—our team is here for you.
                            </p>
                        </td>
                    </tr>

                    ${EmailTemplates.generateFooter(
                        '#312e81',
                        { light: '#c7d2fe', accent: '#a5b4fc', border: '#4338ca' },
                        'Warm regards, Team Tanish Physio'
                    )}
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `;
    }

    // Template 2: Booking Created
    static bookingCreated(data) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Booking Request Submitted</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0f9ff;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f9ff; padding: 20px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 8px 25px rgba(0,0,0,0.1); overflow: hidden; border: 1px solid #e0f2fe;">
                    ${EmailTemplates.generateHeader(
                        'Booking Request Submitted!',
                        "We've received your request",
                        { start: '#0ea5e9', end: '#0284c7', text: '#e0f2fe' },
                        '📋'
                    )}
                    
                    <tr>
                        <td style="padding: 40px;">
                            <p style="font-size: 20px; color: #0c4a6e; margin: 0 0 25px 0; font-weight: 600;">
                                Hello ${data.clientName || 'Valued Customer'},
                            </p>
                            
                            <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 12px; padding: 25px; margin: 25px 0; border: 1px solid #bae6fd;">
                                <h2 style="color: #0c4a6e; margin: 0 0 15px 0; font-size: 22px;">📝 Booking Details</h2>
                                <p style="font-size: 18px; color: #0369a1; margin: 0; line-height: 1.6;">
                                    <strong>Service:</strong> ${data.serviceName || 'Not specified'}<br>
                                    <strong>Status:</strong> <span style="background-color: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 600;">Under Review</span>
                                </p>
                            </div>
                            
                            <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
                                <h3 style="color: #92400e; margin: 0 0 10px 0; font-size: 18px;">⏰ What happens next?</h3>
                                <ul style="color: #b45309; margin: 0; padding-left: 20px; line-height: 1.6;">
                                    <li>Our team will review your request shortly</li>
                                    <li>You'll receive a confirmation email once approved</li>
                                    <li>We'll contact you if any additional information is needed</li>
                                </ul>
                            </div>
                            
                            <p style="font-size: 16px; color: #475569; margin: 30px 0 0 0; line-height: 1.6;">
                                Thank you for choosing <strong>Tanish Physio</strong>. We're excited to assist you with your healthcare journey!
                            </p>
                        </td>
                    </tr>
                    
                    ${EmailTemplates.generateFooter(
                        '#0c4a6e',
                        { light: '#bae6fd', accent: '#7dd3fc', border: '#1e5a8a' },
                        'Questions? Contact our support team'
                    )}
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `;
    }

    // Template 3: Booking Confirmed
    static bookingConfirmed(data) {
        const isPaymentPending = data.paymentStatus === 'pending';
        
        // Format date properly
        const formattedDate = data.date ? 
            new Date(data.date).toLocaleDateString('en-IN', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }) : 'Not specified';
        
        const formattedTime = data.time || 'Not specified';

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Booking Confirmed</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #dcfce7;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #dcfce7; padding: 20px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 8px 25px rgba(0,0,0,0.1); overflow: hidden; border: 1px solid #bbf7d0;">
                    ${EmailTemplates.generateHeader(
                        'Booking Confirmed!',
                        'Your appointment is secured',
                        { start: '#16a34a', end: '#15803d', text: '#dcfce7' },
                        '🎉'
                    )}
                    
                    <tr>
                        <td style="padding: 40px;">
                            <p style="font-size: 20px; color: #14532d; margin: 0 0 25px 0; font-weight: 600;">
                                Congratulations ${data.clientName || 'Valued Customer'},
                            </p>
                            
                            <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 12px; padding: 25px; margin: 25px 0; border: 1px solid #bbf7d0;">
                                <h2 style="color: #14532d; margin: 0 0 20px 0; font-size: 24px;">📅 Appointment Details</h2>
                                
                                <div style="display: grid; grid-template-columns: auto 1fr; gap: 15px; align-items: center;">
                                    <div style="background-color: #16a34a; color: white; padding: 12px; border-radius: 8px; text-align: center; min-width: 100px;">
                                        <div style="font-size: 24px; font-weight: bold;">${new Date(data.date).getDate()}</div>
                                        <div style="font-size: 14px;">${new Date(data.date).toLocaleDateString('en-US', {month: 'short'})}</div>
                                    </div>
                                    <div>
                                        <p style="font-size: 18px; color: #15803d; margin: 0; line-height: 1.5;">
                                            <strong>Service:</strong> ${data.serviceName || 'Not specified'}<br>
                                            <strong>Date:</strong> ${formattedDate}<br>
                                            <strong>Time:</strong> ${formattedTime}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            
                            ${isPaymentPending ? `
                            <div style="background-color: #fff7ed; border-left: 4px solid #f97316; padding: 25px; margin: 25px 0; border-radius: 0 12px 12px 0;">
                                <h3 style="color: #c2410c; margin: 0 0 15px 0; font-size: 20px;">💳 Payment Required</h3>
                                <p style="color: #ea580c; margin: 0 0 15px 0; font-size: 16px; line-height: 1.6;">
                                    <strong>Action Required:</strong> Please complete your payment to secure this appointment.
                                </p>
                                <a href="${data.paymentLink || '#'}" style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; text-decoration: none; padding: 12px 25px; border-radius: 8px; font-weight: 600; display: inline-block;">Complete Payment Now</a>
                            </div>
                            ` : `
                            <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 25px; margin: 25px 0; border-radius: 0 12px 12px 0;">
                                <h3 style="color: #15803d; margin: 0 0 15px 0; font-size: 20px;">✅ Payment Confirmed</h3>
                                <p style="color: #16a34a; margin: 0; font-size: 16px; line-height: 1.6;">
                                    <strong>Great News:</strong> Your payment has been received and your session is fully confirmed!
                                </p>
                            </div>
                            `}
                            
                            <div style="background-color: #eff6ff; border-radius: 12px; padding: 20px; margin: 25px 0; border: 1px solid #dbeafe;">
                                <h3 style="color: #1e40af; margin: 0 0 15px 0; font-size: 18px;">💡 Helpful Tips</h3>
                                <ul style="color: #1e3a8a; margin: 0; padding-left: 20px; line-height: 1.6;">
                                    <li>Please arrive 10-15 minutes early for your appointment</li>
                                    <li>Bring any relevant medical documents or reports</li>
                                    <li>Contact us if you need to reschedule</li>
                                </ul>
                            </div>
                            
                            <p style="font-size: 16px; color: #475569; margin: 30px 0 0 0; line-height: 1.6;">
                                We're looking forward to helping you achieve your health goals. <strong>Tanish Physio</strong> is committed to providing you with exceptional care!
                            </p>
                        </td>
                    </tr>
                    
                    ${EmailTemplates.generateFooter(
                        '#14532d',
                        { light: '#bbf7d0', accent: '#86efac', border: '#166534' },
                        'Need to make changes to your appointment?'
                    )}
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `;
    }

    // Template 4: Booking Cancelled
    static bookingCancelled(data) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Booking Cancelled</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #fef2f2;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef2f2; padding: 20px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 8px 25px rgba(0,0,0,0.1); overflow: hidden; border: 1px solid #fecaca;">
                    ${EmailTemplates.generateHeader(
                        'Booking Cancelled',
                        'We sincerely apologize',
                        { start: '#dc2626', end: '#b91c1c', text: '#fecaca' },
                        '⚠️'
                    )}
                    
                    <tr>
                        <td style="padding: 40px;">
                            <p style="font-size: 20px; color: #7f1d1d; margin: 0 0 25px 0; font-weight: 600;">
                                Dear ${data.clientName || 'Valued Customer'},
                            </p>
                            
                            <div style="background: linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%); border-radius: 12px; padding: 25px; margin: 25px 0; border: 1px solid #fecaca;">
                                <h2 style="color: #7f1d1d; margin: 0 0 15px 0; font-size: 22px;">📋 Cancellation Details</h2>
                                <p style="font-size: 18px; color: #b91c1c; margin: 0; line-height: 1.6;">
                                    <strong>Service:</strong> ${data.serviceName || 'Not specified'}<br>
                                    ${data.reason ? `<strong>Reason:</strong> ${data.reason}<br>` : ''}
                                    <strong>Status:</strong> <span style="background-color: #fee2e2; color: #b91c1c; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 600;">Cancelled</span>
                                </p>
                            </div>
                            
                            ${data.paymentStatus === 'paid' ? `
                            <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 25px; margin: 25px 0; border-radius: 0 12px 12px 0;">
                                <h3 style="color: #047857; margin: 0 0 15px 0; font-size: 20px;">💰 Refund Processing</h3>
                                <p style="color: #059669; margin: 0; font-size: 16px; line-height: 1.6;">
                                    <strong>Good News:</strong> A refund will be automatically processed to your original payment method within 5-7 business days.
                                </p>
                            </div>
                            ` : ``}
                            
                            <div style="background-color: #eff6ff; border-radius: 12px; padding: 25px; margin: 25px 0; border: 1px solid #dbeafe;">
                                <h3 style="color: #1e3a8a; margin: 0 0 15px 0; font-size: 20px;">🔄 What's Next?</h3>
                                <ul style="color: #1e40af; margin: 0; padding-left: 20px; line-height: 1.6;">
                                    <li>You can book a new appointment at your convenience</li>
                                    <li>Our team is available to assist with rescheduling</li>
                                    <li>Contact us for any questions about this cancellation</li>
                                </ul>
                                <div style="margin-top: 20px; text-align: center;">
                                    <a href="#" style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; text-decoration: none; padding: 12px 25px; border-radius: 8px; font-weight: 600; display: inline-block;">Book New Appointment</a>
                                </div>
                            </div>
                            
                            <p style="font-size: 16px; color: #64748b; margin: 30px 0 0 0; line-height: 1.6;">
                                We truly value your trust in <strong>Tanish Physio</strong> and apologize for any inconvenience this cancellation may have caused. Our team is here to support you every step of the way.
                            </p>
                        </td>
                    </tr>
                    
                    ${EmailTemplates.generateFooter(
                        '#7f1d1d',
                        { light: '#fecaca', accent: '#fca5a5', border: '#991b1b' },
                        'Need immediate assistance?'
                    )}
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `;
    }

    /* DISABLED: // Template 5: Payment Reminder
    static paymentReminder(data) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Reminder</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #fffbeb;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fffbeb; padding: 20px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 8px 25px rgba(0,0,0,0.1); overflow: hidden; border: 1px solid #fed7aa;">
                    ${EmailTemplates.generateHeader(
                        'Payment Reminder',
                        'Secure your appointment today',
                        { start: '#f59e0b', end: '#d97706', text: '#fed7aa' },
                        '🔔'
                    )}
                    
                    <tr>
                        <td style="padding: 40px;">
                            <p style="font-size: 20px; color: #92400e; margin: 0 0 25px 0; font-weight: 600;">
                                Hello ${data.clientName || 'Valued Customer'},
                            </p>
                            
                            <div style="background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%); border-radius: 12px; padding: 25px; margin: 25px 0; border: 1px solid #fed7aa;">
                                <h2 style="color: #92400e; margin: 0 0 20px 0; font-size: 22px;">💳 Payment Details</h2>
                                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
                                    <div>
                                        <p style="font-size: 18px; color: #c2410c; margin: 0; line-height: 1.6;">
                                            <strong>Service:</strong> ${data.serviceName || 'Not specified'}<br>
                                            <strong>Amount Due:</strong> <span style="font-size: 24px; font-weight: 700; color: #d97706;">₹${data.amount || '0'}</span>
                                        </p>
                                    </div>
                                    <div>
                                        <a href="${data.paymentLink || '#'}" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 10px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.3);">Pay Now</a>
                                    </div>
                                </div>
                            </div>
                            
                            <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 25px; margin: 25px 0; border-radius: 0 12px 12px 0;">
                                <h3 style="color: #1e40af; margin: 0 0 15px 0; font-size: 20px;">⏰ Important</h3>
                                <ul style="color: #1e3a8a; margin: 0; padding-left: 20px; line-height: 1.6;">
                                    <li>Your appointment is pending confirmation until payment is completed</li>
                                    <li>Complete payment within 24 hours to secure your slot</li>
                                    <li>Unpaid bookings may be cancelled automatically</li>
                                </ul>
                            </div>
                            
                            <div style="background-color: #f0fdf4; border-radius: 12px; padding: 20px; margin: 25px 0; border: 1px solid #bbf7d0; text-align: center;">
                                <h3 style="color: #15803d; margin: 0 0 15px 0; font-size: 18px;">🔒 Secure Payment</h3>
                                <p style="color: #16a34a; margin: 0; font-size: 16px; line-height: 1.6;">
                                    Your payment is processed securely through our encrypted payment gateway. All transactions are protected.
                                </p>
                            </div>
                            
                            <p style="font-size: 16px; color: #64748b; margin: 30px 0 0 0; line-height: 1.6;">
                                Thank you for choosing <strong>Tanish Physio</strong>. We're committed to providing you with exceptional healthcare services.
                            </p>
                        </td>
                    </tr>
                    
                    ${EmailTemplates.generateFooter(
                        '#92400e',
                        { light: '#fed7aa', accent: '#fdba74', border: '#c2410c' },
                        'Having trouble with payment?'
                    )}
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `;
    } */

    // Template 6: Payment Success
    static paymentSuccess(data) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Successful</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0fdf4;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; padding: 20px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 8px 25px rgba(0,0,0,0.1); overflow: hidden; border: 1px solid #bbf7d0;">
                    ${EmailTemplates.generateHeader(
                        'Payment Successful!',
                        'Transaction confirmed',
                        { start: '#16a34a', end: '#15803d', text: '#dcfce7' },
                        '✅'
                    )}
                    
                    <tr>
                        <td style="padding: 40px;">
                            <p style="font-size: 20px; color: #14532d; margin: 0 0 25px 0; font-weight: 600;">
                                Thank you ${data.clientName || 'Valued Customer'},
                            </p>
                            
                            <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 12px; padding: 25px; margin: 25px 0; border: 1px solid #bbf7d0; text-align: center;">
                                <h2 style="color: #14532d; margin: 0 0 20px 0; font-size: 24px;">💰 Payment Confirmation</h2>
                                
                                <div style="background-color: white; border-radius: 12px; padding: 25px; margin: 15px 0; box-shadow: 0 4px 15px rgba(0,0,0,0.08); display: inline-block; min-width: 300px;">
                                    <div style="font-size: 36px; font-weight: 700; color: #16a34a; margin-bottom: 10px;">₹${data.amount || '0'}</div>
                                    <div style="font-size: 16px; color: #4b5563;">Amount Paid</div>
                                </div>
                                
                                <div style="margin: 20px 0;">
                                    <p style="font-size: 18px; color: #15803d; margin: 10px 0;">
                                        <strong>Service:</strong> ${data.serviceName || 'Not specified'}
                                    </p>
                                    <p style="font-size: 16px; color: #059669; margin: 10px 0; background-color: #ecfdf5; padding: 10px; border-radius: 8px; display: inline-block;">
                                        <strong>Transaction ID:</strong> ${data.transactionId || 'N/A'}
                                    </p>
                                </div>
                            </div>
                            
                            <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 25px; margin: 25px 0; border-radius: 0 12px 12px 0;">
                                <h3 style="color: #1e40af; margin: 0 0 15px 0; font-size: 20px;">📅 Next Steps</h3>
                                <ul style="color: #1e3a8a; margin: 0; padding-left: 20px; line-height: 1.6;">
                                    <li>Your appointment is now fully confirmed</li>
                                    <li>You'll receive a calendar invitation shortly</li>
                                    <li>Prepare any relevant medical documents before your session</li>
                                    <li>Arrive 10-15 minutes early for your appointment</li>
                                </ul>
                            </div>
                        
                            <p style="font-size: 16px; color: #475569; margin: 30px 0 0 0; line-height: 1.6;">
                                We're grateful for your trust in <strong>Tanish Physio</strong>. Our team is dedicated to providing you with the highest quality healthcare services and personalized attention.
                            </p>
                        </td>
                    </tr>
                    
                    ${EmailTemplates.generateFooter(
                        '#14532d',
                        { light: '#bbf7d0', accent: '#86efac', border: '#166534' },
                        'Have questions about your payment or appointment?'
                    )}
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `;
    }

    // Template 7: Session Reminder
    static sessionReminder(data) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Session Reminder</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #e0f2fe;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #e0f2fe; padding: 20px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 8px 25px rgba(0,0,0,0.1); overflow: hidden; border: 1px solid #bae6fd;">
                    ${EmailTemplates.generateHeader(
                        'Session Reminder',
                        'Your appointment is coming up',
                        { start: '#0284c7', end: '#0369a1', text: '#bae6fd' },
                        '⏰'
                    )}
                    
                    <tr>
                        <td style="padding: 40px;">
                            <p style="font-size: 20px; color: #083344; margin: 0 0 25px 0; font-weight: 600;">
                                Hello ${data.clientName || 'Valued Patient'},
                            </p>
                            
                            <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 12px; padding: 25px; margin: 25px 0; border: 1px solid #bae6fd;">
                                <h2 style="color: #083344; margin: 0 0 20px 0; font-size: 24px;">📅 Upcoming Session</h2>
                                
                                <div style="display: grid; gap: 15px;">
                                    <div style="display: flex; align-items: center; gap: 15px; padding: 15px; background-color: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                                        <div style="background-color: #0284c7; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                                            📋
                                        </div>
                                        <div>
                                            <div style="font-weight: 600; color: #083344;">${data.serviceName || 'Service'}</div>
                                            <div style="font-size: 14px; color: #0369a1;">Service</div>
                                        </div>
                                    </div>
                                    
                                    <div style="display: flex; align-items: center; gap: 15px; padding: 15px; background-color: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                                        <div style="background-color: #0ea5e9; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                                            👤
                                        </div>
                                        <div>
                                            <div style="font-weight: 600; color: #083344;">${data.therapistName || 'Therapist'}</div>
                                            <div style="font-size: 14px; color: #0369a1;">Your Therapist</div>
                                        </div>
                                    </div>
                                    
                                    <div style="display: flex; align-items: center; gap: 15px; padding: 15px; background-color: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                                        <div style="background-color: #3b82f6; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                                            📅
                                        </div>
                                        <div>
                                            <div style="font-weight: 600; color: #083344;">${data.date || 'Date'}</div>
                                            <div style="font-size: 14px; color: #0369a1;">Date</div>
                                        </div>
                                    </div>
                                    
                                    <div style="display: flex; align-items: center; gap: 15px; padding: 15px; background-color: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                                        <div style="background-color: #6366f1; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                                            ⏰
                                        </div>
                                        <div>
                                            <div style="font-weight: 600; color: #083344;">${data.time || 'Time'}</div>
                                            <div style="font-size: 14px; color: #0369a1;">Time</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            ${data.meetLink ? `
                            <div style="background-color: #f5f3ff; border-left: 4px solid #8b5cf6; padding: 25px; margin: 25px 0; border-radius: 0 12px 12px 0; text-align: center;">
                                <h3 style="color: #5b21b6; margin: 0 0 15px 0; font-size: 20px;">🔗 Join Session</h3>
                                <p style="color: #6d28d9; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">
                                    Your virtual session link is ready. Click below to join:
                                </p>
                                <a href="${data.meetLink}" style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 10px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3);">Join Session Now</a>
                                <p style="color: #7c3aed; margin: 15px 0 0 0; font-size: 14px;">
                                    Please join 5-10 minutes before the scheduled time
                                </p>
                            </div>
                            ` : ``}
                            
                            <div style="background-color: #fffbeb; border-radius: 12px; padding: 20px; margin: 25px 0; border: 1px solid #fed7aa;">
                                <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 18px;">💡 Preparation Tips</h3>
                                <ul style="color: #c2410c; margin: 0; padding-left: 20px; line-height: 1.6;">
                                    <li>Find a quiet, comfortable space for your session</li>
                                    <li>Have water nearby and ensure good lighting</li>
                                    <li>Prepare any questions or concerns you'd like to discuss</li>
                                    <li>Test your audio/video equipment beforehand</li>
                                </ul>
                            </div>
                            
                            <p style="font-size: 16px; color: #475569; margin: 30px 0 0 0; line-height: 1.6;">
                                Looking forward to seeing you at your session. <strong>Tanish Physio</strong> is committed to supporting your health and wellness journey.
                            </p>
                        </td>
                    </tr>
                    
                    ${EmailTemplates.generateFooter(
                        '#083344',
                        { light: '#bae6fd', accent: '#7dd3fc', border: '#0c4a6e' },
                        'Need to reschedule or have questions?'
                    )}
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `;
    }

    // Template 8: Admin - New Booking Request
    static adminNewBooking(data) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Booking Request - Admin</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #eff6ff;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #eff6ff; padding: 20px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 8px 25px rgba(0,0,0,0.1); overflow: hidden; border: 1px solid #dbeafe;">
                    ${EmailTemplates.generateHeader(
                        'New Booking Request',
                        'Action required',
                        { start: '#2563eb', end: '#1d4ed8', text: '#dbeafe' },
                        '🔔'
                    )}
                    
                    <tr>
                        <td style="padding: 40px;">
                            <p style="font-size: 20px; color: #1e3a8a; margin: 0 0 25px 0; font-weight: 600;">
                                Team,
                            </p>
                            
                            <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 12px; padding: 25px; margin: 25px 0; border: 1px solid #bae6fd;">
                                <h2 style="color: #1e3a8a; margin: 0 0 20px 0; font-size: 24px;">📋 Booking Details</h2>
                                
                                <div style="display: grid; gap: 15px;">
                                    <div style="display: flex; align-items: center; gap: 15px; padding: 15px; background-color: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                                        <div style="background-color: #2563eb; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                                            👤
                                        </div>
                                        <div>
                                            <div style="font-weight: 600; color: #1e3a8a;">${data.clientName || 'Client Name'}</div>
                                            <div style="font-size: 14px; color: #3b82f6;">Client</div>
                                        </div>
                                    </div>
                                    
                                    <div style="display: flex; align-items: center; gap: 15px; padding: 15px; background-color: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                                        <div style="background-color: #0ea5e9; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                                            📋
                                        </div>
                                        <div>
                                            <div style="font-weight: 600; color: #1e3a8a;">${data.serviceName || 'Service Name'}</div>
                                            <div style="font-size: 14px; color: #3b82f6;">Service Requested</div>
                                        </div>
                                    </div>
                                    
                                    <div style="display: flex; align-items: center; gap: 15px; padding: 15px; background-color: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                                        <div style="background-color: #f59e0b; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                                            ⏰
                                        </div>
                                        <div>
                                            <div style="font-weight: 600; color: #1e3a8a;">${new Date().toLocaleString()}</div>
                                            <div style="font-size: 14px; color: #3b82f6;">Request Time</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 25px; margin: 25px 0; border-radius: 0 12px 12px 0;">
                                <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 20px;">⚡ Action Required</h3>
                                <ul style="color: #c2410c; margin: 0; padding-left: 20px; line-height: 1.6;">
                                    <li>Review the booking request details</li>
                                    <li>Verify client information and service requirements</li>
                                    <li>Confirm or reject the booking within 24 hours</li>
                                    <li>Notify the client of your decision</li>
                                </ul>
                                <div style="margin-top: 20px; text-align: center;">
                                    <a href="#" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; text-decoration: none; padding: 12px 25px; border-radius: 8px; font-weight: 600; display: inline-block;">Review Booking</a>
                                </div>
                            </div>
                            
                            <div style="background-color: #f0fdf4; border-radius: 12px; padding: 20px; margin: 25px 0; border: 1px solid #bbf7d0;">
                                <h3 style="color: #15803d; margin: 0 0 15px 0; font-size: 18px;">📊 System Status</h3>
                                <p style="color: #16a34a; margin: 0; font-size: 16px; line-height: 1.6;">
                                    This notification was automatically generated. Please process this request promptly to maintain excellent customer service standards.
                                </p>
                            </div>
                            
                            <p style="font-size: 16px; color: #475569; margin: 30px 0 0 0; line-height: 1.6;">
                                Thank you for your attention to this matter. Your prompt response helps us provide exceptional service to our clients.
                            </p>
                        </td>
                    </tr>
                    
                    ${EmailTemplates.generateFooter(
                        '#1e3a8a',
                        { light: '#dbeafe', accent: '#a5b4fc', border: '#3730a3' },
                        'Tanish Physio Administration System'
                    )}
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `;
    }

    // Template 9: Admin - Payment Received
    static adminPaymentReceived(data) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Received - Admin</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #dcfce7;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #dcfce7; padding: 20px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 8px 25px rgba(0,0,0,0.1); overflow: hidden; border: 1px solid #bbf7d0;">
                    ${EmailTemplates.generateHeader(
                        'Payment Received',
                        'Transaction confirmed',
                        { start: '#16a34a', end: '#15803d', text: '#dcfce7' },
                        '💰'
                    )}
                    
                    <tr>
                        <td style="padding: 40px;">
                            <p style="font-size: 20px; color: #14532d; margin: 0 0 25px 0; font-weight: 600;">
                                Financial Team,
                            </p>
                            
                            <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 12px; padding: 25px; margin: 25px 0; border: 1px solid #bbf7d0; text-align: center;">
                                <h2 style="color: #14532d; margin: 0 0 20px 0; font-size: 24px;">💳 Transaction Details</h2>
                                
                                <div style="background-color: white; border-radius: 12px; padding: 25px; margin: 15px 0; box-shadow: 0 4px 15px rgba(0,0,0,0.08); display: inline-block; min-width: 300px;">
                                    <div style="font-size: 36px; font-weight: 700; color: #16a34a; margin-bottom: 10px;">₹${data.amount || '0'}</div>
                                    <div style="font-size: 16px; color: #4b5563;">Amount Received</div>
                                </div>
                                
                                <div style="margin: 20px 0; text-align: left; display: inline-block; min-width: 300px;">
                                    <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 12px; background-color: #f0fdf4; border-radius: 8px;">
                                        <span style="color: #15803d; font-weight: 500;">Service:</span>
                                        <span style="color: #14532d; font-weight: 600;">${data.serviceName || 'Not specified'}</span>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 12px; background-color: #f0fdf4; border-radius: 8px;">
                                        <span style="color: #15803d; font-weight: 500;">Client:</span>
                                        <span style="color: #14532d; font-weight: 600;">${data.clientName || 'Not specified'}</span>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 12px; background-color: #f0fdf4; border-radius: 8px;">
                                        <span style="color: #15803d; font-weight: 500;">Transaction ID:</span>
                                        <span style="color: #14532d; font-weight: 600; font-family: monospace;">${data.transactionId || 'N/A'}</span>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 12px; background-color: #f0fdf4; border-radius: 8px;">
                                        <span style="color: #15803d; font-weight: 500;">Date/Time:</span>
                                        <span style="color: #14532d; font-weight: 600;">${new Date().toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 25px; margin: 25px 0; border-radius: 0 12px 12px 0;">
                                <h3 style="color: #1e40af; margin: 0 0 15px 0; font-size: 20px;">📊 Next Steps</h3>
                                <ul style="color: #1e3a8a; margin: 0; padding-left: 20px; line-height: 1.6;">
                                    <li>Update client's payment status in the system</li>
                                    <li>Send payment confirmation to the client</li>
                                    <li>Confirm appointment scheduling if applicable</li>
                                    <li>File transaction for accounting purposes</li>
                                </ul>
                            </div>
                            
                            <div style="background-color: #fff7ed; border-radius: 12px; padding: 20px; margin: 25px 0; border: 1px solid #fed7aa; text-align: center;">
                                <h3 style="color: #c2410c; margin: 0 0 15px 0; font-size: 18px;">📈 Financial Summary</h3>
                                <p style="color: #ea580c; margin: 0; font-size: 16px; line-height: 1.6;">
                                    This payment contributes to today's revenue. Please ensure all financial records are updated accordingly.
                                </p>
                            </div>
                            
                            <p style="font-size: 16px; color: #475569; margin: 30px 0 0 0; line-height: 1.6;">
                                This automated notification ensures timely processing of financial transactions and maintains accurate records for accounting purposes.
                            </p>
                        </td>
                    </tr>
                    
                    ${EmailTemplates.generateFooter(
                        '#14532d',
                        { light: '#bbf7d0', accent: '#86efac', border: '#166534' },
                        'Tanish Physio Financial Management'
                    )}
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `;
    }

    // Template 10: Appointment Rescheduled
    static appointmentRescheduled(data) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Appointment Rescheduled</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #fffbeb;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fffbeb; padding: 20px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 8px 25px rgba(0,0,0,0.1); overflow: hidden; border: 1px solid #fed7aa;">
                    ${EmailTemplates.generateHeader(
            'Appointment Rescheduled',
            'Your session has been moved',
            { start: '#f59e0b', end: '#d97706', text: '#fed7aa' },
            '📅'
        )}
                    
                    <tr>
                        <td style="padding: 40px;">
                            <p style="font-size: 20px; color: #92400e; margin: 0 0 25px 0; font-weight: 600;">
                                Hello ${data.clientName || 'Valued Patient'},
                            </p>
                            
                            <div style="background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%); border-radius: 12px; padding: 25px; margin: 25px 0; border: 1px solid #fed7aa;">
                                <h2 style="color: #92400e; margin: 0 0 20px 0; font-size: 24px;">📋 Rescheduled Session Details</h2>
                                
                                <div style="display: grid; gap: 20px;">
                                    <div style="display: flex; align-items: center; gap: 15px; padding: 15px; background-color: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                                        <div style="background-color: #f59e0b; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                                            📋
                                        </div>
                                        <div>
                                            <div style="font-weight: 600; color: #92400e;">${data.serviceName || 'Service'}</div>
                                            <div style="font-size: 14px; color: #c2410c;">Service</div>
                                        </div>
                                    </div>
                                    
                                    <div style="display: flex; align-items: center; gap: 15px; padding: 15px; background-color: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                                        <div style="background-color: #0ea5e9; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                                            📅
                                        </div>
                                        <div>
                                            <div style="font-weight: 600; color: #92400e;">${data.newDate || 'New Date'}</div>
                                            <div style="font-size: 14px; color: #c2410c;">New Date</div>
                                        </div>
                                    </div>
                                    
                                    <div style="display: flex; align-items: center; gap: 15px; padding: 15px; background-color: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                                        <div style="background-color: #6366f1; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                                            ⏰
                                        </div>
                                        <div>
                                            <div style="font-weight: 600; color: #92400e;">${data.newTime || 'New Time'}</div>
                                            <div style="font-size: 14px; color: #c2410c;">New Time</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 25px; margin: 25px 0; border-radius: 0 12px 12px 0;">
                                <h3 style="color: #1e40af; margin: 0 0 15px 0; font-size: 20px;">💡 What Changed</h3>
                                <ul style="color: #1e3a8a; margin: 0; padding-left: 20px; line-height: 1.6;">
                                    <li>Your original appointment on ${data.oldDate || 'previous date'} at ${data.oldTime || 'previous time'} has been moved</li>
                                    <li>Your new session is scheduled as shown above</li>
                                    <li>All your session details and therapist remain the same</li>
                                </ul>
                            </div>
                            
                            ${data.newMeetingLink ? `
                            <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 25px; margin: 25px 0; border-radius: 0 12px 12px 0; text-align: center;">
                                <h3 style="color: #15803d; margin: 0 0 15px 0; font-size: 20px;">🔗 Updated Session Link</h3>
                                <p style="color: #16a34a; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">
                                    Your updated virtual session link is ready:
                                </p>
                                <a href="${data.newMeetingLink}" style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: white; text-decoration: none; padding: 12px 25px; border-radius: 8px; font-weight: 600; display: inline-block;">Join Updated Session</a>
                            </div>
                            ` : ``}
                            
                            <div style="background-color: #fff7ed; border-radius: 12px; padding: 20px; margin: 25px 0; border: 1px solid #fed7aa;">
                                <h3 style="color: #c2410c; margin: 0 0 15px 0; font-size: 18px;">⚠️ Important Notes</h3>
                                <ul style="color: #ea580c; margin: 0; padding-left: 20px; line-height: 1.6;">
                                    <li>Please update your calendar with the new date and time</li>
                                    <li>Arrive 10-15 minutes early for your rescheduled session</li>
                                    <li>Contact us if you cannot make the new time slot</li>
                                </ul>
                            </div>
                            
                            <p style="font-size: 16px; color: #475569; margin: 30px 0 0 0; line-height: 1.6;">
                                We apologize for any inconvenience this rescheduling may have caused. <strong>Tanish Physio</strong> is committed to providing you with the best possible care and appreciate your understanding.
                            </p>
                        </td>
                    </tr>
                    
                    ${EmailTemplates.generateFooter(
            '#92400e',
            { light: '#fed7aa', accent: '#fdba74', border: '#c2410c' },
            'Need to make further changes?'
        )}
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `;
    }

    // Template 11: Admin - Upcoming Session
    static adminUpcomingSession(data) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Upcoming Session - Admin</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #e0f2fe;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #e0f2fe; padding: 20px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 8px 25px rgba(0,0,0,0.1); overflow: hidden; border: 1px solid #bae6fd;">
                    ${EmailTemplates.generateHeader(
                        'Upcoming Session',
                        'Scheduled for tomorrow',
                        { start: '#0284c7', end: '#0369a1', text: '#bae6fd' },
                        '📅'
                    )}
                    
                    <tr>
                        <td style="padding: 40px;">
                            <p style="font-size: 20px; color: #083344; margin: 0 0 25px 0; font-weight: 600;">
                                Team,
                            </p>
                            
                            <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 12px; padding: 25px; margin: 25px 0; border: 1px solid #bae6fd;">
                                <h2 style="color: #083344; margin: 0 0 20px 0; font-size: 24px;">📋 Session Overview</h2>
                                
                                <div style="display: grid; gap: 15px;">
                                    <div style="display: flex; align-items: center; gap: 15px; padding: 15px; background-color: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                                        <div style="background-color: #0284c7; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                                            👤
                                        </div>
                                        <div>
                                            <div style="font-weight: 600; color: #083344;">${data.clientName || 'Client Name'}</div>
                                            <div style="font-size: 14px; color: #0369a1;">Client</div>
                                        </div>
                                    </div>
                                    
                                    <div style="display: flex; align-items: center; gap: 15px; padding: 15px; background-color: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                                        <div style="background-color: #0ea5e9; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                                            📋
                                        </div>
                                        <div>
                                            <div style="font-weight: 600; color: #083344;">${data.serviceName || 'Service Name'}</div>
                                            <div style="font-size: 14px; color: #0369a1;">Service</div>
                                        </div>
                                    </div>
                                    
                                    <div style="display: flex; align-items: center; gap: 15px; padding: 15px; background-color: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                                        <div style="background-color: #3b82f6; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                                            👨‍⚕️
                                        </div>
                                        <div>
                                            <div style="font-weight: 600; color: #083344;">${data.therapistName || 'Therapist Name'}</div>
                                            <div style="font-size: 14px; color: #0369a1;">Assigned Therapist</div>
                                        </div>
                                    </div>
                                    
                                    <div style="display: flex; align-items: center; gap: 15px; padding: 15px; background-color: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                                        <div style="background-color: #6366f1; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                                            ⏰
                                        </div>
                                        <div>
                                            <div style="font-weight: 600; color: #083344;">${data.time || 'Time'}</div>
                                            <div style="font-size: 14px; color: #0369a1;">Scheduled Time</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 25px; margin: 25px 0; border-radius: 0 12px 12px 0;">
                                <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 20px;">⚡ Pre-Session Checklist</h3>
                                <ul style="color: #c2410c; margin: 0; padding-left: 20px; line-height: 1.6;">
                                    <li>Confirm therapist availability for the scheduled time</li>
                                    <li>Verify client contact information is up to date</li>
                                    <li>Ensure all necessary equipment and resources are ready</li>
                                    <li>Review client history and prepare session notes</li>
                                    <li>Send reminder notification to client if not already sent</li>
                                </ul>
                            </div>
                            
                            <div style="background-color: #f0fdf4; border-radius: 12px; padding: 20px; margin: 25px 0; border: 1px solid #bbf7d0; text-align: center;">
                                <h3 style="color: #15803d; margin: 0 0 15px 0; font-size: 18px;">📊 System Status</h3>
                                <p style="color: #16a34a; margin: 0; font-size: 16px; line-height: 1.6;">
                                    This is an automated reminder to ensure smooth session delivery and optimal client experience.
                                </p>
                            </div>
                            
                            <p style="font-size: 16px; color: #475569; margin: 30px 0 0 0; line-height: 1.6;">
                                Please ensure all preparations are complete to provide our clients with the exceptional care they deserve. Thank you for your dedication to excellence.
                            </p>
                        </td>
                    </tr>
                    
                    ${EmailTemplates.generateFooter(
                        '#083344',
                        { light: '#bae6fd', accent: '#7dd3fc', border: '#0c4a6e' },
                        'Tanish Physio Operations Management'
                    )}
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `;
    }
}

module.exports = EmailTemplates;

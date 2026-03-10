// Session Reminder Templates for Email and WhatsApp
const EmailTemplates = require('./emailTemplates');

class SessionReminderTemplates {
    // Session Reminder (24 hours before)
    static sessionReminder24hEmail(data) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Session Reminder - 24 Hours</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #e0f2fe;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #e0f2fe; padding: 20px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 8px 25px rgba(0,0,0,0.1); overflow: hidden; border: 1px solid #bae6fd;">
                    ${EmailTemplates.generateHeader(
                        'Session Reminder - 24 Hours',
                        'Your appointment is coming up tomorrow',
                        { start: '#0284c7', end: '#0369a1', text: '#bae6fd' },
                        '⏰'
                    )}
                    
                    <tr>
                        <td style="padding: 40px;">
                            <p style="font-size: 20px; color: #083344; margin: 0 0 25px 0; font-weight: 600;">
                                Hello ${data.clientName || 'Valued Patient'},
                            </p>
                            
                            <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 12px; padding: 25px; margin: 25px 0; border: 1px solid #bae6fd;">
                                <h2 style="color: #083344; margin: 0 0 20px 0; font-size: 24px;">📅 Upcoming Session Tomorrow</h2>
                                
                                <div style="display: grid; gap: 15px;">
                                    <div style="display: flex; align-items: center; gap: 15px; padding: 15px; background-color: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                                        <div style="background-color: #0284c7; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 20px;">
                                            📋
                                        </div>
                                        <div>
                                            <div style="font-weight: 600; color: #083344; font-size: 16px;">${data.serviceName || 'Service'}</div>
                                            <div style="font-size: 13px; color: #0369a1;">Service</div>
                                        </div>
                                    </div>
                                    
                                    <div style="display: flex; align-items: center; gap: 15px; padding: 15px; background-color: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                                        <div style="background-color: #0ea5e9; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 20px;">
                                            🗓️
                                        </div>
                                        <div>
                                            <div style="font-weight: 600; color: #083344; font-size: 16px;">${data.date || 'TBD'}</div>
                                            <div style="font-size: 13px; color: #0369a1;">Date</div>
                                        </div>
                                    </div>
                                    
                                    <div style="display: flex; align-items: center; gap: 15px; padding: 15px; background-color: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                                        <div style="background-color: #38bdf8; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 20px;">
                                            ⏰
                                        </div>
                                        <div>
                                            <div style="font-weight: 600; color: #083344; font-size: 16px;">${data.time || 'TBD'}</div>
                                            <div style="font-size: 13px; color: #0369a1;">Time</div>
                                        </div>
                                    </div>
                                    
                                    <div style="display: flex; align-items: center; gap: 15px; padding: 15px; background-color: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                                        <div style="background-color: #0284c7; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 20px;">
                                            👨‍⚕️
                                        </div>
                                        <div>
                                            <div style="font-weight: 600; color: #083344; font-size: 16px;">${data.therapistName || 'Therapist'}</div>
                                            <div style="font-size: 13px; color: #0369a1;">Your Therapist</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div style="background-color: #f0fdf4; border-radius: 12px; padding: 20px; margin: 25px 0; border: 1px solid #bbf7d0;">
                                <h3 style="color: #15803d; margin: 0 0 15px 0; font-size: 18px;">📋 Preparation Tips</h3>
                                <ul style="color: #16a34a; margin: 0; padding-left: 20px; line-height: 1.8;">
                                    <li style="margin-bottom: 8px;">Ensure you have a stable internet connection</li>
                                    <li style="margin-bottom: 8px;">Find a quiet, comfortable space for your session</li>
                                    <li style="margin-bottom: 8px;">Have any relevant medical documents ready</li>
                                    <li style="margin-bottom: 8px;">Test your camera and microphone before the session</li>
                                    <li style="margin-bottom: 8px;">Keep a glass of water nearby</li>
                                    <li>Wear comfortable clothing for easy movement</li>
                                </ul>
                            </div>
                            
                            ${data.sessionLink ? `
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${data.sessionLink}" style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: white; text-decoration: none; padding: 16px 35px; border-radius: 12px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 15px rgba(2, 132, 199, 0.3); transition: all 0.3s ease;">
                                    🔗 Join Session
                                </a>
                            </div>
                            <p style="text-align: center; font-size: 13px; color: #64748b; margin: 15px 0 0 0; word-break: break-all;">
                                Link: <a href="${data.sessionLink}" style="color: #0284c7; text-decoration: none;">${data.sessionLink}</a>
                            </p>
                            ` : ''}
                            
                            <div style="background-color: #eff6ff; border-radius: 12px; padding: 20px; margin: 25px 0; border-left: 4px solid #0284c7;">
                                <p style="color: #1e40af; margin: 0; font-size: 15px; line-height: 1.6;">
                                    <strong>💡 Important:</strong> Please log in 5 minutes early to ensure everything is working properly. If you experience any technical issues, contact our support team immediately.
                                </p>
                            </div>
                            
                            <p style="font-size: 16px; color: #475569; margin: 30px 0 0 0; line-height: 1.6;">
                                We're looking forward to seeing you tomorrow! If you need to reschedule or have any questions, please contact us at least 2 hours before your scheduled time.
                            </p>
                            
                            <p style="font-size: 14px; color: #64748b; margin: 20px 0 0 0; text-align: center;">
                                Best regards,<br>
                                <strong style="color: #0284c7;">Tanish Physio Team</strong>
                            </p>
                        </td>
                    </tr>
                    
                    ${EmailTemplates.generateFooter(
                        '#083344',
                        { light: '#bae6fd', accent: '#7dd3fc', border: '#0c4a6e' },
                        'Tanish Physio Team'
                    )}
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `;
    }
    
    // Session Reminder (1 hour before)
    static sessionReminder1hEmail(data) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Session Reminder - 1 Hour</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #fff7ed;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fff7ed; padding: 20px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 8px 25px rgba(0,0,0,0.1); overflow: hidden; border: 1px solid #fed7aa;">
                    ${EmailTemplates.generateHeader(
                        'Session Starting Soon!',
                        'Your session begins in 1hour',
                        { start: '#ea580c', end: '#c2410c', text: '#fed7aa' },
                        '🚨'
                    )}
                    
                    <tr>
                        <td style="padding: 40px;">
                            <p style="font-size: 20px; color: #9a3412; margin: 0 0 25px 0; font-weight: 600;">
                                Hello ${data.clientName || 'Valued Patient'},
                            </p>
                            
                            <div style="background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%); border-radius: 12px; padding: 25px; margin: 25px 0; border: 2px solid #fdba74;">
                                <h2 style="color: #9a3412; margin: 0 0 20px 0; font-size: 26px; font-weight: 700;">⏰ Session Starting in 1 Hour</h2>
                                
                                <div style="display: grid; gap: 15px;">
                                    <div style="display: flex; align-items: center; gap: 15px; padding: 15px; background-color: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border-left: 4px solid #ea580c;">
                                        <div style="background-color: #ea580c; color: white; width: 45px; height: 45px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 22px;">
                                            📋
                                        </div>
                                        <div>
                                            <div style="font-weight: 600; color: #9a3412; font-size: 16px;">${data.serviceName || 'Service'}</div>
                                            <div style="font-size: 13px; color: #c2410c;">Service</div>
                                        </div>
                                    </div>
                                    
                                    <div style="display: flex; align-items: center; gap: 15px; padding: 15px; background-color: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border-left: 4px solid #f97316;">
                                        <div style="background-color: #f97316; color: white; width: 45px; height: 45px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 22px;">
                                            🗓️
                                        </div>
                                        <div>
                                            <div style="font-weight: 600; color: #9a3412; font-size: 16px;">${data.date || 'TBD'}</div>
                                            <div style="font-size: 13px; color: #c2410c;">Date</div>
                                        </div>
                                    </div>
                                    
                                    <div style="display: flex; align-items: center; gap: 15px; padding: 15px; background-color: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border-left: 4px solid #fb923c;">
                                        <div style="background-color: #fb923c; color: white; width: 45px; height: 45px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 22px;">
                                            ⏰
                                        </div>
                                        <div>
                                            <div style="font-weight: 600; color: #9a3412; font-size: 16px;">${data.time || 'TBD'}</div>
                                            <div style="font-size: 13px; color: #c2410c;">Time</div>
                                        </div>
                                    </div>
                                    
                                    <div style="display: flex; align-items: center; gap: 15px; padding: 15px; background-color: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border-left: 4px solid #ea580c;">
                                        <div style="background-color: #ea580c; color: white; width: 45px; height: 45px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 22px;">
                                            👨‍⚕️
                                        </div>
                                        <div>
                                            <div style="font-weight: 600; color: #9a3412; font-size: 16px;">${data.therapistName || 'Therapist'}</div>
                                            <div style="font-size: 13px; color: #c2410c;">Your Therapist</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; padding: 20px; margin: 25px 0; border: 2px solid #f59e0b;">
                                <h3 style="color: #b45309; margin: 0 0 15px 0; font-size: 18px; font-weight: 700;">🚨 Final Checklist</h3>
                                <ul style="color: #92400e; margin: 0; padding-left: 20px; line-height: 1.8;">
                                    <li style="margin-bottom: 8px;"><strong>Join now:</strong> Click the "Join Session Now" button below</li>
                                    <li style="margin-bottom: 8px;"><strong>Test equipment:</strong> Check camera, microphone, and internet connection</li>
                                    <li style="margin-bottom: 8px;"><strong>Prepare documents:</strong> Have any relevant medical information ready</li>
                                    <li style="margin-bottom: 8px;"><strong>Find quiet space:</strong> Minimize distractions for the best experience</li>
                                    <li style="margin-bottom: 8px;"><strong>Stay hydrated:</strong> Keep water nearby during the session</li>
                                </ul>
                            </div>
                            
                            ${data.sessionLink ? `
                            <div style="text-align: center; margin: 35px 0;">
                                <a href="${data.sessionLink}" style="background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%); color: white; text-decoration: none; padding: 18px 40px; border-radius: 12px; font-weight: 700; font-size: 17px; display: inline-block; box-shadow: 0 6px 20px rgba(234, 88, 12, 0.4); transition: all 0.3s ease;">
                                    🎯 Join Session Now
                                </a>
                            </div>
                            <p style="text-align: center; font-size: 13px; color: #78350f; margin: 15px 0 0 0; word-break: break-all;">
                                Link: <a href="${data.sessionLink}" style="color: #ea580c; text-decoration: none; font-weight: 600;">${data.sessionLink}</a>
                            </p>
                            ` : ''}
                            
                            <div style="background-color: #fee2e2; border-radius: 12px; padding: 20px; margin: 25px 0; border-left: 4px solid #ef4444;">
                                <p style="color: #991b1b; margin: 0; font-size: 15px; line-height: 1.6;">
                                    <strong>⚠️ Time Sensitive!</strong> Please join the session within the next 15-20 minutes to avoid delays. If you're running late, message your therapist immediately through the app or call our support line.
                                </p>
                            </div>
                            
                            <p style="font-size: 16px; color: #78350f; margin: 30px 0 0 0; line-height: 1.6;">
                                We're ready to see you! Make sure to click the join button above a few minutes before your scheduled time.
                            </p>
                            
                            <p style="font-size: 14px; color: #92400e; margin: 20px 0 0 0; text-align: center;">
                                See you soon,<br>
                                <strong style="color: #ea580c; font-size: 16px;">Tanish Physio Team</strong>
                            </p>
                        </td>
                    </tr>
                    
                    ${EmailTemplates.generateFooter(
                        '#9a3412',
                        { light: '#fed7aa', accent: '#fdba74', border: '#9a3412' },
                        'Tanish Physio Team'
                    )}
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `;
    }
    
    // WhatsApp templates
    static sessionReminder24hWhatsApp(data) {
        return `⏰ *SESSION REMINDER - 24 HOURS*

Hello ${data.clientName || 'Patient'},

Your *${data.serviceName || 'physiotherapy session'}* with *${data.therapistName || 'your therapist'}* is scheduled for tomorrow:

📅 *Date:* ${data.date || 'TBD'}
⏰ *Time:* ${data.time || 'TBD'}

📋 *Preparation Tips:*
• Ensure stable internet connection
• Find a quiet, comfortable space
• Have medical documents ready
• Test camera and microphone
• Keep water nearby
• Wear comfortable clothing

💡 *Important:* Please log in 5 minutes early to test your setup.

We're looking forward to seeing you tomorrow! If you need to reschedule, please contact us at least 2 hours before your session.

*- Tanish Physio Team*`;
    }
    
    static sessionReminder1hWhatsApp(data) {
        return `🚨 *SESSION STARTING SOON - 1 HOUR*

Hello ${data.clientName || 'Patient'},

Your *${data.serviceName || 'physiotherapy session'}* starts in *1 hour!*

📅 *Date:* ${data.date || 'TBD'}
⏰ *Time:* ${data.time || 'TBD'}
👨‍⚕️ *Therapist:* ${data.therapistName || 'Your Therapist'}

🚨 *FINAL CHECKLIST:*
✅ Join now: ${data.sessionLink || 'Session link will be provided'}
✅ Test equipment: Camera, microphone, internet
✅ Prepare documents: Have relevant information ready
✅ Find quiet space: Minimize distractions
✅ Stay hydrated: Keep water nearby

⏰ *TIME SENSITIVE!* Please join within the next 15-20 minutes. If running late, message your therapist immediately.

*- Tanish Physio Team*`;
    }
}

module.exports = SessionReminderTemplates;
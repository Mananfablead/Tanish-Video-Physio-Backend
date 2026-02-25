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
                                            🗓️
                                        </div>
                                        <div>
                                            <div style="font-weight: 600; color: #083344;">${data.date || 'TBD'}</div>
                                            <div style="font-size: 14px; color: #0369a1;">Date</div>
                                        </div>
                                    </div>
                                    
                                    <div style="display: flex; align-items: center; gap: 15px; padding: 15px; background-color: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                                        <div style="background-color: #38bdf8; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                                            ⏰
                                        </div>
                                        <div>
                                            <div style="font-weight: 600; color: #083344;">${data.time || 'TBD'}</div>
                                            <div style="font-size: 14px; color: #0369a1;">Time</div>
                                        </div>
                                    </div>
                                    
                                    <div style="display: flex; align-items: center; gap: 15px; padding: 15px; background-color: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                                        <div style="background-color: #0284c7; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                                            👨‍⚕️
                                        </div>
                                        <div>
                                            <div style="font-weight: 600; color: #083344;">${data.therapistName || 'Therapist'}</div>
                                            <div style="font-size: 14px; color: #0369a1;">Your Therapist</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div style="background-color: #f0fdf4; border-radius: 12px; padding: 20px; margin: 25px 0; border: 1px solid #bbf7d0;">
                                <h3 style="color: #15803d; margin: 0 0 15px 0; font-size: 18px;">📋 Preparation Tips</h3>
                                <ul style="color: #16a34a; margin: 0; padding-left: 20px; line-height: 1.6;">
                                    <li>Ensure you have a stable internet connection</li>
                                    <li>Find a quiet, comfortable space for your session</li>
                                    <li>Have any relevant medical documents ready</li>
                                    <li>Test your camera and microphone before the session</li>
                                </ul>
                            </div>
                            
                            ${data.sessionLink ? `
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${data.sessionLink}" style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 12px; font-weight: 600; display: inline-block; box-shadow: 0 4px 15px rgba(2, 132, 199, 0.3);">
                                    Join Session
                                </a>
                            </div>
                            <p style="text-align: center; font-size: 14px; color: #64748b; margin: 15px 0 0 0;">
                                Session Link: <a href="${data.sessionLink}" style="color: #0284c7;">${data.sessionLink}</a>
                            </p>
                            ` : ''}
                            
                            <p style="font-size: 16px; color: #475569; margin: 30px 0 0 0; line-height: 1.6;">
                                We're looking forward to seeing you tomorrow! If you need to reschedule or have any questions, please contact us at least 2 hours before your scheduled time.
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
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #ffe4b5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffe4b5; padding: 20px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 8px 25px rgba(0,0,0,0.1); overflow: hidden; border: 1px solid #fed7aa;">
                    ${EmailTemplates.generateHeader(
                        'Session Starting Soon!',
                        'Your session begins in 1 hour',
                        { start: '#ea580c', end: '#c2410c', text: '#fed7aa' },
                        '🚨'
                    )}
                    
                    <tr>
                        <td style="padding: 40px;">
                            <p style="font-size: 20px; color: #9a3412; margin: 0 0 25px 0; font-weight: 600;">
                                Hello ${data.clientName || 'Valued Patient'},
                            </p>
                            
                            <div style="background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%); border-radius: 12px; padding: 25px; margin: 25px 0; border: 1px solid #fed7aa;">
                                <h2 style="color: #9a3412; margin: 0 0 20px 0; font-size: 24px;">⏰ Session Starting in 1 Hour</h2>
                                
                                <div style="display: grid; gap: 15px;">
                                    <div style="display: flex; align-items: center; gap: 15px; padding: 15px; background-color: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                                        <div style="background-color: #ea580c; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                                            📋
                                        </div>
                                        <div>
                                            <div style="font-weight: 600; color: #9a3412;">${data.serviceName || 'Service'}</div>
                                            <div style="font-size: 14px; color: #c2410c;">Service</div>
                                        </div>
                                    </div>
                                    
                                    <div style="display: flex; align-items: center; gap: 15px; padding: 15px; background-color: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                                        <div style="background-color: #f97316; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                                            🗓️
                                        </div>
                                        <div>
                                            <div style="font-weight: 600; color: #9a3412;">${data.date || 'TBD'}</div>
                                            <div style="font-size: 14px; color: #c2410c;">Date</div>
                                        </div>
                                    </div>
                                    
                                    <div style="display: flex; align-items: center; gap: 15px; padding: 15px; background-color: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                                        <div style="background-color: #fb923c; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                                            ⏰
                                        </div>
                                        <div>
                                            <div style="font-weight: 600; color: #9a3412;">${data.time || 'TBD'}</div>
                                            <div style="font-size: 14px; color: #c2410c;">Time</div>
                                        </div>
                                    </div>
                                    
                                    <div style="display: flex; align-items: center; gap: 15px; padding: 15px; background-color: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                                        <div style="background-color: #ea580c; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                                            👨‍⚕️
                                        </div>
                                        <div>
                                            <div style="font-weight: 600; color: #9a3412;">${data.therapistName || 'Therapist'}</div>
                                            <div style="font-size: 14px; color: #c2410c;">Your Therapist</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div style="background-color: #fef3c7; border-radius: 12px; padding: 20px; margin: 25px 0; border: 1px solid #fde68a;">
                                <h3 style="color: #b45309; margin: 0 0 15px 0; font-size: 18px;">🚨 Final Check</h3>
                                <ul style="color: #d97706; margin: 0; padding-left: 20px; line-height: 1.6;">
                                    <li><strong>Join now:</strong> Click the link below to join your session</li>
                                    <li><strong>Test equipment:</strong> Check camera, microphone, and internet</li>
                                    <li><strong>Prepare documents:</strong> Have any relevant information ready</li>
                                    <li><strong>Find quiet space:</strong> Minimize distractions for best experience</li>
                                </ul>
                            </div>
                            
                            ${data.sessionLink ? `
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${data.sessionLink}" style="background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 12px; font-weight: 600; display: inline-block; box-shadow: 0 4px 15px rgba(234, 88, 12, 0.3);">
                                    Join Session Now
                                </a>
                            </div>
                            <p style="text-align: center; font-size: 14px; color: #64748b; margin: 15px 0 0 0;">
                                Session Link: <a href="${data.sessionLink}" style="color: #ea580c;">${data.sessionLink}</a>
                            </p>
                            ` : ''}
                            
                            <p style="font-size: 16px; color: #475569; margin: 30px 0 0 0; line-height: 1.6;">
                                <strong>Time is critical!</strong> Please join promptly at the scheduled time. If you're running late, please message your therapist immediately.
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
        return `⏰ SESSION REMINDER - 24 HOURS

Hello ${data.clientName || 'Patient'},

Your ${data.serviceName || 'physiotherapy session'} with ${data.therapistName || 'your therapist'} is scheduled for tomorrow:

📅 Date: ${data.date || 'TBD'}
⏰ Time: ${data.time || 'TBD'}

📋 Preparation Tips:
• Ensure stable internet connection
• Find a quiet, comfortable space
• Have medical documents ready
• Test camera and microphone

We're looking forward to seeing you tomorrow! If you need to reschedule, please contact us at least 2 hours before your session.

- Tanish Physio Team`;
    }
    
    static sessionReminder1hWhatsApp(data) {
        return `🚨 SESSION STARTING SOON - 1 HOUR

Hello ${data.clientName || 'Patient'},

Your ${data.serviceName || 'physiotherapy session'} starts in 1 hour!

📅 Date: ${data.date || 'TBD'}
⏰ Time: ${data.time || 'TBD'}
👨‍⚕️ Therapist: ${data.therapistName || 'Your Therapist'}

🚨 FINAL CHECK:
• Join now: ${data.sessionLink || 'Session link will be provided'}
• Test equipment: Camera, microphone, internet
• Prepare documents: Have relevant information ready
• Find quiet space: Minimize distractions

⏰ TIME IS CRITICAL! Please join promptly. If running late, message your therapist immediately.

- Tanish Physio Team`;
    }
}

module.exports = SessionReminderTemplates;
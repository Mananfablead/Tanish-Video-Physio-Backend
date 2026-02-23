# Tanish Physio Backend

Backend API for the Tanish Physio application, built with Node.js, Express, and MongoDB.

## Features

- User authentication and authorization with JWT
- Therapist and service management
- Booking and appointment scheduling
- Payment integration with Razorpay
- Video call integration
- Real-time chat functionality
- Admin dashboard and reporting

## Tech Stack

- Node.js
- Express.js
- MongoDB with Mongoose ODM
- JWT for authentication
- Razorpay for payment processing
- Socket.io for real-time communication
- Winston for logging

## Setup

1. Clone the repository
2. Navigate to the backend directory: `cd tanish-physio-backend`
3. Install dependencies: `npm install`
4. Create a `.env` file based on `.env.example`
5. Set up your environment variables:
   - `MONGODB_URI`: Your MongoDB connection string
   - `JWT_SECRET`: Secret key for JWT tokens
   - `EMAIL_*`: Email configuration (optional)
   - Razorpay credentials are now managed via the database (Credentials model)
6. Start the server: `npm run dev`

## API Endpoints

For a complete list of API endpoints, please refer to the [Unified API Documentation](../Unified_API_Documentation.md).

## Environment Variables

Create a `.env` file in the root of the backend directory with the following variables:

```
```NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/tanish-physio
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRE=24h
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

## Folder Structure

```
src/
├── server.js
├── app.js
├── config/
│   ├── db.js
│   ├── env.js
│   ├── jwt.js
│   └── razorpay.js
├── routes/
│   ├── index.js
│   ├── auth.routes.js
│   ├── users.routes.js
│   ├── therapists.routes.js
│   ├── services.routes.js
│   ├── bookings.routes.js
│   ├── sessions.routes.js
│   ├── payments.routes.js
│   ├── subscriptions.routes.js
│   ├── availability.routes.js
│   ├── reports.routes.js
│   ├── notifications.routes.js
│   └── chat.routes.js
├── controllers/
├── models/
├── middlewares/
├── services/
├── utils/
└── sockets/
```

## Payment Integration

The backend uses Razorpay for payment processing. Razorpay credentials are now managed via the database (Credentials model) instead of environment variables. The following endpoints are available:

- `POST /api/payments/create-order` - Create a payment order
- `POST /api/payments/webhook` - Handle payment webhooks from Razorpay

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License.




📱📧 NOTIFICATION SYSTEM WORKFLOW
How It Works:
1. Notification Triggers (Automatic)
The system automatically sends notifications based on status changes:User Notifications:
✅ Booking Created → When user submits a booking (status: pending)
✅ Booking Confirmed → When admin approves (status: confirmed)
✅ Booking Cancelled → When admin rejects (status: cancelled)
✅ Payment Reminders → Every 24 hours if payment is pending
✅ Payment Success → When payment is completed
✅ Session Reminders → 1 day before scheduled session
Admin Notifications:
✅ New Bookings → When users create bookings
✅ Payments Received → When payments are successful
✅ Upcoming Sessions → Daily reminders for tomorrow's sessions
✅ Daily Summaries → Overall statistics report
2. Configuration Setup
Email Configuration (Already in your .env):
env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
WhatsApp Configuration (Optional):
env
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_NUMBER=+14155238886
3. How Notifications Are Sent
Automatic Triggers Example:
javascript
// When admin confirms a booking
await NotificationService.sendNotification(
    { email: user.email, phone: user.phone },
    'booking_confirmation',
    {
        clientName: "John Doe",
        serviceName: "Physiotherapy Session",
        bookingId: "12345",
        date: "2024-01-15",
        time: "10:00 AM"
    }
);
4. Template System
Each notification type has predefined templates:Email Template Example:
html
<h2>Booking Confirmed!</h2>
<p>Dear John Doe,</p>
<p>Your booking for Physiotherapy Session has been confirmed.</p>
<p>Date: 2024-01-15</p>
<p>Time: 10:00 AM</p>
WhatsApp Template Example:
plaintext
Your booking for Physiotherapy Session is confirmed! 
Date: 2024-01-15, Time: 10:00 AM
5. Cron Jobs (Automatic Scheduling)
Payment Reminders:
Run every hour (0 * * * *)
Check for bookings with paymentStatus: 'pending'
Send reminders if 24+ hours old
Session Reminders:
Run every 30 minutes (*/30 * * * *)
Check for confirmed bookings with sessions tomorrow
Send 1-day advance notice
Daily Admin Summary:
Run daily at 9 AM (0 9 * * *)
Send booking statistics to all admins
6. Manual Testing
You can manually trigger notifications for testing:
javascript
// Test payment reminders
await reminderService.triggerPaymentReminders();

// Test session reminders  
await reminderService.triggerSessionReminders();

// Test daily summary
await reminderService.triggerDailySummary();
Current Status:
✅ Email notifications ready (configured in your .env)
✅ WhatsApp notifications ready (add Twilio credentials)
✅ All templates created and ready
✅ Automatic triggers implemented
✅ Cron jobs scheduled
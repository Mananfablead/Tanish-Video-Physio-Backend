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
   - `RAZORPAY_KEY_ID`: Razorpay key ID
   - `RAZORPAY_KEY_SECRET`: Razorpay key secret
   - `EMAIL_*`: Email configuration (optional)
6. Start the server: `npm run dev`

## API Endpoints

For a complete list of API endpoints, please refer to the [Unified API Documentation](../Unified_API_Documentation.md).

## Environment Variables

Create a `.env` file in the root of the backend directory with the following variables:

```
NODE_ENV=development
PORT=3001
MONGODB_URI=mongodb://localhost:27017/tanish-physio
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRE=24h
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
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

The backend uses Razorpay for payment processing. The following endpoints are available:

- `POST /api/payments/create-order` - Create a payment order
- `POST /api/payments/webhook` - Handle payment webhooks from Razorpay

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License.

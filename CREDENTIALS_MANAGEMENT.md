# Credentials Management System

## Overview

The Credentials Management System allows administrators to dynamically manage external service credentials (WhatsApp, Email, Razorpay) through the admin dashboard without hardcoding them in environment variables.

## Features

✅ **Dynamic Credential Management** - Add, update, delete, and activate/deactivate credentials through the admin panel
✅ **Encryption** - All sensitive data is encrypted and decrypted securely using AES-256-CBC
✅ **Multiple Instances** - Support for multiple credentials of each type
✅ **Active Status** - Only one credential per type can be active at a time
✅ **Audit Trail** - Track which admin last updated each credential
✅ **Role-Based Access** - Only admin users can manage credentials

## Architecture

### Backend

#### Models
- **Credentials.model.js** - MongoDB schema for storing encrypted credentials

#### Controllers
- **credentials.controller.js** - Business logic for CRUD operations

#### Routes
- **credentials.routes.js** - API endpoints (admin-only)

#### Utils
- **credentialsManager.js** - Helper functions to retrieve and use credentials

### Frontend

#### Pages
- **AdminCredentials.tsx** - Admin dashboard page for credential management

## API Endpoints

All endpoints require authentication and admin role.

### Get All Credentials
```
GET /credentials
Response: Array of credentials (without sensitive data in list view)
```

### Get Single Credential
```
GET /credentials/:id
Response: Full credential object with decrypted sensitive fields
```

### Create Credential
```
POST /credentials
Body:
{
  "credentialType": "whatsapp|email|razorpay",
  "name": "Credential name",
  "description": "Optional description",
  // Type-specific fields (see examples below)
}
```

### Update Credential
```
PUT /credentials/:id
Body: Same as create (update only provided fields)
```

### Toggle Credential Status
```
PATCH /credentials/:id/toggle-status
Body:
{
  "isActive": true|false
}
```

### Delete Credential
```
DELETE /credentials/:id
```

### Validate Credential
```
POST /credentials/:id/validate
Response: { isValid: boolean, message: string, type: string }
```

### Get Active Credential by Type
```
GET /credentials/type/:type
Response: Active credential for the specified type
```

## Usage Examples

### WhatsApp Credential

**Create:**
```javascript
const whatsappData = {
  credentialType: "whatsapp",
  name: "WhatsApp Business Account",
  description: "Production WhatsApp credentials",
  whatsappAccessToken: "EAAx...",
  whatsappPhoneNumberId: "848317898376074",
  whatsappBusinessId: "4135992726716468"
};

POST /credentials
```

**Use in Service:**
```javascript
const { getWhatsAppCredentials } = require("../utils/credentialsManager");

// In your WhatsApp service
const whatsappCreds = await getWhatsAppCredentials();

if (whatsappCreds) {
  // Use credentials to send WhatsApp messages
  const { accessToken, phoneNumberId, businessId } = whatsappCreds;
  // ... send message logic
}
```

### Email Credential

**Create:**
```javascript
const emailData = {
  credentialType: "email",
  name: "Gmail SMTP",
  description: "Gmail SMTP for sending emails",
  emailHost: "smtp.gmail.com",
  emailPort: 587,
  emailUser: "akash.fablead@gmail.com",
  emailPassword: "rqqw tvbn plsj wrlm", // App password
  adminEmail: "akash.fablead@gmail.com"
};

POST /credentials
```

**Use in Service:**
```javascript
const { getEmailCredentials } = require("../utils/credentialsManager");
const nodemailer = require("nodemailer");

// In your email service
const emailCreds = await getEmailCredentials();

if (emailCreds) {
  const transporter = nodemailer.createTransport({
    host: emailCreds.host,
    port: emailCreds.port,
    secure: true,
    auth: {
      user: emailCreds.user,
      pass: emailCreds.password
    }
  });

  // Send email
  const result = await transporter.sendMail({
    from: emailCreds.user,
    to: "recipient@example.com",
    subject: "Test",
    text: "Hello"
  });
}
```

### Razorpay Credential

**Create:**
```javascript
const razorpayData = {
  credentialType: "razorpay",
  name: "Razorpay Live",
  description: "Live Razorpay payment credentials",
  razorpayKeyId: "rzp_live_...",
  razorpayKeySecret: "uvPkIj6Wi9gO3WYHqje57gh7"
};

POST /credentials
```

**Use in Service:**
```javascript
const { getRazorpayCredentials } = require("../utils/credentialsManager");
const Razorpay = require("razorpay");

// In your payment service
const razorpayCreds = await getRazorpayCredentials();

if (razorpayCreds) {
  const razorpayInstance = new Razorpay({
    key_id: razorpayCreds.keyId,
    key_secret: razorpayCreds.keySecret
  });

  // Create payment order
  const order = await razorpayInstance.orders.create({
    amount: 50000,
    currency: "INR"
  });
}
```

## Security Considerations

1. **Encryption** - All sensitive fields use AES-256-CBC encryption with scrypt-derived keys
2. **Environment Variable** - Ensure `CIPHER_KEY` is set in .env with a strong 32-character key
3. **Role-Based Access** - Only admins can create, edit, or delete credentials
4. **No Logging** - Avoid logging credential values
5. **HTTPS Only** - Always use HTTPS in production

## Setting up CIPHER_KEY

Add to your `.env` file:
```
CIPHER_KEY=your-32-character-secret-key-here
```

Generate a secure key:
```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

## Integrating with Existing Services

To migrate from environment variables to this system:

1. **Identify all services** using WhatsApp, Email, or Razorpay credentials
2. **Replace direct imports** with credentialsManager utility functions
3. **Add error handling** for cases where credentials are not configured
4. **Test thoroughly** in development before deploying to production

### Example Migration

**Before:**
```javascript
const whatsappToken = process.env.WHATSAPP_ACCESS_TOKEN;
const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
```

**After:**
```javascript
const { getWhatsAppCredentials } = require("../utils/credentialsManager");

const creds = await getWhatsAppCredentials();
if (!creds) {
  throw new Error("WhatsApp credentials not configured");
}
const whatsappToken = creds.accessToken;
const phoneId = creds.phoneNumberId;
```

## Troubleshooting

### "No active credentials found"
- Check if any credential of that type is marked as active
- Verify the credential has been saved correctly in the database

### "Failed to retrieve credentials"
- Ensure database connection is established
- Check if the Credentials collection exists in MongoDB
- Verify user has admin role

### Encryption/Decryption Errors
- Ensure `CIPHER_KEY` is set correctly in .env
- Check if the key length matches (should be 32 characters)
- Verify no credentials were corrupted in the database

## Future Enhancements

- [ ] Credential validation on save (test API credentials)
- [ ] Credential history and version control
- [ ] Two-factor authentication for credential access
- [ ] IP whitelisting for credential retrieval
- [ ] Automatic credential rotation support
- [ ] Integration with external secret management systems (Vault, AWS Secrets Manager)

## Support

For issues or questions, contact the development team.

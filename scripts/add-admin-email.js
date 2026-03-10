// Script to add admin email to credentials
const mongoose = require('mongoose');
require('dotenv').config();

const Credentials = require('./src/models/Credentials.model');

async function addAdminEmail() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/tanish-physio');
        console.log('✅ Connected to MongoDB');

        // Check if email credentials exist
        const existingCreds = await Credentials.findOne({ credentialType: 'email' });

        if (existingCreds) {
            console.log('📧 Email credentials already exist');
            console.log('Current admin email:', existingCreds.adminEmail || 'NOT SET');

            // Update admin email
            existingCreds.adminEmail = 'admin@tanishphysio.com'; // CHANGE THIS TO YOUR ADMIN EMAIL
            existingCreds.isActive = true;
            await existingCreds.save();

            console.log('✅ Admin email updated successfully');
        } else {
            // Create new email credentials
            const newCreds = new Credentials({
                credentialType: 'email',
                name: 'Email Configuration',
                description: 'Email credentials for notifications',
                emailHost: 'smtp.gmail.com', // CHANGE IF NOT USING GMAIL
                emailPort: 587, // 587 for TLS, 465 for SSL
                emailUser: 'your-email@gmail.com', // CHANGE TO YOUR EMAIL
                emailUsername: 'your-email@gmail.com', // SAME AS ABOVE
                emailPassword: 'your-app-password', // CHANGE TO YOUR APP PASSWORD
                emailEncryption: 'TLS', // TLS or SSL
                adminEmail: 'admin@tanishphysio.com', // CHANGE TO YOUR ADMIN EMAIL
                isActive: true
            });

            await newCreds.save();
            console.log('✅ Email credentials created successfully');
        }

        // Verify the update
        const updatedCreds = await Credentials.findOne({ credentialType: 'email', isActive: true });
        console.log('\n📧 Final Configuration:');
        console.log('Admin Email:', updatedCreds.adminEmail);
        console.log('Email Host:', updatedCreds.emailHost);
        console.log('Email Port:', updatedCreds.emailPort);
        console.log('Is Active:', updatedCreds.isActive);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

addAdminEmail();

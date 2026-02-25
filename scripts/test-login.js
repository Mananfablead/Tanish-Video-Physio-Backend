const mongoose = require('mongoose');
const User = require('../src/models/User.model');
const { comparePassword } = require('../src/utils/auth.utils');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tanish-physio');
        console.log('MongoDB connected successfully');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

// Test login functionality
const testLogin = async () => {
    try {
        // Find a user with temp password flag
        const user = await User.findOne({ hasTempPassword: true, status: 'active' });

        if (!user) {
            console.log('No user with temp password found');
            return;
        }

        console.log('Testing user:', user.email);
        console.log('Has temp password:', user.hasTempPassword);
        console.log('Password length:', user.password ? user.password.length : 'null');

        // Simulate login with a temp password
        // Since we don't know the original temp password, let's test the logic
        const testPassword = 'test123Temp1!'; // This is just for testing the logic

        console.log('\nTesting login logic:');
        console.log('User has temp password flag:', user.hasTempPassword);

        if (user.hasTempPassword) {
            console.log('Using temp password logic');
            // This would be the logic in the login controller
            const isMatch = testPassword === user.password || await comparePassword(testPassword, user.password);
            console.log('Password match result:', isMatch);

            if (isMatch) {
                console.log('Would convert to regular password');
                // In real implementation, we would do:
                // user.hasTempPassword = false;
                // await user.save({ validateBeforeSave: false });
            }
        } else {
            console.log('Using regular password logic');
            const isMatch = await comparePassword(testPassword, user.password);
            console.log('Password match result:', isMatch);
        }

    } catch (error) {
        console.error('Error testing login:', error);
    }
};

// Run the test
const runTest = async () => {
    await connectDB();
    await testLogin();
    await mongoose.connection.close();
    console.log('Test completed');
};

runTest();
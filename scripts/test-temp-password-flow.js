const mongoose = require('mongoose');
const User = require('../src/models/User.model');
const { comparePassword, hashPassword } = require('../src/utils/auth.utils');
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

// Test the complete temp password flow
const testTempPasswordFlow = async () => {
    try {
        console.log('=== Testing Temp Password Flow ===\n');

        // 1. Create a test user with temp password
        const tempPassword = 'abc123Temp1!';
        console.log('1. Creating test user with temp password:', tempPassword);

        // Hash the password (this is what happens when user is saved)
        const hashedPassword = await hashPassword(tempPassword);
        console.log('Hashed password length:', hashedPassword.length);

        // Create test user
        const testUser = new User({
            name: 'Test User',
            email: 'test@example.com',
            password: tempPassword, // This will be hashed by pre-save hook
            phone: '1234567890',
            role: 'patient',
            status: 'active',
            hasTempPassword: true
        });

        await testUser.save();
        console.log('Test user created successfully\n');

        // 2. Verify the user was saved correctly
        const savedUser = await User.findOne({ email: 'test@example.com' });
        console.log('2. Verifying saved user:');
        console.log('   - Email:', savedUser.email);
        console.log('   - Has temp password:', savedUser.hasTempPassword);
        console.log('   - Password length:', savedUser.password.length);
        console.log('   - Password matches original:', savedUser.password !== tempPassword);
        console.log('');

        // 3. Test login with temp password logic
        console.log('3. Testing login logic:');

        // Simulate what happens in the login controller
        let isMatch = false;

        if (savedUser.hasTempPassword) {
            console.log('   Using temp password logic');
            // Try direct comparison first (this is the key fix)
            isMatch = tempPassword === savedUser.password;
            console.log('   Direct comparison result:', isMatch);

            // Also try hashed comparison (should also work)
            if (!isMatch) {
                isMatch = await comparePassword(tempPassword, savedUser.password);
                console.log('   Hashed comparison result:', isMatch);
            }

            if (isMatch) {
                console.log('   ✓ Temp password login successful');
                console.log('   Converting to regular password...');
                savedUser.hasTempPassword = false;
                await savedUser.save({ validateBeforeSave: false });
                console.log('   ✓ User converted to regular password');
            }
        } else {
            console.log('   Using regular password logic');
            isMatch = await comparePassword(tempPassword, savedUser.password);
            console.log('   Comparison result:', isMatch);
        }

        console.log('   Final result: Login', isMatch ? 'SUCCESSFUL' : 'FAILED');
        console.log('');

        // 4. Verify the conversion worked
        const updatedUser = await User.findOne({ email: 'test@example.com' });
        console.log('4. After login attempt:');
        console.log('   - Has temp password:', updatedUser.hasTempPassword);
        console.log('   - Should be false:', !updatedUser.hasTempPassword);
        console.log('');

        // 5. Test subsequent login (should work with regular logic)
        console.log('5. Testing subsequent login with regular password logic:');
        const secondLoginMatch = await comparePassword(tempPassword, updatedUser.password);
        console.log('   Regular password comparison result:', secondLoginMatch);
        console.log('   Subsequent login:', secondLoginMatch ? 'SUCCESSFUL' : 'FAILED');
        console.log('');

        // 6. Clean up test user
        await User.deleteOne({ email: 'test@example.com' });
        console.log('6. Test user cleaned up');

        console.log('=== Test Complete ===');

    } catch (error) {
        console.error('Error in test:', error);
    }
};

// Run the test
const runTest = async () => {
    await connectDB();
    await testTempPasswordFlow();
    await mongoose.connection.close();
    console.log('Test completed');
};

runTest();
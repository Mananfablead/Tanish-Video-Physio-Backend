const mongoose = require('mongoose');
const User = require('../src/models/User.model');
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

// Update users with temporary passwords
const updateTempPasswordFlags = async () => {
    try {
        // Find users who might have temporary passwords based on pattern
        // Temp passwords are generated as: Math.random().toString(36).slice(-8) + 'Temp1!'
        // This creates passwords like: 'a1b2c3d4Temp1!'

        const users = await User.find({
            hasTempPassword: { $ne: true },
            status: 'active'
        });

        console.log(`Found ${users.length} users to check for temporary passwords`);

        let updatedCount = 0;

        for (const user of users) {
            // Check if password matches temp password pattern
            // Temp passwords end with 'Temp1!' and are relatively short
            if (user.password && typeof user.password === 'string') {
                // Check if this looks like a temp password
                // We can't easily check the plain text since it's hashed, but we can
                // look for users who were recently created and might have temp passwords

                // For now, let's update users who were created recently (last 30 days)
                // and don't have the temp password flag set
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

                if (user.createdAt && user.createdAt > thirtyDaysAgo) {
                    console.log(`Updating user ${user.email} - potentially has temp password`);
                    user.hasTempPassword = true;
                    await user.save({ validateBeforeSave: false });
                    updatedCount++;
                }
            }
        }

        console.log(`Updated ${updatedCount} users with temp password flags`);

    } catch (error) {
        console.error('Error updating temp password flags:', error);
    }
};

// Run the migration
const runMigration = async () => {
    await connectDB();
    await updateTempPasswordFlags();
    await mongoose.connection.close();
    console.log('Migration completed');
};

runMigration();
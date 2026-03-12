/**
 * Script to fix admin notifications - set adminId for all admin notifications
 * Run this once to update existing notifications in the database
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Database connection
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ MongoDB connected');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
};

const fixAdminNotifications = async () => {
    try {
        await connectDB();

        const Notification = mongoose.model('Notification', new mongoose.Schema({
            title: String,
            message: String,
            type: String,
            recipientType: String,
            userId: mongoose.Schema.Types.ObjectId,
            adminId: mongoose.Schema.Types.ObjectId,
            priority: String,
            read: Boolean,
            channels: Object,
            metadata: Object
        }, { timestamps: true }));

        const User = mongoose.model('User', new mongoose.Schema({
            email: String,
            role: String
        }));

        console.log('\n📊 Checking admin notifications...');

        // Find all admin notifications with null adminId
        const adminNotifications = await Notification.find({
            recipientType: 'admin',
            adminId: null
        });

        console.log(`Found ${adminNotifications.length} admin notifications with null adminId`);

        if (adminNotifications.length === 0) {
            console.log('✅ All admin notifications already have adminId set');
            process.exit(0);
        }

        // Get first admin user to assign to old notifications
        const firstAdmin = await User.findOne({ role: 'admin' }).select('_id');

        if (!firstAdmin) {
            console.log('⚠️ No admin user found. Cannot update notifications.');
            process.exit(1);
        }

        console.log(`\n🔧 Using admin ID: ${firstAdmin._id}`);

        // Update all admin notifications
        const result = await Notification.updateMany(
            {
                recipientType: 'admin',
                adminId: null
            },
            {
                $set: { adminId: firstAdmin._id }
            }
        );

        console.log(`\n✅ Successfully updated ${result.modifiedCount} admin notifications`);
        console.log(`📝 Set adminId to: ${firstAdmin._id}`);

        // Verify the update
        const remainingNulls = await Notification.countDocuments({
            recipientType: 'admin',
            adminId: null
        });

        console.log(`\n📊 Verification: ${remainingNulls} admin notifications still have null adminId`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

fixAdminNotifications();

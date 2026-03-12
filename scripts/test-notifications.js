const mongoose = require('mongoose');
require('dotenv').config();

// Connect to database
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tanish-physio')
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

// Import models
const Session = require('./src/models/Session.model');
const User = require('./src/models/User.model');

async function testNotifications() {
    try {
        console.log('\n🔍 Testing Notification System...\n');

        // Find a recent session
        const recentSession = await Session.findOne()
            .populate('userId', 'name email')
            .populate('bookingId', 'clientName serviceName')
            .sort({ createdAt: -1 })
            .limit(1);

        if (!recentSession) {
            console.log('❌ No sessions found in database');
            return;
        }

        console.log('📋 Recent Session Details:');
        console.log(`   Session ID: ${recentSession._id}`);
        console.log(`   User ID: ${recentSession.userId?._id || recentSession.userId}`);
        console.log(`   User Name: ${recentSession.userId?.name || 'N/A'}`);
        console.log(`   User Email: ${recentSession.userId?.email || 'N/A'}`);
        console.log(`   Status: ${recentSession.status}`);
        console.log(`   Date: ${recentSession.date}`);
        console.log(`   Time: ${recentSession.time}`);

        if (recentSession.bookingId) {
            console.log(`   Client Name: ${recentSession.bookingId.clientName}`);
            console.log(`   Service: ${recentSession.bookingId.serviceName}`);
        }

        console.log('\n💡 Expected Notification Flow:');
        console.log('   1. When session was created → Admin should receive "New Session Request"');
        console.log('   2. When status changed to "scheduled" → Client should receive "Session Accepted!"');

        console.log('\n🔧 Check these if notifications not working:');
        console.log('   ✓ Backend server console - should show "Real-time notification sent to admin..."');
        console.log('   ✓ Admin browser console - should show "Received admin notification:"');
        console.log('   ✓ Client browser console - should show "Received client notification:"');
        console.log('   ✓ Socket connection - both admin and client should be connected to WebSocket');
        console.log('   ✓ Room joining - check "Joined admin/client notifications room" messages');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Run test after DB connection
setTimeout(testNotifications, 2000);

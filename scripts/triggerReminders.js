// Script to manually trigger reminder service
const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB first
async function connectDB() {
    try {
        const dbURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tanish-physio';
        await mongoose.connect(dbURI);
        console.log('🔗 Database connected successfully');
    } catch (error) {
        console.error('❌ Database connection error:', error.message);
        process.exit(1);
    }
}

async function triggerReminders() {
    try {
        console.log('🔍 Triggering session reminders...');

        // Dynamically import the reminder service after DB connection
        const { default: ReminderService } = await import('../src/services/reminderService.js');

        await ReminderService.triggerSessionReminders();
        console.log('✅ Session reminders triggered successfully');

        console.log('🔍 Triggering daily summary...');
        await ReminderService.triggerDailySummary();
        console.log('✅ Daily summary triggered successfully');

    } catch (error) {
        console.error('❌ Error triggering reminders:', error.message);
        process.exit(1);
    } finally {
        // Close database connection
        await mongoose.connection.close();
        console.log('🔒 Database connection closed');
    }
}

// Main execution
async function main() {
    try {
        await connectDB();
        await triggerReminders();
    } catch (error) {
        console.error('❌ Fatal error:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { triggerReminders };
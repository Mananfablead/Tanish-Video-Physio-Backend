// Script to manually trigger reminder service
const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB first
async function connectDB() {
    try {
        const dbURI = process.env.MONGODB_URI;
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
    }
}

// Main execution - keep DB connection open for cron jobs
async function main() {
    try {
        await connectDB();

        // Initialize the reminder service cron jobs
        const { default: ReminderService } = await import('../src/services/reminderService.js');
        ReminderService.initialize();

        console.log('✅ Reminder service started with cron jobs');
        console.log('📊 Service status:', ReminderService.getStatus());

        // Keep the process running - don't close DB connection
        // The cron jobs will continue to run
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
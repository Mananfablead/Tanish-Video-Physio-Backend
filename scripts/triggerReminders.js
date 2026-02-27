// Script to manually trigger reminder service
const ReminderService = require('../src/services/reminderService');

async function triggerReminders() {
    try {
        console.log('🔍 Triggering session reminders...');
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

// Run if called directly
if (require.main === module) {
    triggerReminders();
}

module.exports = { triggerReminders };
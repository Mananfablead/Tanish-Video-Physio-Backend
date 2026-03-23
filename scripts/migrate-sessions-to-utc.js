/**
 * Migration Script: Convert Existing Session Times to UTC
 * 
 * This script converts all existing session startTime and endTime from 
 * local time (Asia/Kolkata) to UTC for consistent timezone handling.
 * 
 * Usage: node scripts/migrate-sessions-to-utc.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Session = require('../src/models/Session.model');
const { getUTCFromLocal } = require('../src/utils/timezone.utils');

const config = require('../src/config/env');

const migrateSessionsToUTC = async () => {
    try {
        // Connect to database
        await mongoose.connect(config.MONGODB_URI);
        console.log('✓ Database connected');

        // Get all sessions
        const sessions = await Session.find({});
        console.log(`\nFound ${sessions.length} sessions to migrate`);

        let updatedCount = 0;
        let errorCount = 0;

        for (const session of sessions) {
            try {
                // Skip if session doesn't have date/time or already in UTC format
                if (!session.date || !session.time) {
                    console.log(`⚠ Skipping session ${session._id} - missing date/time`);
                    continue;
                }

                // Check if startTime looks like it's already UTC (no timezone offset)
                const startTimeStr = session.startTime.toISOString();
                const datePart = startTimeStr.split('T')[0];
                
                // If the date part matches session.date, it might already be UTC
                // This is a rough check - adjust based on your needs
                if (session.date === datePart && session.time.startsWith(startTimeStr.split('T')[1].substr(0, 5))) {
                    console.log(`⚠ Skipping session ${session._id} - appears to already be in UTC`);
                    continue;
                }

                // Convert startTime from local to UTC
                const oldStartTime = new Date(session.startTime);
                const newStartTime = getUTCFromLocal(session.date, session.time, 'Asia/Kolkata');
                
                // Calculate new endTime based on duration
                let newEndTime = null;
                if (session.duration && session.duration > 0) {
                    newEndTime = new Date(newStartTime.getTime() + (session.duration * 60000));
                } else if (session.endTime) {
                    // If there's an existing endTime but no duration, preserve the time difference
                    const timeDiff = session.endTime.getTime() - session.startTime.getTime();
                    newEndTime = new Date(newStartTime.getTime() + timeDiff);
                }

                // Update the session
                session.startTime = newStartTime;
                if (newEndTime) {
                    session.endTime = newEndTime;
                }
                
                await session.save();
                
                updatedCount++;
                console.log(`✓ Updated session ${session._id}`);
                console.log(`  Old startTime: ${oldStartTime.toISOString()} -> New startTime: ${newStartTime.toISOString()}`);
                if (newEndTime) {
                    console.log(`  New endTime: ${newEndTime.toISOString()}`);
                }

            } catch (error) {
                errorCount++;
                console.error(`✗ Error migrating session ${session._id}:`, error.message);
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('Migration Summary:');
        console.log(`  Total sessions processed: ${sessions.length}`);
        console.log(`  Sessions updated: ${updatedCount}`);
        console.log(`  Errors: ${errorCount}`);
        console.log(`  Skipped: ${sessions.length - updatedCount - errorCount}`);
        console.log('='.repeat(60));

        // Close database connection
        await mongoose.disconnect();
        console.log('\n✓ Database disconnected');
        console.log('\nMigration completed successfully!');

    } catch (error) {
        console.error('\n✗ Migration failed:', error);
        process.exit(1);
    }
};

// Run migration
if (require.main === module) {
    migrateSessionsToUTC();
}

module.exports = migrateSessionsToUTC;

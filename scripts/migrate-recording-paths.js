const mongoose = require('mongoose');
const config = require('../src/config/env');

// Connect to MongoDB
mongoose.connect(config.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });

// Import the CallLog model
const CallLog = require('../src/models/CallLog.model');

async function migrateRecordingPaths() {
    try {
        console.log('Starting recording path migration...');

        // Find all call logs with recordingUrl containing old path
        const callLogs = await CallLog.find({
            recordingUrl: { $regex: /\/uploads\/recordings\// }
        });

        console.log(`Found ${callLogs.length} records with old recording paths`);

        let updatedCount = 0;

        for (const callLog of callLogs) {
            console.log(`Processing call log ID: ${callLog._id}`);
            console.log(`Old URL: ${callLog.recordingUrl}`);

            // Update the recordingUrl to use recording-videos directory
            const newUrl = callLog.recordingUrl.replace('/uploads/recordings/', '/uploads/recording-videos/');
            callLog.recordingUrl = newUrl;

            // Also update any recordingImages if they exist
            if (callLog.recordingImages && Array.isArray(callLog.recordingImages)) {
                callLog.recordingImages = callLog.recordingImages.map(img => {
                    if (img.includes('/uploads/recordings/')) {
                        return img.replace('/uploads/recordings/', '/uploads/recording-videos/');
                    }
                    return img;
                });
            }

            await callLog.save();
            console.log(`Updated to: ${callLog.recordingUrl}`);
            updatedCount++;
        }

        console.log(`Migration completed! Updated ${updatedCount} records.`);

        // Verify the migration
        const remainingOldPaths = await CallLog.countDocuments({
            recordingUrl: { $regex: /\/uploads\/recordings\// }
        });

        console.log(`Records still containing old paths: ${remainingOldPaths}`);

        if (remainingOldPaths === 0) {
            console.log('✅ Migration successful - all recording paths updated!');
        } else {
            console.log('⚠️ Some records still have old paths - manual check required');
        }

        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

// Run the migration
migrateRecordingPaths();
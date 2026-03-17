const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => {
        console.error('❌ MongoDB connection error:', err);
        process.exit(1);
    });

const Availability = require('./src/models/Availability.model');

async function addMinimumNoticePeriod() {
    try {
        console.log('🔍 Finding availability records without minimumNoticePeriod...');

        // Find all records where minimumNoticePeriod is null or undefined
        const recordsWithoutField = await Availability.find({
            $or: [
                { minimumNoticePeriod: null },
                { minimumNoticePeriod: { $exists: false } }
            ]
        });

        console.log(`📊 Found ${recordsWithoutField.length} records without minimumNoticePeriod`);

        if (recordsWithoutField.length === 0) {
            console.log('✅ All records already have minimumNoticePeriod field!');
            return;
        }

        // Update all records to have default value of 15 minutes
        const updateResult = await Availability.updateMany(
            {
                $or: [
                    { minimumNoticePeriod: null },
                    { minimumNoticePeriod: { $exists: false } }
                ]
            },
            { $set: { minimumNoticePeriod: 15 } }
        );

        console.log('✅ Migration completed!');
        console.log(`📝 Updated ${updateResult.modifiedCount} records`);
        console.log(`📈 Matched ${updateResult.matchedCount} records`);

        // Verify the update
        const sampleRecords = await Availability.find().limit(5).select('date minimumNoticePeriod');
        console.log('\n📋 Sample records after migration:');
        sampleRecords.forEach(record => {
            console.log(`   Date: ${record.date}, Minimum Notice: ${record.minimumNoticePeriod} min`);
        });

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error(error);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 MongoDB disconnected');
        process.exit(0);
    }
}

// Run migration
addMinimumNoticePeriod();

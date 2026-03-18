/**
 * Script to fix incorrect time slots in availability records
 * This fixes timezone-related issues where times like 02:00 AM were stored instead of local times
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tanish-physio')
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

const Availability = require('./src/models/Availability.model');

async function fixTimeSlots() {
    try {
        console.log('🔍 Checking for availability records with incorrect time slots...');

        // Find all availability records
        const allAvailabilities = await Availability.find({});
        console.log(`Found ${allAvailabilities.length} availability records`);

        let updatedCount = 0;
        let skippedCount = 0;

        for (const availability of allAvailabilities) {
            let needsUpdate = false;
            const updatedSlots = [];

            for (const slot of availability.timeSlots) {
                // Check if time is in early morning hours (likely UTC conversion issue)
                // Typical business hours should be between 07:00 and 21:00
                const startHour = parseInt(slot.start.split(':')[0]);
                const endHour = parseInt(slot.end.split(':')[0]);

                // If slot starts before 6 AM or ends after 10 PM, it's likely incorrect
                if (startHour < 6 || endHour > 22) {
                    console.log(`⚠️  Found suspicious slot on ${availability.date}: ${slot.start}-${slot.end}`);

                    // Try to convert from UTC to IST (assuming admin is in India)
                    // IST is UTC+5:30
                    const startDate = new Date(`1970-01-01T${slot.start}:00Z`);
                    const endDate = new Date(`1970-01-01T${slot.end}:00Z`);

                    // Add 5 hours 30 minutes for IST
                    startDate.setHours(startDate.getHours() + 5);
                    startDate.setMinutes(startDate.getMinutes() + 30);
                    endDate.setHours(endDate.getHours() + 5);
                    endDate.setMinutes(endDate.getMinutes() + 30);

                    const newStart = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;
                    const newEnd = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

                    console.log(`   Converting: ${slot.start}-${slot.end} → ${newStart}-${newEnd}`);

                    slot.start = newStart;
                    slot.end = newEnd;
                    needsUpdate = true;
                }

                updatedSlots.push(slot);
            }

            if (needsUpdate) {
                availability.timeSlots = updatedSlots;
                await availability.save();
                updatedCount++;
                console.log(`✅ Fixed availability for ${availability.date}`);
            } else {
                skippedCount++;
            }
        }

        console.log('\n📊 Summary:');
        console.log(`   Total records: ${allAvailabilities.length}`);
        console.log(`   Updated: ${updatedCount}`);
        console.log(`   Skipped: ${skippedCount}`);
        console.log('\n✨ Time slot fix completed!');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error fixing time slots:', error);
        process.exit(1);
    }
}

// Run the fix
fixTimeSlots();

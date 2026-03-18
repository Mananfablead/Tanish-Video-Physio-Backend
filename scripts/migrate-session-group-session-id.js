/**
 * Migration Script: Add groupSessionId to Existing Sessions
 * 
 * This script populates the groupSessionId field in Session documents
 * for existing group session bookings that already have groupSessionId in Booking.
 * 
 * Usage: node scripts/migrate-session-group-session-id.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ MongoDB connected successfully');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
};

const migrateSessions = async () => {
    try {
        const Booking = require('./src/models/Booking.model');
        const Session = require('./src/models/Session.model');
        
        console.log('🔍 Finding bookings with groupSessionId...');
        
        // Find all bookings that have a groupSessionId
        const bookingsWithGroup = await Booking.find({
            groupSessionId: { $exists: true, $ne: null }
        }).select('_id groupSessionId');
        
        console.log(`📊 Found ${bookingsWithGroup.length} bookings with groupSessionId`);
        
        let updatedCount = 0;
        let skippedCount = 0;
        
        for (const booking of bookingsWithGroup) {
            // Find sessions linked to this booking
            const sessions = await Session.find({
                bookingId: booking._id
            });
            
            for (const session of sessions) {
                if (session.groupSessionId) {
                    // Session already has groupSessionId
                    skippedCount++;
                    continue;
                }
                
                // Update session with groupSessionId from booking
                session.groupSessionId = booking.groupSessionId;
                await session.save();
                updatedCount++;
                
                console.log(`✅ Updated session ${session._id} with groupSessionId ${booking.groupSessionId}`);
            }
        }
        
        console.log('\n========================================');
        console.log('🎉 Migration completed successfully!');
        console.log(`📝 Updated sessions: ${updatedCount}`);
        console.log(`⏭️  Skipped (already had groupSessionId): ${skippedCount}`);
        console.log('========================================\n');
        
    } catch (error) {
        console.error('❌ Migration error:', error);
        throw error;
    }
};

// Run the migration
const runMigration = async () => {
    await connectDB();
    
    try {
        await migrateSessions();
        console.log('✅ Migration finished');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 MongoDB connection closed');
    }
};

runMigration();

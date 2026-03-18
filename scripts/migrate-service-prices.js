/**
 * Migration Script: Populate priceINR and priceUSD for existing services
 * 
 * This script migrates existing service prices to the new multi-currency format.
 * It assumes 1 USD = 83 INR conversion rate.
 * 
 * Usage: node scripts/migrate-service-prices.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import Service model
const Service = require('../src/models/Service.model');

// Conversion rate
const USD_TO_INR_RATE = 83;

async function migrateServicePrices() {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tanish-physio');
        console.log('✅ Connected to database');

        // Get all services
        const services = await Service.find({});
        console.log(`📊 Found ${services.length} services`);

        let updatedCount = 0;
        let skippedCount = 0;

        for (const service of services) {
            const originalPrice = service.priceINR || 0;

            // Skip if both prices are already set
            if (service.priceINR && service.priceUSD) {
                console.log(`⏭️  Skipped "${service.name}" - Already has both prices`);
                skippedCount++;
                continue;
            }

            // Calculate prices
            const priceINR = service.priceINR || service.price || 0;
            const priceUSD = Math.round(priceINR / USD_TO_INR_RATE);

            // Update service
            service.priceINR = priceINR;
            service.priceUSD = priceUSD;

            await service.save();

            console.log(`✅ Updated "${service.name}": ₹${priceINR} → $${priceUSD}`);
            updatedCount++;
        }

        console.log('\n🎉 Migration completed!');
        console.log(`   - Updated: ${updatedCount} services`);
        console.log(`   - Skipped: ${skippedCount} services`);

        // Close connection
        await mongoose.connection.close();
        console.log('👋 Database connection closed');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
}

// Run migration
migrateServicePrices();

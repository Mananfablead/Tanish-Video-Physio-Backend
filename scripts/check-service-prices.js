/**
 * Check Service Prices Script
 * Verifies that all services have both priceINR and priceUSD fields
 * 
 * Usage: node scripts/check-service-prices.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import Service model
const Service = require('../src/models/Service.model');

async function checkServicePrices() {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tanish-physio');
        console.log('✅ Connected to database\n');

        // Get all services
        const services = await Service.find({});
        console.log(`📊 Total services found: ${services.length}\n`);

        let validCount = 0;
        let missingINR = 0;
        let missingUSD = 0;
        let missingBoth = 0;

        console.log('SERVICE PRICE STATUS:');
        console.log('='.repeat(80));

        services.forEach((service, index) => {
            const hasINR = service.priceINR !== undefined && service.priceINR !== null;
            const hasUSD = service.priceUSD !== undefined && service.priceUSD !== null;

            if (hasINR && hasUSD) {
                console.log(`✅ ${index + 1}. "${service.name}" - ₹${service.priceINR} | $${service.priceUSD}`);
                validCount++;
            } else if (!hasINR && !hasUSD) {
                console.log(`❌ ${index + 1}. "${service.name}" - Missing BOTH priceINR and priceUSD`);
                missingBoth++;
            } else if (!hasINR) {
                console.log(`⚠️  ${index + 1}. "${service.name}" - Missing priceINR (has USD: $${service.priceUSD})`);
                missingINR++;
            } else {
                console.log(`⚠️  ${index + 1}. "${service.name}" - Missing priceUSD (has INR: ₹${service.priceINR})`);
                missingUSD++;
            }
        });

        console.log('\n' + '='.repeat(80));
        console.log('SUMMARY:');
        console.log('='.repeat(80));
        console.log(`✅ Valid (both prices): ${validCount}`);
        console.log(`❌ Missing both: ${missingBoth}`);
        console.log(`⚠️  Missing INR only: ${missingINR}`);
        console.log(`⚠️  Missing USD only: ${missingUSD}`);
        console.log(`\n📊 Total issues: ${missingBoth + missingINR + missingUSD}`);

        if (validCount === services.length) {
            console.log('\n🎉 All services have correct pricing!');
        } else {
            console.log('\n⚠️  Some services need price updates!');
            console.log('\n💡 To fix missing prices, run:');
            console.log('   node scripts/migrate-service-prices.js');
        }

        // Close connection
        await mongoose.connection.close();
        console.log('\n👋 Database connection closed');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Run check
checkServicePrices();

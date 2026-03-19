const axios = require('axios');

/**
 * Test script for IP Location API
 * Run this to verify your new API is working correctly
 */

async function testIPLocationAPI() {
    console.log('🧪 Testing Your IP Location API\n');
    console.log('='.repeat(50));

    const BASE_URL = process.env.API_URL || 'http://localhost:5000/api';

    try {
        // Test 1: Full location data
        console.log('\n📍 Test 1: Getting full location data...');
        const locationResponse = await axios.get(`${BASE_URL}/ip-location/`);

        if (locationResponse.data.success) {
            console.log('✅ SUCCESS - Full location detected:');
            console.log('   Country:', locationResponse.data.data.country_name);
            console.log('   Code:', locationResponse.data.data.country_code);
            console.log('   City:', locationResponse.data.data.city);
            console.log('   Timezone:', locationResponse.data.data.timezone);
            console.log('   Currency:', locationResponse.data.data.currency || 'N/A');
        } else {
            console.log('❌ FAILED -', locationResponse.data.message);
        }

        // Test 2: Country code only
        console.log('\n🏳️  Test 2: Getting country code only...');
        const countryResponse = await axios.get(`${BASE_URL}/ip-location/country`);

        if (countryResponse.data.success) {
            console.log('✅ SUCCESS - Country detected:');
            console.log('   Country Code:', countryResponse.data.data.country_code);
        } else {
            console.log('❌ FAILED -', countryResponse.data.message);
        }

        // Summary
        console.log('\n' + '='.repeat(50));
        console.log('📊 Test Summary:');
        console.log(`   Full Location API: ${locationResponse.data.success ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`   Country API: ${countryResponse.data.success ? '✅ PASS' : '❌ FAIL'}`);
        console.log('='.repeat(50));

        if (locationResponse.data.success && countryResponse.data.success) {
            console.log('\n🎉 All tests passed! Your IP location API is working perfectly!');
            console.log('\n💡 Next steps:');
            console.log('   1. Start your frontend: cd Tanish-Physio-Client && npm run dev');
            console.log('   2. Open browser and check console logs');
            console.log('   3. You should see "Fetching IP location from your backend API..."');
            return true;
        } else {
            console.log('\n⚠️  Some tests failed. Check the backend logs for details.');
            return false;
        }

    } catch (error) {
        console.log('\n❌ ERROR:', error.message);
        console.log('\n💡 Troubleshooting:');
        console.log('   1. Make sure backend is running: cd tanish-physio-backend && npm run dev');
        console.log('   2. Check if port 5000 is available');
        console.log('   3. Verify API_URL environment variable');
        return false;
    }
}

// Run the test
console.log('\n🚀 Starting IP Location API Test...\n');
testIPLocationAPI()
    .then(success => {
        process.exit(success ? 0 : 1);
    })
    .catch(err => {
        console.error('Test crashed:', err);
        process.exit(1);
    });

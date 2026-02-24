/**
 * Script to test WhatsApp token validation
 * Usage: node scripts/test-whatsapp-token.js <your_access_token>
 */

const { validateWhatsAppToken } = require('../src/utils/whatsapp.utils');

async function testToken() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log('Usage: node scripts/test-whatsapp-token.js <your_access_token>');
        console.log('Example: node scripts/test-whatsapp-token.js EAAGuZ...your-token-here...');
        process.exit(1);
    }

    const accessToken = args[0];

    console.log('Testing WhatsApp access token...\n');

    try {
        const result = await validateWhatsAppToken(accessToken);

        console.log('Validation Result:');
        console.log('----------------');
        console.log(`Valid: ${result.valid}`);

        if (result.valid) {
            console.log(`User ID: ${result.data.id}`);
            console.log(`User Name: ${result.data.name}`);
            console.log('\n✅ Token is valid and authenticated with Facebook API!');
        } else {
            console.log(`Error: ${result.error}`);
            console.log(`Code: ${result.code}`);
            console.log('\n❌ Token validation failed!');

            if (result.code === 190) {
                console.log('\n💡 This is typically caused by:');
                console.log('   - Expired access token');
                console.log('   - Invalid/malformed access token');
                console.log('   - Revoked permissions');
                console.log('   - Access token belongs to different app');
            }
        }
    } catch (error) {
        console.error('Unexpected error during token validation:', error.message);
    }
}

// Run the test
testToken();
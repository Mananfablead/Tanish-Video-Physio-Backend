require('dotenv').config();
const cron = require('node-cron');

// Use global fetch if available (Node 18+), otherwise use node-fetch
const fetch = globalThis.fetch || require('node-fetch');

// Configuration
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

if (!ADMIN_TOKEN) {
  console.error('❌ ADMIN_TOKEN environment variable is not set!');
  console.error('Please set ADMIN_TOKEN in your .env file');
  process.exit(1);
}

console.log('🚀 Starting Stale Payment Cleanup Cron Job...');
console.log(`📡 Backend URL: ${BACKEND_URL}`);
console.log('⏰ Schedule: Every minute (optimized - only runs when stale payments found)');
console.log('---');

// Cron job to run every minute (optimized)
cron.schedule('* * * * *', async () => {
  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  
  try {
    // First, check if there are any stale payments
    const checkResponse = await fetch(`${BACKEND_URL}/api/payments/admin/check-stale`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    let hasStalePayments = false;

    if (checkResponse.ok) {
      const checkResult = await checkResponse.json();
      hasStalePayments = checkResult.data?.count > 0;

      if (hasStalePayments) {
        console.log(`\n🔍 [${now}] Found ${checkResult.data.count} stale payment(s) - running cleanup...`);
      } else {
        console.log(`\nℹ️ [${now}] No stale payments found - skipping cleanup to reduce server load`);
        return; // Skip if no stale payments
      }
    } else {
      console.warn(`⚠️ [${now}] Could not check stale payments count, proceeding with cleanup anyway...`);
      hasStalePayments = true; // Proceed anyway if check fails
    }

    // Run the actual cleanup
    const response = await fetch(`${BACKEND_URL}/api/payments/admin/expire-stale`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({}) // Send empty JSON object
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Cleanup completed successfully!');
      console.log(`   📊 Processed: ${result.data.processed}`);
      console.log(`   ✔️ Updated: ${result.data.updated}`);
      console.log(`   ❌ Failed: ${result.data.failed}`);
      console.log(`   ⏰ Expiry Time: ${new Date(result.data.expiryTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    } else {
      console.error('❌ Cleanup failed:', result.message);
    }
  } catch (error) {
    console.error('❌ Error running cleanup:', error.message);
  }
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Received SIGINT. Gracefully shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Received SIGTERM. Gracefully shutting down...');
  process.exit(0);
});

console.log('✅ Cron job started successfully!');
console.log('💡 Press Ctrl+C to stop');
console.log('---');

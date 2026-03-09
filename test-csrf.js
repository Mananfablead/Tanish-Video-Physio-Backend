/**
 * CSRF Protection Test Script
 * 
 * This script tests the CSRF token generation and validation
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:5000/api';

// Store cookies between requests
const agent = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

async function testCsrfProtection() {
  console.log('🧪 Testing CSRF Protection Implementation\n');
  console.log('=' .repeat(50));

  try {
    // Test 1: Get CSRF Token
    console.log('\n✅ Test 1: Fetching CSRF Token...');
    const tokenResponse = await agent.get('/csrf-token');
    
    if (tokenResponse.data.success) {
      console.log('✓ CSRF Token fetched successfully');
      console.log('  Token:', tokenResponse.data.csrfToken.substring(0, 20) + '...');
    } else {
      console.log('✗ Failed to fetch CSRF token');
      return;
    }

    const csrfToken = tokenResponse.data.csrfToken;

    // Test 2: Make a POST request WITH CSRF token
    console.log('\n✅ Test 2: POST request WITH CSRF token...');
    try {
      const postWithToken = await agent.post('/contact-message', {
        name: 'Test User',
        email: 'test@example.com',
        message: 'This is a test message'
      }, {
        headers: {
          'X-CSRF-Token': csrfToken
        }
      });

      if (postWithToken.status === 200 || postWithToken.status === 201) {
        console.log('✓ POST request with CSRF token succeeded');
      } else {
        console.log('✗ POST request returned unexpected status:', postWithToken.status);
      }
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('⚠ Endpoint not found (this is okay for testing)');
      } else if (error.response?.status === 403) {
        console.log('✗ POST request failed with 403 despite having token');
      } else {
        console.log('⚠ POST request error (expected if endpoint doesn\'t exist):', error.response?.status || error.message);
      }
    }

    // Test 3: Make a POST request WITHOUT CSRF token (should fail)
    console.log('\n✅ Test 3: POST request WITHOUT CSRF token (should fail)...');
    try {
      const postWithoutToken = await agent.post('/contact-message', {
        name: 'Test User 2',
        email: 'test2@example.com',
        message: 'This should fail'
      });

      console.log('✗ SECURITY ISSUE: POST without token succeeded!');
    } catch (error) {
      if (error.response?.status === 403) {
        console.log('✓ POST request without token correctly rejected (403)');
        console.log('  Error message:', error.response.data.message);
      } else if (error.response?.status === 404) {
        console.log('⚠ Endpoint not found (can\'t validate protection)');
      } else {
        console.log('⚠ Unexpected error:', error.response?.status || error.message);
      }
    }

    // Test 4: Make a GET request (should work without token)
    console.log('\n✅ Test 4: GET request (no token required)...');
    try {
      const getResponse = await agent.get('/health');
      console.log('✓ GET request succeeded (as expected)');
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('⚠ Health endpoint not found, trying another GET...');
        try {
          await agent.get('/services');
          console.log('✓ GET request succeeded (as expected)');
        } catch (err) {
          console.log('⚠ GET request also failed:', err.response?.status || err.message);
        }
      } else {
        console.log('⚠ GET request failed:', error.response?.status || error.message);
      }
    }

    // Test 5: Verify token expiration/refresh
    console.log('\n✅ Test 5: Token refresh capability...');
    try {
      const newTokenResponse = await agent.get('/csrf-token');
      if (newTokenResponse.data.success && newTokenResponse.data.csrfToken !== csrfToken) {
        console.log('✓ New token generated successfully');
      } else if (newTokenResponse.data.csrfToken === csrfToken) {
        console.log('⚠ Token unchanged (may be session-based)');
      }
    } catch (error) {
      console.log('✗ Failed to refresh token:', error.response?.status || error.message);
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ CSRF Protection Tests Completed!\n');

  } catch (error) {
    console.error('\n❌ Test execution failed:', error.message);
    console.error('Make sure the backend server is running on http://localhost:5000');
  }
}

// Run the tests
console.log('\n📋 Note: This test requires the backend server to be running');
console.log('   Start it with: npm run dev (in Tanish-Video-Physio-Backend)\n');

testCsrfProtection();

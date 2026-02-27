const axios = require('axios');

// Test the token validation functionality
async function testTokenValidation() {
    const baseURL = 'http://localhost:5000/api';

    console.log('🔍 Testing Token Validation...\n');

    // Test credentials
    const testUsers = {
        patient: {
            email: 'patient@test.com',
            password: 'patient123'
        },
        admin: {
            email: 'admin@clinic.com',
            password: 'adminpassword123'
        }
    };

    let patientToken = null;
    let adminToken = null;

    try {
        // First, get tokens for both users
        console.log('🔐 Getting authentication tokens...\n');

        // Get patient token
        try {
            const patientResponse = await axios.post(`${baseURL}/auth/login`, {
                email: testUsers.patient.email,
                password: testUsers.patient.password,
                appType: 'client'
            });
            patientToken = patientResponse.data.data.token;
            console.log('✅ Patient token obtained\n');
        } catch (error) {
            console.log('❌ Failed to get patient token:', error.response?.data?.message || error.message, '\n');
            return;
        }

        // Get admin token
        try {
            const adminResponse = await axios.post(`${baseURL}/auth/login`, {
                email: testUsers.admin.email,
                password: testUsers.admin.password,
                appType: 'admin'
            });
            adminToken = adminResponse.data.data.token;
            console.log('✅ Admin token obtained\n');
        } catch (error) {
            console.log('❌ Failed to get admin token:', error.response?.data?.message || error.message, '\n');
            return;
        }

        // Test 1: Validate patient token without appType
        console.log('🧪 Test 1: Validate patient token without appType');
        try {
            const response = await axios.post(`${baseURL}/auth/validate-token`,
                {},
                {
                    headers: { Authorization: `Bearer ${patientToken}` }
                }
            );
            console.log('   Result: SUCCESS - Token is valid\n');
            console.log('   Response:', response.data.data);
        } catch (error) {
            console.log('   Result: FAILED -', error.response?.data?.message || error.message, '\n');
        }

        // Test 2: Validate admin token without appType
        console.log('🧪 Test 2: Validate admin token without appType');
        try {
            const response = await axios.post(`${baseURL}/auth/validate-token`,
                {},
                {
                    headers: { Authorization: `Bearer ${adminToken}` }
                }
            );
            console.log('   Result: SUCCESS - Token is valid\n');
            console.log('   Response:', response.data.data);
        } catch (error) {
            console.log('   Result: FAILED -', error.response?.data?.message || error.message, '\n');
        }

        // Test 3: Validate patient token with correct appType (client)
        console.log('🧪 Test 3: Validate patient token with correct appType (client)');
        try {
            const response = await axios.post(`${baseURL}/auth/validate-token`,
                { appType: 'client' },
                {
                    headers: { Authorization: `Bearer ${patientToken}` }
                }
            );
            console.log('   Result: SUCCESS - Token is valid for client application\n');
            console.log('   Response:', response.data.data);
        } catch (error) {
            console.log('   Result: FAILED -', error.response?.data?.message || error.message, '\n');
        }

        // Test 4: Validate admin token with correct appType (admin)
        console.log('🧪 Test 4: Validate admin token with correct appType (admin)');
        try {
            const response = await axios.post(`${baseURL}/auth/validate-token`,
                { appType: 'admin' },
                {
                    headers: { Authorization: `Bearer ${adminToken}` }
                }
            );
            console.log('   Result: SUCCESS - Token is valid for admin application\n');
            console.log('   Response:', response.data.data);
        } catch (error) {
            console.log('   Result: FAILED -', error.response?.data?.message || error.message, '\n');
        }

        // Test 5: Validate patient token with wrong appType (admin) - should fail
        console.log('🧪 Test 5: Validate patient token with wrong appType (admin) - should fail');
        try {
            const response = await axios.post(`${baseURL}/auth/validate-token`,
                { appType: 'admin' },
                {
                    headers: { Authorization: `Bearer ${patientToken}` }
                }
            );
            console.log('   Result: UNEXPECTED SUCCESS - Patient token should not be valid for admin application\n');
        } catch (error) {
            if (error.response?.status === 403) {
                console.log('   Result: SUCCESS - Patient token correctly blocked for admin application\n');
                console.log('   Error:', error.response?.data?.message);
            } else {
                console.log('   Result: UNEXPECTED ERROR -', error.response?.data?.message || error.message, '\n');
            }
        }

        // Test 6: Validate admin token with wrong appType (client) - should fail
        console.log('🧪 Test 6: Validate admin token with wrong appType (client) - should fail');
        try {
            const response = await axios.post(`${baseURL}/auth/validate-token`,
                { appType: 'client' },
                {
                    headers: { Authorization: `Bearer ${adminToken}` }
                }
            );
            console.log('   Result: UNEXPECTED SUCCESS - Admin token should not be valid for client application\n');
        } catch (error) {
            if (error.response?.status === 403) {
                console.log('   Result: SUCCESS - Admin token correctly blocked for client application\n');
                console.log('   Error:', error.response?.data?.message);
            } else {
                console.log('   Result: UNEXPECTED ERROR -', error.response?.data?.message || error.message, '\n');
            }
        }

        // Test 7: Validate with invalid token
        console.log('🧪 Test 7: Validate with invalid token');
        try {
            const response = await axios.post(`${baseURL}/auth/validate-token`,
                {},
                {
                    headers: { Authorization: 'Bearer invalid-token-here' }
                }
            );
            console.log('   Result: UNEXPECTED SUCCESS - Invalid token should be rejected\n');
        } catch (error) {
            if (error.response?.status === 403) {
                console.log('   Result: SUCCESS - Invalid token correctly rejected\n');
                console.log('   Error:', error.response?.data?.message);
            } else {
                console.log('   Result: ERROR -', error.response?.data?.message || error.message, '\n');
            }
        }

        // Test 8: Validate with no token
        console.log('🧪 Test 8: Validate with no token');
        try {
            const response = await axios.post(`${baseURL}/auth/validate-token`, {});
            console.log('   Result: UNEXPECTED SUCCESS - Request without token should be rejected\n');
        } catch (error) {
            if (error.response?.status === 401) {
                console.log('   Result: SUCCESS - Request without token correctly rejected\n');
                console.log('   Error:', error.response?.data?.message);
            } else {
                console.log('   Result: ERROR -', error.response?.data?.message || error.message, '\n');
            }
        }

        console.log('✅ All token validation tests completed!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testTokenValidation();
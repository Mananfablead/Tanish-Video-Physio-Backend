const axios = require('axios');

// Test the login isolation functionality
async function testLoginIsolation() {
    const baseURL = 'http://localhost:5000/api';

    console.log('🔍 Testing Login Isolation...\n');

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

    try {
        // Test 1: Patient trying to login to client app (should succeed)
        console.log('✅ Test 1: Patient login to client app');
        try {
            const response = await axios.post(`${baseURL}/auth/login`, {
                email: testUsers.patient.email,
                password: testUsers.patient.password,
                appType: 'client'
            });
            console.log('   Result: SUCCESS - Patient can login to client app\n');
        } catch (error) {
            console.log('   Result: FAILED -', error.response?.data?.message || error.message, '\n');
        }

        // Test 2: Patient trying to login to admin app (should fail)
        console.log('❌ Test 2: Patient login to admin app (should be blocked)');
        try {
            const response = await axios.post(`${baseURL}/auth/login`, {
                email: testUsers.patient.email,
                password: testUsers.patient.password,
                appType: 'admin'
            });
            console.log('   Result: UNEXPECTED SUCCESS - Patient should not be able to login to admin app\n');
        } catch (error) {
            if (error.response?.status === 403) {
                console.log('   Result: SUCCESS - Patient blocked from admin app\n');
            } else {
                console.log('   Result: ERROR -', error.response?.data?.message || error.message, '\n');
            }
        }

        // Test 3: Admin trying to login to admin app (should succeed)
        console.log('✅ Test 3: Admin login to admin app');
        try {
            const response = await axios.post(`${baseURL}/auth/login`, {
                email: testUsers.admin.email,
                password: testUsers.admin.password,
                appType: 'admin'
            });
            console.log('   Result: SUCCESS - Admin can login to admin app\n');
        } catch (error) {
            console.log('   Result: FAILED -', error.response?.data?.message || error.message, '\n');
        }

        // Test 4: Admin trying to login to client app (should fail)
        console.log('❌ Test 4: Admin login to client app (should be blocked)');
        try {
            const response = await axios.post(`${baseURL}/auth/login`, {
                email: testUsers.admin.email,
                password: testUsers.admin.password,
                appType: 'client'
            });
            console.log('   Result: UNEXPECTED SUCCESS - Admin should not be able to login to client app\n');
        } catch (error) {
            if (error.response?.status === 403) {
                console.log('   Result: SUCCESS - Admin blocked from client app\n');
            } else {
                console.log('   Result: ERROR -', error.response?.data?.message || error.message, '\n');
            }
        }

        // Test 5: Login without appType (should still work with warning)
        console.log('⚠️  Test 5: Login without appType (backward compatibility)');
        try {
            const response = await axios.post(`${baseURL}/auth/login`, {
                email: testUsers.patient.email,
                password: testUsers.patient.password
                // No appType specified
            });
            console.log('   Result: SUCCESS - Backward compatibility maintained\n');
        } catch (error) {
            console.log('   Result: FAILED -', error.response?.data?.message || error.message, '\n');
        }

        console.log('✅ All tests completed!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testLoginIsolation();
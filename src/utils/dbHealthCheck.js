const mongoose = require('mongoose');

/**
 * Database Health Check Utility
 * Helps diagnose MongoDB connection issues
 */

class DatabaseHealthChecker {
    static async checkConnection() {
        console.log('\n🏥 Running Database Health Check...\n');

        // Check basic connection state
        const connectionState = mongoose.connection.readyState;
        const stateMessages = {
            0: 'Disconnected',
            1: 'Connected',
            2: 'Connecting',
            3: 'Disconnecting'
        };

        console.log(`📊 Connection State: ${stateMessages[connectionState]} (${connectionState})`);

        // Check connection details
        if (connectionState === 1) {
            console.log(`🔗 Host: ${mongoose.connection.host}`);
            console.log(`📚 Database: ${mongoose.connection.name}`);
            console.log(`🆔 Port: ${mongoose.connection.port}`);

            // Test basic query
            try {
                console.log('\n🔍 Testing database connectivity...');
                const testResult = await mongoose.connection.db.admin().ping();
                console.log('✅ Database ping successful:', testResult);

                // Test a simple collection operation
                const collections = await mongoose.connection.db.listCollections().toArray();
                console.log(`📋 Found ${collections.length} collections`);

                return { healthy: true, message: 'Database connection is healthy' };
            } catch (error) {
                console.error('❌ Database operation failed:', error.message);
                return { healthy: false, message: 'Database connection established but operations failing', error };
            }
        } else {
            return { healthy: false, message: `Database not connected. State: ${stateMessages[connectionState]}` };
        }
    }

    static getConnectionInfo() {
        return {
            readyState: mongoose.connection.readyState,
            host: mongoose.connection.host,
            name: mongoose.connection.name,
            port: mongoose.connection.port,
            models: Object.keys(mongoose.models).length
        };
    }

    static async waitForConnection(maxAttempts = 10, interval = 2000) {
        console.log(`⏳ Waiting for database connection (max ${maxAttempts} attempts)...`);

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const state = mongoose.connection.readyState;
            if (state === 1) {
                console.log(`✅ Connected on attempt ${attempt}`);
                return true;
            }

            console.log(`   Attempt ${attempt}/${maxAttempts}: Connection state = ${state}`);
            await new Promise(resolve => setTimeout(resolve, interval));
        }

        console.error('⏰ Connection timeout reached');
        return false;
    }
}

module.exports = DatabaseHealthChecker;
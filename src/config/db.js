const mongoose = require('mongoose');
const config = require('../config/env');

const connectDB = async (maxRetries = 3, retryDelay = 5000) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // Connection options for better reliability and timeout handling
            const connectionOptions = {
                // Connection timeout settings
                serverSelectionTimeoutMS: 30000, // 30 seconds instead of default 30000ms
                socketTimeoutMS: 45000,          // 45 seconds
                connectTimeoutMS: 30000,         // 30 seconds

                // Buffering settings - Enable for connection stability
                bufferCommands: true,            // Enable command buffering

                // Connection pool settings
                maxPoolSize: 10,                 // Maximum number of connections
                minPoolSize: 5,                  // Minimum number of connections
                maxIdleTimeMS: 30000,            // Close connections after 30 seconds of inactivity
                waitQueueTimeoutMS: 10000,       // Wait queue timeout

                // Retry settings
                retryWrites: true,               // Enable retryable writes
                retryReads: true,                // Enable retryable reads

                // Authentication and security
                authSource: 'admin',             // Authentication database
            };

            if (attempt > 1) {
                console.log(`
🔄 Retry attempt ${attempt}/${maxRetries}...`);
            } else {
                console.log('🔄 Attempting to connect to MongoDB...');
            }
            console.log(`🔗 Connection string: ${config.MONGODB_URI.split('@')[1] || config.MONGODB_URI}`); // Hide credentials

            const conn = await mongoose.connect(config.MONGODB_URI, connectionOptions);

            // Small delay to ensure connection is fully established
            await new Promise(resolve => setTimeout(resolve, 500));

            console.log(`✅ MongoDB Connected Successfully!`);
            console.log(`   Host: ${conn.connection.host}`);
            console.log(`   Database: ${conn.connection.name}`);
            console.log(`   Connection Status: ${conn.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);

            // If successful, break out of retry loop
            return conn;
        } catch (error) {
            console.error(`
❌ Connection attempt ${attempt} failed:`);
            console.error('Error:', error.message);

            if (attempt === maxRetries) {
                console.error('\n💥 All connection attempts failed!');
                console.error('Error details:', error.message);
                console.error('Stack trace:', error.stack);
                console.error('\n🔧 Troubleshooting tips:');
                console.error('1. Check your MongoDB URI in .env file');
                console.error('2. Verify network connectivity to MongoDB Atlas');
                console.error('3. Check if MongoDB Atlas IP whitelist includes your server IP');
                console.error('4. Verify MongoDB Atlas cluster status');
                console.error('5. Check if your credentials are correct');
                throw error;
            }

            console.log(`⏳ Waiting ${retryDelay / 1000} seconds before retry...\n`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }
};

// Export connection checker utility
const isDbConnected = () => {
    return mongoose.connection.readyState === 1;
};

const waitForDbConnection = async (timeout = 30000) => {
    const startTime = Date.now();

    while (!isDbConnected()) {
        if (Date.now() - startTime > timeout) {
            throw new Error('Database connection timeout');
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    return true;
};

module.exports = connectDB;
module.exports.isDbConnected = isDbConnected;
module.exports.waitForDbConnection = waitForDbConnection;
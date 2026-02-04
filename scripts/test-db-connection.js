#!/usr/bin/env node

/**
 * Database Connection Test Script
 * Run this script to test your MongoDB connection independently
 * Usage: node scripts/test-db-connection.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function testConnection() {
    console.log('🧪 MongoDB Connection Test');
    console.log('==========================\n');

    const uri = process.env.MONGODB_URI;

    if (!uri) {
        console.error('❌ MONGODB_URI not found in environment variables');
        process.exit(1);
    }

    console.log(`🔗 Connection String: ${uri.split('@')[1] || '[HIDDEN]'}`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);

    try {
        console.log('\n🔄 Attempting connection...');

        // Connection options for testing
        const connectionOptions = {
            serverSelectionTimeoutMS: 15000, // 15 seconds for testing
            socketTimeoutMS: 20000,
            connectTimeoutMS: 15000,
            bufferCommands: false, // Disable buffering for immediate feedback
            maxPoolSize: 1,
            useUnifiedTopology: true,
            useNewUrlParser: true,
        };

        const conn = await mongoose.connect(uri, connectionOptions);

        console.log('✅ Connection Successful!');
        console.log(`   Host: ${conn.connection.host}`);
        console.log(`   Database: ${conn.connection.name}`);
        console.log(`   Port: ${conn.connection.port}`);
        console.log(`   Ready State: ${conn.connection.readyState}`);

        // Test basic operations
        console.log('\n🔍 Testing database operations...');

        // Ping test
        const pingResult = await conn.connection.db.admin().ping();
        console.log('✅ Ping test passed:', pingResult);

        // List collections
        const collections = await conn.connection.db.listCollections().toArray();
        console.log(`✅ Found ${collections.length} collections:`);
        collections.forEach((collection, index) => {
            console.log(`   ${index + 1}. ${collection.name}`);
        });

        // Test a simple query (if users collection exists)
        try {
            const usersCollection = conn.connection.db.collection('users');
            const userCount = await usersCollection.countDocuments({});
            console.log(`✅ Users collection has ${userCount} documents`);
        } catch (error) {
            console.log('ℹ️  Users collection test skipped:', error.message);
        }

        console.log('\n🎉 All tests passed! Database connection is working properly.');
        await mongoose.connection.close();
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Connection Failed!');
        console.error('Error:', error.message);

        if (error.message.includes('timed out')) {
            console.error('\n🔧 Troubleshooting Steps:');
            console.error('1. Check your internet connection');
            console.error('2. Verify MongoDB Atlas cluster is running (not paused)');
            console.error('3. Check if your IP is whitelisted in MongoDB Atlas Network Access');
            console.error('4. Verify username/password in connection string');
            console.error('5. Check firewall settings');
            console.error('6. Try connecting with MongoDB Compass to test');
        }

        process.exit(1);
    }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Run the test
testConnection();
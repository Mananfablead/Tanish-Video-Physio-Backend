const mongoose = require('mongoose');
const config = require('../config/env');

const connectDB = async () => {
    try {
        // Add connection options for better reliability
        const conn = await mongoose.connect(config.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 30000, // Increase server selection timeout to 30 seconds
            socketTimeoutMS: 45000, // Increase socket timeout
            connectTimeoutMS: 30000, // Increase connection timeout
            maxPoolSize: 10, // Maintain up to 10 socket connections
        });

        console.log(`MongoDB Connected: ${conn.connection.host}`);
        console.log(`Database: ${conn.connection.name}`);

        // Handle connection events
        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.log('MongoDB disconnected');
        });

        mongoose.connection.on('reconnected', () => {
            console.log('MongoDB reconnected');
        });

    } catch (error) {
        console.error('Database connection error:', error);
        console.error('Failed to connect to MongoDB. Please check your connection string and network.');
        process.exit(1);
    }
};

module.exports = connectDB;
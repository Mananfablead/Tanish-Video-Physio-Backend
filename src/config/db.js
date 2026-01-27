const mongoose = require('mongoose');
const config = require('./env');

const connectDB = async () => {
    try {
        console.log('Attempting to connect to MongoDB...');
        console.log('MONGODB_URI exists:', !!config.MONGODB_URI);
        console.log('Current NODE_ENV:', config.NODE_ENV);

        const conn = await mongoose.connect(config.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true, // Enable unified topology with proper timeout settings
            serverSelectionTimeoutMS: 30000, // Increase server selection timeout
            bufferCommands: false, // Disable mongoose buffering
            bufferMaxEntries: 0, // Disable mongoose buffering
            connectTimeoutMS: 30000, // Give up initial connection after 30 seconds
            socketTimeoutMS: 60000, // Close sockets after 60 seconds of inactivity
            maxPoolSize: 10, // Maintain up to 10 socket connections
        });

        console.log(`MongoDB Connected: ${conn.connection.host}`);

        // Set mongoose buffering options
        mongoose.set('bufferCommands', false);

    } catch (error) {
        console.error('Database connection error:', error);
        console.error('MONGODB_URI being used:', config.MONGODB_URI ? 'SET' : 'NOT SET');
        process.exit(1);
    }
};

module.exports = connectDB;
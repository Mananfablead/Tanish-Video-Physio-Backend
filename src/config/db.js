const mongoose = require('mongoose');
const config = require('./env');

const connectDB = async () => {
    try {
        // Configure mongoose connection options
        const mongooseOptions = {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
            socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
            bufferMaxEntries: 0, // Disable buffering
            bufferCommands: false, // Disable command buffering
            maxPoolSize: 10, // Maintain up to 10 socket connections
        };

        console.log('Attempting to connect to MongoDB...');
        console.log('Connection string:', config.MONGODB_URI.replace(/(.*?):(.*?)@/, '****:****@')); // Hide credentials

        const conn = await mongoose.connect(config.MONGODB_URI, mongooseOptions);

        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        console.log(`   Database: ${conn.connection.name}`);
        console.log(`   Port: ${conn.connection.port}`);

        // Connection event listeners
        mongoose.connection.on('error', (err) => {
            console.error('❌ MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.warn('⚠️ MongoDB disconnected');
        });

        mongoose.connection.on('reconnected', () => {
            console.log('🔄 MongoDB reconnected');
        });

        // Handle process termination
        process.on('SIGINT', async () => {
            await mongoose.connection.close();
            console.log(' MongoDB connection closed due to app termination');
            process.exit(0);
        });

    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        console.error('   Connection string:', config.MONGODB_URI.replace(/(.*?):(.*?)@/, '****:****@'));
        console.error('   Error code:', error.code);
        console.error('   Error name:', error.name);

        // Retry logic
        if (error.name === 'MongooseServerSelectionError') {
            console.log('🔄 Retrying connection in 5 seconds...');
            setTimeout(() => {
                connectDB().catch(err => {
                    console.error('❌ Retry failed:', err.message);
                    process.exit(1);
                });
            }, 5000);
        } else {
            process.exit(1);
        }
    }
};

module.exports = connectDB;
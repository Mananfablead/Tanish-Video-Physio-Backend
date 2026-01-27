const mongoose = require('mongoose');
const config = require('./env');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(config.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000,
        });

        console.log(`✅ MongoDB Connected`);
        console.log(`Host: ${conn.connection.host}`);
        console.log(`DB: ${conn.connection.name}`);

    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        process.exit(1);
    }
};

module.exports = connectDB;

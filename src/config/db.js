// const mongoose = require('mongoose');
// const config = require('./env');

// const connectDB = async () => {
//     try {
//         const conn = await mongoose.connect(config.MONGODB_URI, {
//             useNewUrlParser: true,
//             useUnifiedTopology: true
//         });
//         console.log(`MongoDB Connected: ${conn.connection.host}`);
//     } catch (error) {
//         console.error('Database connection error:', error);
//         process.exit(1);
//     }
// };

// module.exports = connectDB;

const mongoose = require('mongoose');
const config = require('./env');

mongoose.set('bufferCommands', false);

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(config.mongodb_uri, {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
        });

        console.log(`✅ MongoDB Connected: ${config.mongodb_uri}`);
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        process.exit(1); // STOP SERVER
    }
};

module.exports = connectDB;
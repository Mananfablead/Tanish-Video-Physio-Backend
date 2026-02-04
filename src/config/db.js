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

const connectDB = async () => {
    try {
        // 🔥 IMPORTANT: buffering off (timeout fix)
        mongoose.set('bufferCommands', false);

        const conn = await mongoose.connect(config.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 15000     // ✅ Atlas / Hostinger safe
        });

        console.log('✅ MongoDB Connected');
        console.log(`📦 Database Name: ${conn.connection.name}`);
        console.log(`🌍 Host: ${conn.connection.host}`);
    } catch (error) {
        console.error('❌ Database connection error:', error.message);
        process.exit(1);
    }
};

module.exports = connectDB;

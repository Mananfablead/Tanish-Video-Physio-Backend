const mongoose = require('mongoose');
require('dotenv').config();

// Import your User model
const User = require('../src/models/User.model.js');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/physio', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', async () => {
  console.log('Connected to MongoDB');

  try {
    // Find the specific user
    const user = await User.findById("697361bec8c39422bb3d3eec");
    
    if (user && user.doctorProfile && user.doctorProfile.certificationNames) {
      console.log('Current certification names in database:');
      console.log(JSON.stringify(user.doctorProfile.certificationNames, null, 2));
      console.log('Type:', typeof user.doctorProfile.certificationNames);
      console.log('Is Array:', Array.isArray(user.doctorProfile.certificationNames));
    } else {
      console.log('User or doctorProfile not found');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
});
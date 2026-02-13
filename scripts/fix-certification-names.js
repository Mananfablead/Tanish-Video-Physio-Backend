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
    // Find all users with doctorProfile
    const users = await User.find({ 
      'doctorProfile.certificationNames': { $exists: true, $ne: [] } 
    });

    console.log(`Found ${users.length} users with certification names`);

    for (const user of users) {
      if (user.doctorProfile && user.doctorProfile.certificationNames) {
        const originalNames = user.doctorProfile.certificationNames;
        const flattenedNames = [];
        
        const processItem = (item) => {
          if (typeof item === 'string') {
            // If it's a string, check if it needs JSON parsing
            if (item.startsWith('[') || item.startsWith('{')) {
              try {
                const parsed = JSON.parse(item);
                if (Array.isArray(parsed)) {
                  parsed.forEach(processItem);
                } else if (typeof parsed === 'string') {
                  flattenedNames.push(parsed);
                }
              } catch (e) {
                flattenedNames.push(item);
              }
            } else {
              flattenedNames.push(item);
            }
          } else if (Array.isArray(item)) {
            item.forEach(processItem);
          }
        };

        originalNames.forEach(processItem);
        const cleanNames = flattenedNames.filter(name => name && name.trim());

        // Always update to ensure clean data
        if (true) {
          console.log(`Updating user ${user.email}:`);
          console.log('  Before:', JSON.stringify(originalNames));
          console.log('  After: ', JSON.stringify(cleanNames));
          
          user.doctorProfile.certificationNames = cleanNames;
          await user.save();
          console.log('  ✓ Updated successfully\n');
        }
      }
    }

    console.log('All certification names have been cleaned up!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
});
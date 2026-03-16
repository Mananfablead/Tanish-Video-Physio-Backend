// Generate Admin Token Script
require('dotenv').config();
const jwt = require('jsonwebtoken');

// Use the same JWT_SECRET from your .env file
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_here';

// Generate admin token with REAL admin user ID
const adminToken = jwt.sign(
  {
    userId: '699c38d410b01dd502682e5f', // Real admin user ID from database
    role: 'admin',
    email: 'admin@clinic.com'
  },
  JWT_SECRET,
  { expiresIn: '365d' } // Valid for 1 year
);

console.log('\n🔑 Your ADMIN_TOKEN is:\n');
console.log('=' .repeat(80));
console.log(adminToken);
console.log('=' .repeat(80));
console.log('\n📝 Copy this token and update it in your .env file:\n');
console.log(`ADMIN_TOKEN=${adminToken}\n`);

const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const SubscriptionPlan = require('../src/models/SubscriptionPlan.model.js');

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
    // Find all subscription plans
    const plans = await SubscriptionPlan.find({}).select('planId name price price_inr price_usd duration status session_type');
    console.log('All subscription plans:');
    plans.forEach(plan => {
      console.log(`- ${plan.planId}: ${plan.name} - Base:₹${plan.price}, INR:₹${plan.price_inr}, USD:$${plan.price_usd} (${plan.duration}) [${plan.status}] session_type:${plan.session_type}`);
    });
    
    console.log('\nActive subscription plans:');
    const activePlans = await SubscriptionPlan.find({ status: 'active' }).select('planId name price price_inr price_usd duration session_type');
    activePlans.forEach(plan => {
      console.log(`- ${plan.planId}: ${plan.name} - Base:₹${plan.price}, INR:₹${plan.price_inr}, USD:$${plan.price_usd} (${plan.duration}) session_type:${plan.session_type}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
});
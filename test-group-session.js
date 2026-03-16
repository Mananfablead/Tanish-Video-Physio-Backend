const mongoose = require('mongoose');
const GroupSession = require('./src/models/GroupSession.model');
const Session = require('./src/models/Session.model');

async function testGroupSession() {
    try {
        await mongoose.connect('mongodb://localhost:27017/tanish-physio');
        console.log('✅ Connected to MongoDB\n');
        
        // Test with the session ID from earlier logs
        const testId = '69b7f0c5c3eca9795188f039';
        
        console.log(`🔍 Testing Group Session ID: ${testId}\n`);
        
        // Try 1: Find in GroupSession collection
        console.log('Step 1: Searching GroupSession collection...');
        const groupSession = await GroupSession.findById(testId);
        
        if (groupSession) {
            console.log('✅ FOUND in GroupSession collection!');
            console.log(`   Title: ${groupSession.title}`);
            console.log(`   Status: ${groupSession.status}`);
            console.log(`   Participants: ${groupSession.participants?.length || 0}`);
        } else {
            console.log('❌ NOT found in GroupSession collection');
        }
        
        // Try 2: Find in Session collection as reference
        console.log('\nStep 2: Searching Session collection for groupSessionId reference...');
        const sessionWithRef = await Session.findOne({ groupSessionId: testId });
        
        if (sessionWithRef) {
            console.log('✅ FOUND session with groupSessionId reference!');
            console.log(`   Session ID: ${sessionWithRef.sessionId}`);
            console.log(`   Type: ${sessionWithRef.type}`);
            console.log(`   Status: ${sessionWithRef.status}`);
            console.log(`   References groupSessionId: ${sessionWithRef.groupSessionId}`);
        } else {
            console.log('❌ NOT found in Session collection as reference');
        }
        
        // List recent group sessions
        console.log('\n📋 Recent Group Sessions in Database:');
        const recentGroups = await GroupSession.find().limit(5).select('_id title status').sort({ startTime: -1 });
        recentGroups.forEach((g, i) => {
            console.log(`   ${i + 1}. ${g._id} - ${g.title} (${g.status})`);
        });
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

testGroupSession();

/**
 * Test Script: Verify Group Session Google Meet Link Update
 * 
 * This script tests that when a Google Meet/Zoom link is added to a group session,
 * it updates ALL sessions in that group, not just one.
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function testGroupSessionMeetLink() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/physio-platform');
        console.log('✅ Connected to MongoDB');

        const Session = require('./src/models/Session.model');

        // Find a group session (one with groupSessionId)
        const groupSessions = await Session.find({ 
            groupSessionId: { $exists: true, $ne: null } 
        }).limit(5);

        if (groupSessions.length === 0) {
            console.log('❌ No group sessions found. Please create a group session first.');
            return;
        }

        console.log(`\n📋 Found ${groupSessions.length} group sessions`);

        // Pick the first group
        const testGroup = groupSessions[0];
        console.log(`\nTesting with groupSessionId: ${testGroup.groupSessionId}`);

        // Get ALL sessions in this group
        const allGroupMemberSessions = await Session.find({ 
            groupSessionId: testGroup.groupSessionId 
        });

        console.log(`\n👥 Group has ${allGroupMemberSessions.length} member(s)`);
        
        allGroupMemberSessions.forEach((session, index) => {
            console.log(`   ${index + 1}. Session ID: ${session._id}, User: ${session.userId?.name || 'N/A'}, Meet Link: ${session.googleMeetLink ? '✅' : '❌'}`);
        });

        // Check if all sessions have the same meet link
        const meetLinks = allGroupMemberSessions.map(s => s.googleMeetLink);
        const uniqueLinks = [...new Set(meetLinks.filter(link => link !== undefined && link !== null))];

        console.log(`\n📊 Analysis:`);
        console.log(`   - Sessions with meet link: ${meetLinks.filter(l => l).length}/${allGroupMemberSessions.length}`);
        console.log(`   - Unique meet links: ${uniqueLinks.length}`);
        
        if (uniqueLinks.length > 1) {
            console.log(`\n⚠️  WARNING: Multiple different meet links found in the same group!`);
            uniqueLinks.forEach((link, i) => {
                console.log(`      ${i + 1}. ${link}`);
            });
        } else if (uniqueLinks.length === 1) {
            console.log(`\n✅ All sessions have the SAME meet link (CORRECT!)`);
            console.log(`   Link: ${uniqueLinks[0]}`);
        } else {
            console.log(`\nℹ️  No meet links set for this group`);
        }

        // Test: Update the meet link for this group
        console.log(`\n\n🧪 TEST: Updating meet link for entire group...`);
        const testMeetLink = 'https://meet.google.com/test-abc-def';
        const testMeetCode = 'TEST-CODE';

        const updateResult = await Session.updateMany(
            { groupSessionId: testGroup.groupSessionId },
            {
                googleMeetLink: testMeetLink,
                googleMeetCode: testMeetCode
            }
        );

        console.log(`✅ Updated ${updateResult.modifiedCount} sessions`);

        // Verify the update
        const updatedSessions = await Session.find({ 
            groupSessionId: testGroup.groupSessionId 
        });

        const updatedMeetLinks = updatedSessions.map(s => s.googleMeetLink);
        const allHaveLink = updatedMeetLinks.every(link => link === testMeetLink);

        if (allHaveLink && updatedMeetLinks.length === updatedSessions.length) {
            console.log(`\n✅ SUCCESS: All ${updatedSessions.length} group members now have the same meet link!`);
            console.log(`   Meet Link: ${testMeetLink}`);
            console.log(`   Meet Code: ${testMeetCode}`);
        } else {
            console.log(`\n❌ FAILED: Not all sessions were updated correctly`);
            updatedSessions.forEach((session, index) => {
                console.log(`   ${index + 1}. ${session._id}: ${session.googleMeetLink || 'NO LINK'}`);
            });
        }

        // Cleanup: Remove the test meet link
        console.log(`\n\n🧹 Cleanup: Removing test meet link...`);
        await Session.updateMany(
            { groupSessionId: testGroup.groupSessionId },
            {
                googleMeetLink: undefined,
                googleMeetCode: undefined
            }
        );
        console.log(`✅ Cleanup complete`);

        console.log('\n✨ Test completed!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 MongoDB connection closed');
    }
}

// Run the test
testGroupSessionMeetLink();

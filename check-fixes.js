// Quick diagnostic to check if backend has the latest fixes
const fs = require('fs');
const path = require('path');

const socketFilePath = path.join(__dirname, 'src', 'sockets', 'videoCall.socket.js');
const content = fs.readFileSync(socketFilePath, 'utf8');

console.log('🔍 Checking backend socket file for fixes...\n');

// Check for the group session lookup fix
const hasGroupSessionLookup = content.includes('Session.findOne({ groupSessionId: groupSessionId })');
const hasProperFallback = content.includes('Successfully retrieved group session via Session reference');

console.log('✅ Fix #1 - Group session fallback lookup:');
console.log(`   Found in code: ${hasGroupSessionLookup ? 'YES ✓' : 'NO ✗'}`);
console.log(`   Has proper fallback: ${hasProperFallback ? 'YES ✓' : 'NO ✗'}`);

// Check for error message variations
const hasSessionNotFound = content.includes("socket.emit('error', { message: 'Session not found");
const hasGroupSessionNotFound = content.includes("socket.emit('error', { message: 'Group session not found");

console.log('\n📊 Error messages:');
console.log(`   "Session not found": ${hasSessionNotFound ? 'YES' : 'NO'}`);
console.log(`   "Group session not found": ${hasGroupSessionNotFound ? 'YES' : 'NO'}`);

if (hasGroupSessionLookup && hasProperFallback) {
    console.log('\n✅ BACKEND HAS THE LATEST FIXES');
    console.log('👉 You just need to RESTART the server for changes to take effect\n');
} else {
    console.log('\n❌ BACKEND IS MISSING FIXES');
    console.log('👉 The videoCall.socket.js file needs to be updated\n');
}

process.exit(0);

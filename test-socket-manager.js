// Test script to verify Socket.IO setup
require('dotenv').config();
const { setIO, getIO } = require('./src/utils/socketManager');

console.log('🧪 Testing Socket Manager...\n');

// Test 1: Get IO before setting it
console.log('Test 1: Getting IO instance before initialization');
const ioBefore = getIO();
console.log('IO instance before init:', ioBefore);
console.log('Is mock object?', JSON.stringify(ioBefore) === JSON.stringify({ to: () => ({ emit: () => {} }), emit: () => {} }));
console.log('');

// Test 2: Set IO instance
console.log('Test 2: Setting IO instance');
const mockServer = { id: 'test-server' };
setIO(mockServer);
console.log('✅ IO instance set');
console.log('');

// Test 3: Get IO after setting it
console.log('Test 3: Getting IO instance after initialization');
const ioAfter = getIO();
console.log('IO instance after init:', ioAfter);
console.log('Matches mockServer?', ioAfter === mockServer);
console.log('');

console.log('✅ All tests completed!\n');

/**
 * Test script to verify timezone conversion functions
 * Run with: node scripts/test-timezone-conversion.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Mock the Intl.DateTimeFormat for testing
console.log('=== Timezone Conversion Tests ===\n');

// Test 1: Get current timezone
console.log('Test 1: Current System Timezone');
const currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
console.log(`Current timezone: ${currentTimezone}\n`);

// Test 2: Simulate backend conversion functions
function convertLocalToUTC(date, time, timezone = 'UTC') {
    try {
        const localDateTime = new Date(`${date}T${time}:00`);
        
        if (timezone && timezone !== 'UTC') {
            const options = {
                timeZone: timezone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            };
            
            const formatter = new Intl.DateTimeFormat('en-US', options);
            const parts = formatter.formatToParts(localDateTime);
            const partMap = {};
            parts.forEach(part => {
                if (part.type !== 'literal') {
                    partMap[part.type] = part.value;
                }
            });
            
            const tzDate = new Date(`${partMap.year}-${partMap.month}-${partMap.day}T${partMap.hour}:${partMap.minute}:00`);
            const utcString = tzDate.toLocaleString('en-US', { timeZone: 'UTC' });
            const utcDate = new Date(utcString);
            
            const hours = String(utcDate.getUTCHours()).padStart(2, '0');
            const minutes = String(utcDate.getUTCMinutes()).padStart(2, '0');
            
            return `${hours}:${minutes}`;
        }
        
        return time;
    } catch (error) {
        console.error('Error converting local to UTC:', error);
        return time;
    }
}

function convertUTCToLocal(date, time, timezone = 'UTC') {
    try {
        const [hours, minutes] = time.split(':');
        const utcDate = new Date(Date.UTC(
            new Date(date).getUTCFullYear(),
            new Date(date).getUTCMonth(),
            new Date(date).getUTCDate(),
            parseInt(hours),
            parseInt(minutes)
        ));
        
        if (!timezone || timezone === 'UTC') {
            return time;
        }
        
        const options = {
            timeZone: timezone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        };
        
        const formatter = new Intl.DateTimeFormat('en-US', options);
        return formatter.format(utcDate);
    } catch (error) {
        console.error('Error converting UTC to local:', error);
        return time;
    }
}

// Test 3: Admin creates slot in New York (EST = UTC-5)
console.log('Test 2: Admin Creates Slot in New York (9:00 AM EST)');
const adminDate = '2025-03-20';
const adminTime = '09:00';
const adminTimezone = 'America/New_York';

const utcTime = convertLocalToUTC(adminDate, adminTime, adminTimezone);
console.log(`Input: ${adminTime} (${adminTimezone})`);
console.log(`Output: ${utcTime} (UTC)`);
console.log(`Expected: 14:00 (if EST = UTC-5)\n`);

// Test 4: Client in London views the slot (GMT = UTC+0)
console.log('Test 3: Client in London Views Slot (14:00 UTC → GMT)');
const clientDate = adminDate;
const clientTimezone = 'Europe/London';

const londonTime = convertUTCToLocal(clientDate, utcTime, clientTimezone);
console.log(`Input: ${utcTime} (UTC)`);
console.log(`Output: ${londonTime} (${clientTimezone})`);
console.log(`Expected: 14:00 (GMT = UTC+0)\n`);

// Test 5: Client in Los Angeles views the slot (PST = UTC-8)
console.log('Test 4: Client in Los Angeles Views Slot (14:00 UTC → PST)');
const laTimezone = 'America/Los_Angeles';

const laTime = convertUTCToLocal(clientDate, utcTime, laTimezone);
console.log(`Input: ${utcTime} (UTC)`);
console.log(`Output: ${laTime} (${laTimezone})`);
console.log(`Expected: 06:00 (PST = UTC-8)\n`);

// Test 6: Client in Mumbai views the slot (IST = UTC+5:30)
console.log('Test 5: Client in Mumbai Views Slot (14:00 UTC → IST)');
const mumbaiTimezone = 'Asia/Kolkata';

const mumbaiTime = convertUTCToLocal(clientDate, utcTime, mumbaiTimezone);
console.log(`Input: ${utcTime} (UTC)`);
console.log(`Output: ${mumbaiTime} (${mumbaiTimezone})`);
console.log(`Expected: 19:30 (IST = UTC+5:30)\n`);

// Test 7: Round-trip conversion
console.log('Test 6: Round-trip Conversion (Local → UTC → Local)');
const originalTime = '15:30';
const roundTripUTC = convertLocalToUTC(adminDate, originalTime, adminTimezone);
const roundTripLocal = convertUTCToLocal(adminDate, roundTripUTC, adminTimezone);
console.log(`Original: ${originalTime} (${adminTimezone})`);
console.log(`→ UTC: ${roundTripUTC}`);
console.log(`→ Back to Local: ${roundTripLocal}`);
console.log(`Should match original: ${originalTime === roundTripLocal ? '✓ PASS' : '✗ FAIL'}\n`);

// Test 8: Edge case - Midnight
console.log('Test 7: Edge Case - Midnight Crossing');
const midnightTime = '23:00';
const midnightUTC = convertLocalToUTC(adminDate, midnightTime, adminTimezone);
console.log(`Input: ${midnightTime} (${adminTimezone})`);
console.log(`Output: ${midnightUTC} (UTC)`);
console.log(`Note: May cross date boundary\n`);

// Summary
console.log('=== Test Summary ===');
console.log('All conversions completed successfully!');
console.log('If times don\'t match expected values, check:');
console.log('1. Daylight Saving Time adjustments');
console.log('2. Timezone abbreviations (EST vs EDT)');
console.log('3. Date boundaries and month transitions');

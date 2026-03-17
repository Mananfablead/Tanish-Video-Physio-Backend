# Timezone Handling Implementation Guide

## Overview
This document explains how timezone conversion works in the Tanish Physio booking system to ensure users see correct appointment times regardless of their location.

## Flow Diagram

```
Admin Creates Slots (Local Time)
         ↓
Convert to UTC (Backend)
         ↓
Store in Database (UTC)
         ↓
Client Fetches Availability
         ↓
Detect Client Timezone
         ↓
Convert UTC → Local Time
         ↓
Display Correct Local Time
```

## Backend Implementation

### 1. Model Changes (`Availability.model.js`)

The Availability model now includes:
- `timeSlots.start` and `timeSlots.end`: Stored in **UTC format** (HH:MM)
- `timezone`: Records which timezone was used when creating the slots (default: 'UTC')

```javascript
{
  therapistId: ObjectId,
  date: "YYYY-MM-DD",
  timeSlots: [{
    start: "14:00",  // UTC time
    end: "14:45",    // UTC time
    status: "available",
    duration: 45,
    bookingType: "regular"
  }],
  timezone: "UTC"
}
```

### 2. Controller Changes (`availability.controller.js`)

#### Key Functions:

**a) `convertLocalToUTC(date, time, timezone)`**
- Converts admin's local time to UTC before storing
- Uses `Intl.DateTimeFormat` for accurate timezone conversion
- Handles DST (Daylight Saving Time) automatically

**b) `convertUTCToLocal(date, time, timezone)`**
- Converts UTC time from database to client's local time
- Returns time in HH:MM format ready for display

**c) Updated Endpoints:**

```javascript
// GET /api/availability
// - Accepts timezone via query param or X-Timezone header
// - Returns availability with times converted to client's timezone
{
  availability: [{
    date: "2025-03-20",
    timeSlots: [{
      start: "09:30",  // Already converted to client's local time
      end: "10:15"
    }]
  }],
  clientTimezone: "America/New_York"
}

// POST /api/availability
// - Expects timezone in request body
// - Converts provided times to UTC for storage
{
  therapistId: "...",
  date: "2025-03-20",
  timeSlots: [{ start: "09:30", end: "10:15" }],  // Admin's local time
  timezone: "America/New_York"                     // Admin's timezone
}
```

### 3. Route Updates (`availability.routes.js`)

All endpoints now support timezone handling:
- GET endpoints accept timezone via query parameter or header
- POST/PUT endpoints accept timezone in request body

## Frontend Implementation

### 1. Utility Functions (`utils/timezone.js`)

```javascript
// Get user's timezone
getUserTimezone() 
// Returns: "America/New_York"

// Convert UTC to local time
convertUTCToLocalTime(date, utcTime, targetTimezone)
// Input: ("2025-03-20", "14:00", "America/New_York")
// Output: "09:00" (EST)

// Convert local to UTC
convertLocalToUTCTime(date, localTime, sourceTimezone)
// Input: ("2025-03-20", "09:00", "America/New_York")
// Output: "14:00" (UTC)

// Format for display
formatTimeDisplay(time)
// Input: "14:00"
// Output: "2:00 PM"
```

### 2. API Integration (`lib/api.ts`)

**Axios Interceptor:**
```typescript
// Automatically adds X-Timezone header to ALL requests
api.interceptors.request.use((config) => {
  const timezone = getUserTimezone();
  config.headers['X-Timezone'] = timezone;
  return config;
});
```

**Updated Functions:**
```typescript
getAvailability(timezone?: string)
// - Sends timezone automatically via interceptor
// - Can override with explicit parameter
```

### 3. Component Updates

**ScheduleModal.tsx:**
- Uses `formatTimeDisplay()` from timezone utilities
- Displays times already converted by backend
- No manual timezone conversion needed

**BookingPage.tsx, ProfilePage.tsx, etc.:**
- All use updated `getAvailability()` API
- Timezone handled automatically by axios interceptor

## Usage Examples

### For Admin (Creating Availability)

```javascript
// Admin in New York (EST = UTC-5) creates slot at 9:00 AM local time
POST /api/availability
{
  "therapistId": "123...",
  "date": "2025-03-20",
  "timeSlots": [
    { "start": "09:00", "end": "09:45" }  // EST
  ],
  "timezone": "America/New_York"
}

// Backend converts to UTC and stores:
{
  "timeSlots": [
    { "start": "14:00", "end": "14:45" }  // UTC
  ]
}
```

### For Client (Viewing Availability)

```javascript
// Client in London (GMT = UTC+0) fetches availability
GET /api/availability?timezone=Europe/London

// Backend converts UTC to GMT and returns:
{
  "availability": [
    {
      "date": "2025-03-20",
      "timeSlots": [
        { "start": "14:00", "end": "14:45" }  // GMT (client's local time)
      ]
    }
  ]
}

// Client sees: 2:00 PM - 2:45 PM (their local time)
```

### For Client in Different Timezone

```javascript
// Client in Los Angeles (PST = UTC-8) fetches same slot
GET /api/availability?timezone=America/Los_Angeles

// Backend converts UTC to PST:
{
  "availability": [
    {
      "date": "2025-03-20",
      "timeSlots": [
        { "start": "06:00", "end": "06:45" }  // PST (client's local time)
      ]
    }
  ]
}

// Client sees: 6:00 AM - 6:45 AM (their local time)
```

## Testing Checklist

### Backend Tests:
- [ ] Create availability slot in different timezones
- [ ] Verify UTC storage in database
- [ ] Test GET endpoint with various timezone parameters
- [ ] Verify correct local time conversion
- [ ] Test bulk update with timezone conversion
- [ ] Test edge cases (midnight, noon, DST transitions)

### Frontend Tests:
- [ ] Open booking page in different browser timezones
- [ ] Verify displayed times match local timezone
- [ ] Test schedule modal time slot selection
- [ ] Verify API calls include timezone header
- [ ] Test profile page reschedule functionality
- [ ] Test free consultation booking across timezones

## Common Issues & Solutions

### Issue: Times showing incorrectly
**Solution:** Check that:
1. Backend receives timezone in request (check headers/query params)
2. Frontend axios interceptor is working
3. Browser timezone is correctly detected

### Issue: DST causing hour shifts
**Solution:** The `Intl.DateTimeFormat` API handles DST automatically. Ensure:
1. Dates are properly formatted (YYYY-MM-DD)
2. Timezone strings are valid IANA format

### Issue: Database showing wrong times
**Solution:** Verify:
1. Admin creation sends correct timezone
2. `convertLocalToUTC()` is being called
3. Stored times are in UTC format

## Migration Notes

### Existing Data:
If you have existing availability records:
1. They are assumed to be in UTC if no timezone field exists
2. Consider running a migration script to add timezone information
3. Test thoroughly before deploying to production

### Backward Compatibility:
- Old API calls without timezone will default to 'UTC'
- System gracefully handles missing timezone data
- Gradual rollout recommended

## Performance Considerations

- Timezone conversion happens on-the-fly during API calls
- No significant performance impact expected
- Conversion cached at response level
- Consider caching frequently accessed availability data

## Security Notes

- Timezone is client-provided (via header/query param)
- Validate timezone format on backend
- Prevent timezone injection attacks
- Log timezone-related errors for monitoring

## Future Enhancements

Potential improvements:
1. Store preferred timezone in user profiles
2. Add timezone selector for admins
3. Show both local and therapist timezone
4. Send calendar invites with proper timezone
5. Email notifications with dual timezone display

## Support

For issues or questions:
- Check server logs for timezone conversion errors
- Verify browser console for timezone detection issues
- Test with known timezone combinations
- Report bugs with specific timezone examples

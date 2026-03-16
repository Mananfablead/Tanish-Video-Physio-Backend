# Group Session Join Link API Documentation

## Overview
This feature allows multiple users with different bookings but the same `groupSessionId` to join a single group video call with an admin/therapist.

## How It Works

### 1. Booking Creation Flow
When a user creates a **subscription-covered** booking for a **group session**:

1. A **Booking** document is created with a `groupSessionId` field
2. A **GroupSession** document is created (or reused if it already exists for that time slot)
3. A **Session** document is created, also linked to the same `groupSessionId`

### 2. Data Structure

#### Booking Document
```javascript
{
  _id: "69b7daefb85084c46e53aa47",
  serviceId: "...",
  therapistId: "...",
  userId: "699ee50549f642df8aecbba2",
  clientName: "Manan Fablead",
  date: "2026-03-16",
  time: "16:15",
  bookingType: "subscription-covered",
  groupSessionId: "69b7daefb85084c46e53aa4c"  // ← Links to GroupSession
}
```

#### GroupSession Document
```javascript
{
  _id: "69b7daefb85084c46e53aa4c",
  title: "Group Session - Dr. Khhushbu Joshi - 16:15",
  therapistId: "699c38d410b01dd502682e5f",
  startTime: "2026-03-16T16:15:00.000Z",
  endTime: "2026-03-16T17:00:00.000Z",
  maxParticipants: 5,
  participants: [
    {
      userId: "699ee50549f642df8aecbba2",
      bookingId: "69b7daefb85084c46e53aa47",
      status: "accepted",
      joinedAt: "2026-03-16T10:26:55.192Z"
    },
    {
      userId: "69b7aee013062926427d097b",
      bookingId: "69b7dafcb85084c46e53ab75",
      status: "accepted",
      joinedAt: "2026-03-16T10:27:08.949Z"
    }
  ],
  status: "scheduled"
}
```

#### Session Document
```javascript
{
  _id: "69b7daefb85084c46e53aa51",
  bookingId: "69b7daefb85084c46e53aa47",
  subscriptionId: "...",
  therapistId: "...",
  userId: "699ee50549f642df8aecbba2",
  sessionId: "session_1773656815186_z4ilzipgr",
  date: "2026-03-16",
  time: "16:15",
  sessionType: "group",
  maxParticipants: 5,
  groupSessionId: "69b7daefb85084c46e53aa4c",  // ← Links to same GroupSession
  status: "scheduled"
}
```

### 3. Multiple Users Join Same Group Call

All users with bookings that have the **same `groupSessionId`** can join the same video call room.

#### API Endpoint: Get Join Link
```
GET /api/group-session/join/:groupSessionId
```

**Request:**
- Headers: `Authorization: Bearer <token>`
- Params: `groupSessionId` (e.g., `69b7daefb85084c46e53aa4c`)

**Response:**
```json
{
  "success": true,
  "data": {
    "groupSessionId": "69b7daefb85084c46e53aa4c",
    "sessionId": "group_69b7daefb85084c46e53aa4c",
    "joinLink": "/video-call/group_69b7daefb85084c46e53aa4c/participant?token=eyJhbGci...",
    "therapistJoinLink": "/video-call/group_69b7daefb85084c46e53aa4c/therapist?token=eyJhbGci...",
    "title": "Group Session - Dr. Khhushbu Joshi - 16:15",
    "startTime": "2026-03-16T16:15:00.000Z",
    "endTime": "2026-03-16T17:00:00.000Z",
    "therapist": {
      "_id": "699c38d410b01dd502682e5f",
      "name": "Dr. Khhushbu Joshi"
    },
    "isActiveCall": false,
    "status": "scheduled",
    "currentUserRole": "participant"
  }
}
```

## Implementation Details

### Backend Changes Made

#### 1. Session Model Update (`src/models/Session.model.js`)
Added `groupSessionId` field to link sessions to a group session:
```javascript
groupSessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GroupSession',
    description: 'Links multiple session instances to the same group call'
}
```

#### 2. Booking Controller Update (`src/controllers/bookings.controller.js`)
Updated the auto-session creation logic to include `groupSessionId` when creating sessions for group bookings:
- Finds existing GroupSession for the time slot
- Links the new Session to the GroupSession

#### 3. GroupSession Controller Update (`src/controllers/groupSession.controller.js`)
Added new function `getGroupSessionJoinLink`:
- Validates user authorization (therapist, participant, or admin)
- Checks if session is within valid time window
- Generates JWT tokens for video call authentication
- Returns appropriate join links based on user role

#### 4. GroupSession Routes Update (`src/routes/groupSession.route.js`)
Added new route:
```javascript
router.get('/join/:groupSessionId', auth, getGroupSessionJoinLink);
```

## Usage Example

### For Frontend Integration

```javascript
// Get user's booking
const booking = await fetch(`/api/bookings/${bookingId}`);
const { groupSessionId } = booking.data;

// Get join link for the group session
const joinLinkResponse = await fetch(`/api/group-session/join/${groupSessionId}`, {
  headers: {
    'Authorization': `Bearer ${userToken}`
  }
});

const { data } = await joinLinkResponse.json();
const joinLink = data.joinLink;

// Navigate to video call
window.location.href = joinLink;
```

### Admin Dashboard View

Admin can see all participants in a group session:

```javascript
// Get all group sessions with participants
const sessions = await fetch('/api/group-session/admin/all-sessions', {
  headers: {
    'Authorization': `Bearer ${adminToken}`
  }
});

// Each session will show:
{
  "_id": "69b7daefb85084c46e53aa4c",
  "title": "Group Session - Dr. Khhushbu Joshi - 16:15",
  "currentParticipants": 2,
  "maxParticipants": 5,
  "isFull": false,
  "participants": [
    {
      "userId": "699ee50549f642df8aecbba2",
      "name": "Manan Fablead",
      "email": "manan@example.com",
      "serviceName": "Voluptatem ut quia e",
      "bookingStatus": "confirmed",
      "joinedGroupAt": "2026-03-16T10:26:55.192Z"
    },
    {
      "userId": "69b7aee013062926427d097b",
      "name": "Manan",
      "email": "manan2@example.com",
      "serviceName": "Voluptatem ut quia e",
      "bookingStatus": "confirmed",
      "joinedGroupAt": "2026-03-16T10:27:08.949Z"
    }
  ]
}
```

## Key Features

1. **Shared Video Room**: All users with the same `groupSessionId` join the same video call room
2. **Role-Based Access**: Different join links for therapists/admins vs participants
3. **Time Window Validation**: Users can only join 30 minutes before to 1 hour after the session time
4. **Automatic Participant Tracking**: System tracks who has joined/left the call
5. **Admin Oversight**: Admin can view all participants and their booking details

## Benefits

- ✅ Multiple users can book the same group session time slot
- ✅ All participants automatically linked to the same video call
- ✅ Admin/therapist can see all booked participants before starting the call
- ✅ Scalable: supports up to 50 participants per group session (configurable)
- ✅ Secure: JWT-based authentication for video call access

## Testing

To test the implementation:

1. Create two different user accounts with active subscriptions
2. Book both users for the same therapist at the same time slot (group session type)
3. Verify both bookings have the same `groupSessionId`
4. Call `GET /api/group-session/join/:groupSessionId` for each user
5. Both users should get the same `sessionId` but different personalized `joinLink`
6. Both users should be able to join the same video call room

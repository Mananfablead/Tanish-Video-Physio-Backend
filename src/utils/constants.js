// User roles
const USER_ROLES = {
    ADMIN: 'admin',
    PATIENT: 'patient'
};

// Booking statuses
const BOOKING_STATUSES = {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    CANCELLED: 'cancelled',
    COMPLETED: 'completed'
};

// Session statuses
const SESSION_STATUSES = {
    SCHEDULED: 'scheduled',
    LIVE: 'live',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
};

// Payment statuses
const PAYMENT_STATUSES = {
    CREATED: 'created',
    FAILED: 'failed',
    PAID: 'paid'
};

// Therapist statuses
const THERAPIST_STATUSES = {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    PENDING: 'pending'
};

// Service statuses
const SERVICE_STATUSES = {
    ACTIVE: 'active',
    INACTIVE: 'inactive'
};

// Notification types
const NOTIFICATION_TYPES = {
    BOOKING: 'booking',
    PAYMENT: 'payment',
    SESSION: 'session',
    SYSTEM: 'system'
};

// Socket events
const SOCKET_EVENTS = {
    JOIN_ROOM: 'join-room',
    LEAVE_ROOM: 'leave-room',
    NEW_MESSAGE: 'new-message',
    USER_JOINED: 'user-joined',
    USER_LEFT: 'user-left',
    VIDEO_CALL: 'video-call',
    PARTICIPANT_JOINED: 'participant-joined',
    PARTICIPANT_LEFT: 'participant-left'
};

module.exports = {
    USER_ROLES,
    BOOKING_STATUSES,
    SESSION_STATUSES,
    PAYMENT_STATUSES,
    THERAPIST_STATUSES,
    SERVICE_STATUSES,
    NOTIFICATION_TYPES,
    SOCKET_EVENTS
};

class BookingStatusHandler {
    constructor() {
        // Status mapping constants (from existing API)
        this.BOOKING_STATUS = {
            PENDING: 'pending',
            CONFIRMED: 'confirmed',
            CANCELLED: 'cancelled',
            COMPLETED: 'completed',
            SCHEDULED: 'scheduled'
        };

        this.PAYMENT_STATUS = {
            VERIFIED: 'verified',
            PENDING: 'pending',
            PAID: 'paid',
            FAILED: 'failed'
        };

        this.PAYMENT_MODEL_STATUS = {
            CREATED: 'created',
            FAILED: 'failed',
            PAID: 'paid'
        };
    }

    // Main status evaluation function
    evaluateBookingStatus(booking, payment = null) {
        const { status: bookingStatus, paymentStatus, createdAt } = booking;
        const paymentModelStatus = payment?.status;

        // Status mapping logic based on existing fields
        const statusLogic = {
            // Booking status determines overall workflow state
            [this.BOOKING_STATUS.PENDING]: {
                description: 'Booking under review',
                canProcessPayment: false,
                sendPaymentReminder: this.shouldSendPaymentReminder(paymentStatus, createdAt),
                sendSessionReminder: false,
                allowStatusChange: true,
                nextValidStatuses: [this.BOOKING_STATUS.CONFIRMED, this.BOOKING_STATUS.CANCELLED]
            },

            [this.BOOKING_STATUS.CONFIRMED]: {
                description: 'Booking approved',
                canProcessPayment: true,
                sendPaymentReminder: false,
                sendSessionReminder: this.shouldSendSessionReminder(booking),
                allowStatusChange: true,
                nextValidStatuses: [this.BOOKING_STATUS.COMPLETED, this.BOOKING_STATUS.CANCELLED]
            },

            [this.BOOKING_STATUS.CANCELLED]: {
                description: 'Booking cancelled',
                canProcessPayment: false,
                sendPaymentReminder: false,
                sendSessionReminder: false,
                allowStatusChange: false,
                nextValidStatuses: [],
                requiresRefund: paymentStatus === this.PAYMENT_STATUS.PAID
            },

            [this.BOOKING_STATUS.SCHEDULED]: {
                description: 'Booking scheduled for future date',
                canProcessPayment: true,
                sendPaymentReminder: false,
                sendSessionReminder: this.shouldSendSessionReminder(booking),
                allowStatusChange: true,
                nextValidStatuses: [this.BOOKING_STATUS.CONFIRMED, this.BOOKING_STATUS.CANCELLED, this.BOOKING_STATUS.COMPLETED]
            },

            [this.BOOKING_STATUS.COMPLETED]: {
                description: 'Booking completed',
                canProcessPayment: false,
                sendPaymentReminder: false,
                sendSessionReminder: false,
                allowStatusChange: false,
                nextValidStatuses: []
            }
        };

        return statusLogic[bookingStatus] || this.getDefaultStatusLogic();
    }

    // Payment status evaluation
    evaluatePaymentStatus(booking, payment) {
        const { paymentStatus: bookingPaymentStatus } = booking;
        const { status: paymentModelStatus } = payment;

        const paymentLogic = {
            [this.PAYMENT_STATUS.PENDING]: {
                description: 'Payment not yet processed',
                sendPaymentLink: true,
                sendPaymentReminder: true,
                updateBookingStatus: false,
                allowRetry: true
            },

            [this.PAYMENT_STATUS.PAID]: {
                description: 'Payment successful',
                sendPaymentLink: false,
                sendPaymentReminder: false,
                updateBookingStatus: true, // Should update booking to 'confirmed'
                allowRetry: false,
                calculateExpiry: true
            },

            [this.PAYMENT_STATUS.FAILED]: {
                description: 'Payment failed',
                sendPaymentLink: true,
                sendPaymentReminder: false,  // DISABLED: Payment reminders are turned off
                updateBookingStatus: false,
                allowRetry: true,
                notifyAdmin: true
            },

            [this.PAYMENT_STATUS.VERIFIED]: {
                description: 'Payment verified manually',
                sendPaymentLink: false,
                sendPaymentReminder: false,
                updateBookingStatus: true,
                allowRetry: false,
                calculateExpiry: true
            }
        };

        return paymentLogic[bookingPaymentStatus] || this.getDefaultPaymentLogic();
    }

    // Helper methods for conditional logic
    shouldSendPaymentReminder(paymentStatus, createdAt) {
        if (paymentStatus !== this.PAYMENT_STATUS.PENDING) return false;

        const createdTime = new Date(createdAt);
        const now = new Date();
        const hoursDiff = (now - createdTime) / (1000 * 60 * 60);

        // Send reminder every 24 hours if still pending
        return hoursDiff >= 24;
    }

    shouldSendSessionReminder(booking) {
        if (booking.status !== this.BOOKING_STATUS.CONFIRMED) return false;

        const sessionDate = new Date(booking.date);
        const now = new Date();
        const daysDiff = (sessionDate - now) / (1000 * 60 * 60 * 24);

        // Send reminder 1 day before session
        return daysDiff <= 1 && daysDiff >= 0;
    }

    isValidStatusTransition(currentStatus, newStatus, userRole) {
        const validTransitions = {
            [this.BOOKING_STATUS.PENDING]: {
                admin: [this.BOOKING_STATUS.CONFIRMED, this.BOOKING_STATUS.CANCELLED, this.BOOKING_STATUS.SCHEDULED],
                user: [] // Users cannot change booking status
            },
            [this.BOOKING_STATUS.SCHEDULED]: {
                admin: [this.BOOKING_STATUS.CONFIRMED, this.BOOKING_STATUS.CANCELLED, this.BOOKING_STATUS.COMPLETED, this.BOOKING_STATUS.PENDING],
                user: []
            },
            [this.BOOKING_STATUS.CONFIRMED]: {
                admin: [this.BOOKING_STATUS.COMPLETED, this.BOOKING_STATUS.CANCELLED],
                user: []
            },
            [this.BOOKING_STATUS.CANCELLED]: {
                admin: [],
                user: []
            },
            [this.BOOKING_STATUS.COMPLETED]: {
                admin: [],
                user: []
            }
        };

        const allowedStatuses = validTransitions[currentStatus]?.[userRole] || [];
        return allowedStatuses.includes(newStatus);
    }

    // Notification triggers based on status changes
    getNotificationTriggers(booking, payment, statusChange = null) {
        const triggers = [];

        // User notifications
        if (statusChange?.from === this.BOOKING_STATUS.PENDING &&
            statusChange?.to === this.BOOKING_STATUS.CONFIRMED) {
            triggers.push({
                type: 'user',
                template: 'booking_confirmation',
                data: {
                    bookingId: booking._id,
                    serviceName: booking.serviceName,
                    date: booking.date,
                    time: booking.time,
                    clientName: booking.clientName
                }
            });
        }

        if (statusChange?.from === this.BOOKING_STATUS.SCHEDULED &&
            statusChange?.to === this.BOOKING_STATUS.CONFIRMED) {
            triggers.push({
                type: 'user',
                template: 'booking_confirmation',
                data: { 
                    bookingId: booking._id, 
                    serviceName: booking.serviceName,
                    date: booking.date,
                    time: booking.time,
                    clientName: booking.clientName
                }
            });
        }

        if (statusChange?.to === this.BOOKING_STATUS.CANCELLED) {
            triggers.push({
                type: 'user',
                template: 'booking_cancelled',
                data: {
                    bookingId: booking._id,
                    reason: "admin cancelled the booking",
                    serviceName: booking.serviceName,
                    clientName: booking.clientName,
                    service: booking.serviceName,
                    cancellationReason: "admin cancelled the booking"
                }
            });
        }

        if (payment?.status === this.PAYMENT_MODEL_STATUS.PAID) {
            triggers.push({
                type: 'user',
                template: 'payment_successful',
                data: { amount: payment.amount, orderId: payment.orderId }
            });
        }

        // Admin notifications
        if (booking.status === this.BOOKING_STATUS.PENDING) {
            triggers.push({
                type: 'admin',
                template: 'new_booking',
                data: { bookingId: booking._id, clientName: booking.clientName }
            });
        }

        if (payment?.status === this.PAYMENT_MODEL_STATUS.PAID) {
            triggers.push({
                type: 'admin',
                template: 'payment_received',
                data: { bookingId: booking._id, amount: payment.amount }
            });
            // Send new booking notification when payment is made to ensure admin gets notified
            triggers.push({
                type: 'admin',
                template: 'new_booking',
                data: {
                    bookingId: booking._id,
                    clientName: booking.clientName,
                    patientName: booking.clientName,
                    serviceName: booking.serviceName,
                    amount: payment.amount,
                    phone: booking.phone || (booking.userId?.phone),  // Use booking phone or user phone
                    date: booking.date || booking.scheduledDate,     // Use booking date
                    time: booking.time || booking.scheduledTime      // Use booking time
                }
            });
        }

        return triggers;
    }

    // Get default fallback logic
    getDefaultStatusLogic() {
        return {
            description: 'Unknown status',
            canProcessPayment: false,
            sendPaymentReminder: false,
            sendSessionReminder: false,
            allowStatusChange: false,
            nextValidStatuses: []
        };
    }

    getDefaultPaymentLogic() {
        return {
            description: 'Unknown payment status',
            sendPaymentLink: false,
            sendPaymentReminder: false,
            updateBookingStatus: false,
            allowRetry: false
        };
    }
}

module.exports = new BookingStatusHandler();
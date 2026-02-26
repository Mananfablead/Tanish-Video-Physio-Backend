const Booking = require('../models/Booking.model');
const Service = require('../models/Service.model');
const User = require('../models/User.model');
const Payment = require('../models/Payment.model');
const Subscription = require('../models/Subscription.model');
const Session = require('../models/Session.model');
const ApiResponse = require('../utils/apiResponse');
const BookingStatusHandler = require('../services/bookingStatusHandler');
const NotificationService = require('../services/notificationService');
const { generateToken } = require('../config/jwt');

// Get all bookings for authenticated user
const getAllBookings = async (req, res, next) => {
    try {
        const bookings = await Booking.find({ 
            userId: req.user.userId,
            paymentStatus: 'paid' // Only show bookings where payment has been completed
        })
            .sort({ createdAt: -1 }) // Sort by createdAt descending
            .populate('serviceId', 'name price duration validity images')
            .populate('therapistId', 'name email role profilePicture');

        res.status(200).json(ApiResponse.success({ bookings }, 'Bookings retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Get booking by ID with status evaluation
const getBookingById = async (req, res, next) => {
    try {
        // Build query based on user role
        let query;
        if (req.user.role === 'admin') {
            // Admin can access any booking
            query = { _id: req.params.id };
        } else {
            // Regular user can only access their own bookings
            query = { _id: req.params.id, userId: req.user.userId };
        }

        const booking = await Booking.findOne(query)
            .populate('serviceId', 'name price duration validity images')
            .populate('therapistId', 'name email role profilePicture')
            .populate({
                path: 'userId',
                select: 'name email phone joinDate healthProfile',
                populate: {
                    path: 'healthProfile',
                    select: 'questionnaireResponses questionnaireMetadata additionalNotes primaryConcern painIntensity priorTreatments'
                }
            });

        if (!booking) {
            return res.status(404).json(ApiResponse.error('Booking not found or unauthorized'));
        }

        // Add status evaluation
        const statusEvaluation = BookingStatusHandler.evaluateBookingStatus(booking);

        // Get associated payment if exists
        const payment = await Payment.findOne({ bookingId: booking._id });
        const paymentEvaluation = payment
            ? BookingStatusHandler.evaluatePaymentStatus(booking, payment)
            : null;

        // For free consultation bookings, ensure service expiry is calculated
        const bookingObject = booking.toObject();
        
        if (booking.bookingType === 'free-consultation' && !bookingObject.serviceExpiryDate) {
            // Calculate expiry date for free consultation if not already set
            const validityDays = booking.serviceValidityDays || 30; // Default to 30 days for free consultations
            // Use the scheduled date if available, otherwise fall back to purchase date
            const baseDate = booking.scheduledDate ? 
                new Date(`${booking.scheduledDate}T00:00:00`) : 
                (booking.purchaseDate || booking.createdAt);
            const expiryDate = new Date(baseDate);
            expiryDate.setDate(baseDate.getDate() + validityDays);
            
            bookingObject.serviceExpiryDate = expiryDate;
            bookingObject.serviceValidityDays = validityDays;
            bookingObject.isServiceExpired = new Date() > expiryDate;
        }

        res.status(200).json(ApiResponse.success({
            booking: {
                ...bookingObject,
                statusEvaluation,
                paymentEvaluation
            }
        }, 'Booking retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Get booking details by ID for both guest and authenticated users (unified endpoint)
const getBookingDetails = async (req, res, next) => {
    try {
        const { id: bookingId } = req.params;

        // For guest users, we'll accept email in the request body to verify access
        const { clientEmail } = req.body;

        // Find the booking by ID
        const booking = await Booking.findById(bookingId)
            .populate('serviceId', 'name price duration description validity images')
            .populate('therapistId', 'name email role profilePicture')
            .populate({
                path: 'userId',
                select: 'name email phone joinDate healthProfile',
                populate: {
                    path: 'healthProfile',
                    select: 'questionnaireResponses questionnaireMetadata additionalNotes primaryConcern painIntensity priorTreatments'
                }
            });

        if (!booking) {
            return res.status(404).json(ApiResponse.error('Booking not found'));
        }

        // Check access permissions
        let hasAccess = false;

        if (req.user) {
            // Authenticated user - check if booking belongs to them or they're admin
            if (req.user.role === 'admin' || booking.userId.equals(req.user.userId)) {
                hasAccess = true;
            }
        } else if (clientEmail) {
            // Guest user - verify by email
            const user = await User.findOne({ email: clientEmail });
            if (user && booking.userId.equals(user._id)) {
                hasAccess = true;
            }
        }

        if (!hasAccess) {
            return res.status(403).json(ApiResponse.error('Unauthorized to access this booking'));
        }

        // For free consultation bookings, ensure service expiry is calculated
        const bookingObject = booking.toObject();
        
        if (booking.bookingType === 'free-consultation' && !bookingObject.serviceExpiryDate) {
            // Calculate expiry date for free consultation if not already set
            const validityDays = booking.serviceValidityDays || 30; // Default to 30 days for free consultations
            // Use the scheduled date if available, otherwise fall back to purchase date
            const baseDate = booking.scheduledDate ? 
                new Date(`${booking.scheduledDate}T00:00:00`) : 
                (booking.purchaseDate || booking.createdAt);
            const expiryDate = new Date(baseDate);
            expiryDate.setDate(baseDate.getDate() + validityDays);
            
            bookingObject.serviceExpiryDate = expiryDate;
            bookingObject.serviceValidityDays = validityDays;
            bookingObject.isServiceExpired = new Date() > expiryDate;
        }

        res.status(200).json(ApiResponse.success({ booking: bookingObject }, 'Booking details retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Create a new booking with notification triggers
const createBooking = async (req, res, next) => {
    try {
        // Check if user is authenticated
        if (!req.user || !req.user.userId) {
            return res.status(401).json(ApiResponse.error('Authentication required'));
        }

        const { serviceId, date, time, notes, clientName, scheduleType, scheduledDate, scheduledTime, timeSlot, couponCode, discountAmount, finalAmount, bookingType } = req.body;

        // Check for duplicate booking to prevent multiple submissions
        const existingBooking = await Booking.findOne({
            userId: req.user.userId,
            date: date,
            time: time,
            bookingType: bookingType || 'regular',
            status: { $in: ['pending', 'confirmed', 'scheduled'] } // Don't allow duplicates for active bookings
        });

        if (existingBooking) {
            return res.status(409).json(ApiResponse.error('You already have a booking for this date and time'));
        }

        // Check if user has an active subscription with remaining sessions
        // This allows users with active subscriptions to book services for free
        const subscription = await Subscription.findOne({ 
            userId: req.user.userId, 
            status: 'active' 
        }).populate('planId');
        
        let service = null;
        let serviceName = "Free Consultation";
        let amount = 0;
        let paymentStatus = req.user.role === 'admin' ? 'paid' : 'pending'; // Admin bookings default to paid, others to pending
        let bookingTypeFinal = bookingType || 'regular';

        if (bookingType === 'free-consultation') {
            // For free consultations, no service validation needed
        } else if (subscription && !subscription.isExpired) {
            // Check if subscription has remaining sessions
            // Fetch the plan data manually since planId might be a string field
            let plan = null;
            if (subscription.planId) {
                const isValidObjectId = require('mongoose').Types.ObjectId.isValid(subscription.planId);
                if (isValidObjectId) {
                    const SubscriptionPlan = require('../models/SubscriptionPlan.model');
                    plan = await SubscriptionPlan.findById(subscription.planId);
                } else {
                    // Try to find by planId string
                    const SubscriptionPlan = require('../models/SubscriptionPlan.model');
                    plan = await SubscriptionPlan.findOne({ planId: subscription.planId });
                }
            }
            
            if (!plan) {
                // No valid plan found, proceed with regular booking
                // Validate required fields
                if (!serviceId) {
                    return res.status(400).json(ApiResponse.error('Service ID is required'));
                }

                // Validate service exists
                service = await Service.findById(serviceId);

                if (!service || service.status !== 'active') {
                    return res.status(404).json(ApiResponse.error('Service not found or not active'));
                }
                serviceName = service.name;
                amount = service.price;
            } else {
                console.log(`Regular booking with subscription check:`, {
                    subscriptionId: subscription._id,
                    planName: plan.name,
                    planSessions: plan.sessions,
                    planType: typeof plan.sessions,
                    userId: req.user.userId
                });
            
                // Check session limits - enforce actual session limit from subscription
                // Only count actual Session documents, not Booking documents
                const usedSessions = await Session.countDocuments({
                    subscriptionId: subscription._id,
                    status: { $ne: "cancelled" }
                });
                
                // Get total sessions from subscription plan (consider both sessions and totalService fields)
                // Some plans might use 'totalService' instead of 'sessions' field
                let totalSessions = 0;
                if (plan && typeof plan.sessions === 'number') {
                    totalSessions = plan.sessions;
                } else if (plan && typeof plan.totalService === 'number') {
                    totalSessions = plan.totalService;
                }
                            
                console.log(`Session check for subscription ${subscription._id}:`, {
                    planName: plan.name,
                    planSessions: plan.sessions,
                    planTotalService: plan.totalService,
                    totalSessions: totalSessions,
                    usedSessions: usedSessions,
                    remainingSessions: totalSessions - usedSessions
                });
                            
                if (totalSessions <= 0) {
                    // No sessions in plan, proceed with regular paid booking
                    if (!serviceId) {
                        return res.status(400).json(ApiResponse.error('Service ID is required'));
                    }
                
                    // Validate service exists
                    service = await Service.findById(serviceId);
                
                    if (!service || service.status !== 'active') {
                        return res.status(404).json(ApiResponse.error('Service not found or not active'));
                    }
                    serviceName = service.name;
                    amount = service.price;
                } else if (usedSessions >= totalSessions) {
                    // Session limit reached, proceed with regular booking flow
                    if (!serviceId) {
                        return res.status(400).json(ApiResponse.error('Service ID is required'));
                    }

                    // Validate service exists
                    service = await Service.findById(serviceId);

                    if (!service || service.status !== 'active') {
                        return res.status(404).json(ApiResponse.error('Service not found or not active'));
                    }
                    serviceName = service.name;
                    amount = service.price;
                } else {
                    // User has remaining sessions in subscription, make booking free
                    if (serviceId) {
                        service = await Service.findById(serviceId);
                        if (!service || service.status !== 'active') {
                            return res.status(404).json(ApiResponse.error('Service not found or not active'));
                        }
                        serviceName = service.name;
                    }
                    amount = 0; // No charge as it's covered by subscription
                    paymentStatus = 'paid'; // Mark as paid since it's covered by subscription
                    bookingTypeFinal = 'subscription-covered';
                }
            }
        } else {
            // No active subscription, proceed with regular booking flow
            // Validate required fields
            if (!serviceId) {
                return res.status(400).json(ApiResponse.error('Service ID is required'));
            }

            // Validate service exists
            service = await Service.findById(serviceId);

            if (!service || service.status !== 'active') {
                return res.status(404).json(ApiResponse.error('Service not found or not active'));
            }
            serviceName = service.name;
            amount = service.price;
        }

        // Automatically assign an available therapist (admin user)
        const therapist = await User.findOne({
            role: 'admin',
            status: 'active'
        });

        if (!therapist) {
            return res.status(404).json(ApiResponse.error('No active therapists available'));
        }

        // If scheduling now, validate the scheduled date and time
        if (scheduleType === 'now' && scheduledDate && scheduledTime) {
            // Check if the requested time slot is available
            const slotAvailability = await checkTimeSlotAvailability(therapist._id, scheduledDate, scheduledTime, timeSlot, bookingType);

            if (!slotAvailability.available) {
                return res.status(409).json(ApiResponse.error(slotAvailability.message));
            }
        }

        // Create booking with default status values
        const booking = new Booking({
            ...((bookingType !== 'free-consultation' && bookingType !== 'subscription-covered') && { serviceId }),
            serviceName: serviceName,
            therapistId: therapist._id,
            therapistName: therapist?.name || 'Admin',
            // For admin users, allow specifying a different user; otherwise use current user
            userId: req.user.role === 'admin' && req.body.userId ? req.body.userId : req.user.userId,
            // For admin users, use the specified client name; otherwise use current user's name
            clientName: req.user.role === 'admin' && req.body.clientName ? req.body.clientName : (clientName || req.user?.name || 'Unknown User'),
            date,
            time,
            notes,
            amount: amount,
            originalAmount: amount,
            finalAmount: finalAmount || amount,
            couponCode: couponCode || null,
            discountAmount: discountAmount || 0,
            paymentStatus: bookingType === 'free-consultation' ? 'paid' : (req.user.role === 'admin' && bookingType !== 'subscription-covered' ? 'paid' : paymentStatus),
            // For admin booking creation, default to 'pending' status initially
            status: req.user.role === 'admin' && !bookingType ? 'pending' : (bookingType === 'subscription-covered' ? 'pending' : (bookingType === 'free-consultation' ? 'pending' : ((scheduledDate && scheduledTime) ? 'pending' : (scheduleType === 'later' ? 'pending' : 'pending')))),
            serviceValidityDays: bookingType === 'free-consultation' ? 30 : service?.validity, // Free consultation has 30 days validity
            purchaseDate: new Date(),
            scheduleType: scheduleType || 'now',
            scheduledDate: scheduledDate || date || null,
            scheduledTime: scheduledTime || (timeSlot ? `${timeSlot.start}-${timeSlot.end}` : time) || null,
            timeSlot: timeSlot || (time && time.includes('-') ? {
                start: time.split('-')[0],
                end: time.split('-')[1]
            } : null),
            bookingType: bookingTypeFinal
        });

        await booking.save();

        // Send booking confirmation notifications for free consultations
        if (bookingTypeFinal === 'free-consultation') {
            try {
                // Get user details for notifications
                const user = await User.findById(req.user.userId).select('email phone name');
                
                if (user) {
                    const notificationService = require('../services/notificationService');
                    
                    // Prepare notification data
                    const notificationData = {
                        clientName: user.name,
                        serviceName: booking.serviceName,
                        date: booking.scheduledDate || booking.date,
                        time: booking.scheduledTime || booking.time,
                        therapistName: booking.therapistName,
                        bookingId: booking._id
                    };
                    
                    // Send email notification
                    if (user.email) {
                        try {
                            await notificationService.sendEmail(
                                user.email,
                                'booking_confirmation',
                                notificationData
                            );
                            console.log(`✅ Email notification sent for free consultation booking ${booking._id}`);
                        } catch (emailError) {
                            console.error(`❌ Failed to send email for booking ${booking._id}:`, emailError);
                        }
                    }
                    
                    // Send WhatsApp notification
                    if (user.phone) {
                        try {
                            await notificationService.sendWhatsApp(
                                user.phone,
                                (data) => `🎉 Booking Confirmed!

Hello ${data.clientName},

Your free consultation with ${data.therapistName} is confirmed for ${data.date} at ${data.time}.

Booking ID: ${data.bookingId}

Looking forward to helping you!

- Tanish Physio Team`,
                                notificationData
                            );
                            console.log(`✅ WhatsApp notification sent for free consultation booking ${booking._id}`);
                        } catch (whatsappError) {
                            console.error(`❌ Failed to send WhatsApp for booking ${booking._id}:`, whatsappError);
                        }
                    }
                }
            } catch (notificationError) {
                console.error(`❌ Error sending notifications for booking ${booking._id}:`, notificationError);
                // Don't fail the booking if notifications fail
            }
        }

        // Create session for subscription-covered bookings
        if (bookingTypeFinal === 'subscription-covered' && subscription) {
            const Session = require('../models/Session.model');
            const session = new Session({
                therapistId: booking.therapistId,
                userId: booking.userId,
                date: booking.scheduledDate || booking.date,
                time: booking.scheduledTime || booking.time,
                startTime: new Date(`${booking.scheduledDate || booking.date}T${booking.scheduledTime || booking.time}`),
                type: '1-on-1',
                status: 'pending',
                notes: `Session created automatically from subscription-covered booking #${booking._id}`,
                bookingId: booking._id,
                subscriptionId: subscription._id
            });

            // Calculate end time if duration is available
            if (service && service.duration) {
                const durationMatch = service.duration.match(/(\d+)/);
                if (durationMatch) {
                    const duration = parseInt(durationMatch[0]);
                    const endTime = new Date(session.startTime);
                    endTime.setMinutes(endTime.getMinutes() + duration);
                    session.endTime = endTime;
                    session.duration = duration;
                }
            }

            await session.save();
            console.log(`✅ Session created for subscription-covered booking ${booking._id}: Session ID ${session._id}`);
        }

        // If scheduling now, update availability to mark the slot as tentative until payment is confirmed
        if (scheduleType === 'now' && scheduledDate && scheduledTime && timeSlot) {
            // Mark slot as tentative if payment is pending, booked if payment is confirmed
            const slotStatus = booking.paymentStatus === 'paid' ? 'booked' : 'tentative';
            await updateAvailabilitySlot(therapist._id, scheduledDate, timeSlot.start, timeSlot.end, slotStatus);
        }

        // Populate the response
        await booking.populate('serviceId', 'name price duration validity images');
        await booking.populate('therapistId', 'name email role profilePicture');

        // Send notifications
        const notificationData = {
            clientName: req.user?.name || 'Unknown User',
            serviceName: serviceName,
            bookingId: booking._id,
            date: date,
            time: time
        };

        // Notify admins
        const admins = await User.find({ role: 'admin' }).select('email phone name');
        for (const admin of admins) {
            await NotificationService.sendNotification(
                { email: admin.email, phone: admin.phone },
                'new_booking',
                { ...notificationData, clientName: req.user?.name || 'Unknown User' }
            );
        }

        res.status(201).json(ApiResponse.success({ booking }, 'Booking created successfully'));
    } catch (error) {
        next(error);
    }
};

// Helper function to check time slot availability
async function checkTimeSlotAvailability(therapistId, date, time, timeSlot, bookingType) {
    const mongoose = require('mongoose');

    // Validate inputs
    if (!mongoose.Types.ObjectId.isValid(therapistId)) {
        return { available: false, message: 'Invalid therapist ID' };
    }

    if (!date || !time) {
        return { available: false, message: 'Date and time are required for scheduling' };
    }

    // Check if the therapist exists
    const therapist = await User.findById(therapistId);
    if (!therapist) {
        return { available: false, message: 'Therapist not found' };
    }

    // Check if there's availability for the therapist on the given date
    const Availability = require('../models/Availability.model');
    const availability = await Availability.findOne({
        therapistId,
        date
    });

    if (availability) {
        // Check if the requested time slot exists in availability
        if (timeSlot) {
            // For booking type validation, we need to check if the slot duration matches the booking type
            const requestedSlot = availability.timeSlots.find(slot =>
                slot.start === timeSlot.start && 
                slot.end === timeSlot.end && 
                slot.status !== 'booked'
            );

            if (!requestedSlot) {
                return { available: false, message: 'Requested time slot is not available' };
            }
            
            // Validate that the slot duration matches the expected duration for the booking type
            if (bookingType === 'free-consultation' && requestedSlot.duration !== 15) {
                return { available: false, message: 'Free consultation requires 15-minute time slots' };
            } else if (bookingType === 'regular' && requestedSlot.duration !== 45) {
                return { available: false, message: 'Regular sessions require 45-minute time slots' };
            }
        } else {
            // If no specific timeSlot provided, just check if the time exists and is available
            const requestedSlot = availability.timeSlots.find(slot =>
                slot.start === time && slot.status !== 'booked'
            );

            if (!requestedSlot) {
                return { available: false, message: 'Requested time slot is not available' };
            }
        }
    } else {
        // If no availability record exists for the date, assume slot is not available
        return { available: false, message: 'No availability found for the selected date' };
    }

    // Check if there's already a PAID booking for this therapist at the same time
    const existingPaidBooking = await Booking.findOne({
        therapistId,
        scheduledDate: date,
        paymentStatus: 'paid', // Only consider paid bookings as blocking
        $or: [
            { 'timeSlot.start': timeSlot ? timeSlot.start : time },
            { scheduledTime: time }
        ]
    });

    if (existingPaidBooking) {
        return { available: false, message: 'A booking already exists for this time slot' };
    }

    return { available: true, message: 'Time slot is available' };
}

// Helper function to update availability slot status
async function updateAvailabilitySlot(therapistId, date, startTime, endTime, status) {
    const Availability = require('../models/Availability.model');

    try {
        // First, find the availability document
        const availability = await Availability.findOne({
            therapistId,
            date
        });

        if (!availability) {
            console.log(`No availability found for therapist ${therapistId} on date ${date}`);
            return;
        }

        // Find and update the specific time slot
        const slotIndex = availability.timeSlots.findIndex(slot =>
            slot.start === startTime && slot.end === endTime
        );

        if (slotIndex !== -1) {
            // Preserve the duration and bookingType while updating the status
            availability.timeSlots[slotIndex].status = status;
            await availability.save();
            console.log(`Successfully updated slot ${startTime}-${endTime} to ${status} for therapist ${therapistId} on ${date}`);
        } else {
            console.log(`Time slot ${startTime}-${endTime} not found for therapist ${therapistId} on ${date}`);
        }
    } catch (error) {
        console.error("Error updating availability slot:", error);
        // Continue without throwing error as it's not critical to booking
    }
}

// Check if time slot is available
const checkSlotAvailability = async (req, res, next) => {
    try {
        const { therapistId, date, timeSlot } = req.body;

        // Validate required fields
        if (!therapistId || !date || !timeSlot) {
            return res.status(400).json(ApiResponse.error('Therapist ID, date, and time slot are required'));
        }

        // Validate time slot format
        const { start, end } = timeSlot;
        if (!start || !end) {
            return res.status(400).json(ApiResponse.error('Start and end times are required for time slot'));
        }

        // Validate therapistId format (should be a valid MongoDB ObjectId)
        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(therapistId)) {
            return res.status(400).json(ApiResponse.error('Invalid data format - therapistId must be a valid MongoDB ObjectId'));
        }

        // Check if the therapist exists
        const therapist = await User.findById(therapistId);
        if (!therapist) {
            return res.status(404).json(ApiResponse.error('Therapist not found'));
        }

        // Check if there's availability for the therapist on the given date
        const availability = await Availability.findOne({
            therapistId,
            date
        });

        if (availability) {
            // Check if the requested time slot exists in availability
            const requestedSlot = availability.timeSlots.find(slot => 
                slot.start === start && slot.end === end && slot.status !== 'booked'
            );

            if (!requestedSlot) {
                return res.status(409).json(ApiResponse.error('Requested time slot is not available'));
            }
        } else {
            // If no availability record exists for the date, assume slot is not available
            return res.status(409).json(ApiResponse.error('No availability found for the selected date')); 
        }

        // Check if there's already a PAID booking for this therapist at the same time
        const existingPaidBooking = await Booking.findOne({
            therapistId,
            date,
            paymentStatus: 'paid', // Only consider paid bookings as blocking
            $or: [
                { scheduledDate: date, 'timeSlot.start': start, 'timeSlot.end': end },
                { scheduledDate: date, time: { $regex: `^${start.substring(0, 5)}.*` } } // Match if time starts with the same hour
            ]
        });

        if (existingPaidBooking) {
            return res.status(409).json(ApiResponse.error('A booking already exists for this time slot')); 
        }

        res.status(200).json(ApiResponse.success({ available: true }, 'Time slot is available')); 
    } catch (error) {
        next(error);
    }
};

// Update booking with scheduling information
const updateBookingWithSchedule = async (req, res, next) => {
    try {
        const { id: bookingId } = req.params;
        const { scheduledDate, scheduledTime, timeSlot, status, couponCode, discountAmount, finalAmount } = req.body;

        // Build query based on user role
        let query;
        if (req.user.role === 'admin') {
            // Admin can update any booking
            query = { _id: bookingId };
        } else {
            // Regular user can only update their own bookings
            query = { _id: bookingId, userId: req.user.userId };
        }

        // Get current booking
        const currentBooking = await Booking.findOne(query);
        if (!currentBooking) {
            return res.status(404).json(ApiResponse.error('Booking not found or unauthorized'));
        }

        // Prepare update data
        const updateData = {};
        if (scheduledDate) updateData.scheduledDate = scheduledDate;
        if (scheduledTime) updateData.scheduledTime = scheduledTime;
        if (timeSlot) {
            updateData.timeSlot = timeSlot;
            // If scheduledTime is not provided but timeSlot is, construct the scheduledTime from timeSlot
            if (!scheduledTime) {
                updateData.scheduledTime = `${timeSlot.start}-${timeSlot.end}`;
            }
        }
        
        // If status is being updated, validate permissions
        if (status) {
            if (req.user.role !== 'admin') {
                // For regular users, allow certain status transitions
                const allowedUserTransitions = ['pending', 'scheduled', 'cancelled'];
                if (!allowedUserTransitions.includes(status)) {
                    return res.status(403).json(ApiResponse.error('Users can only change status to pending, scheduled, or cancelled')); 
                }
            }
            updateData.status = status;
        }
        
        // Add coupon information if provided
        if (couponCode !== undefined) updateData.couponCode = couponCode;
        if (discountAmount !== undefined) updateData.discountAmount = discountAmount;
        if (finalAmount !== undefined) updateData.finalAmount = finalAmount;
        
        // If scheduling now, update status to scheduled (unless status was already provided)
        if (scheduledDate && scheduledTime && !status) {
            updateData.status = 'scheduled';
        }

        // Update booking
        const booking = await Booking.findOneAndUpdate(
            query,
            updateData,
            { new: true, runValidators: true }
        ).populate('serviceId', 'name price duration validity images')
          .populate('therapistId', 'name email role profilePicture');

        // For free consultation bookings, ensure service expiry is calculated
        if (booking.bookingType === 'free-consultation' && booking.paymentStatus === 'paid' && !booking.serviceExpiryDate) {
            // Calculate expiry date for free consultation if not already set
            const validityDays = booking.serviceValidityDays || 30; // Default to 30 days for free consultations
            // Use the scheduled date if available, otherwise fall back to purchase date
            const baseDate = booking.scheduledDate ? 
                new Date(`${booking.scheduledDate}T00:00:00`) : 
                (booking.purchaseDate || booking.createdAt);
            const expiryDate = new Date(baseDate);
            expiryDate.setDate(baseDate.getDate() + validityDays);
            
            booking.serviceExpiryDate = expiryDate;
            booking.serviceValidityDays = validityDays;
            
            // Save the updated booking with expiry date
            await booking.save();
        }

        // Send notifications if status was updated
        if (status && status !== currentBooking.status) {
            // Get booking owner's contact information
            const bookingOwner = await User.findById(booking.userId).select('email phone name');

            const statusChange = { from: currentBooking.status, to: status };
            const triggers = BookingStatusHandler.getNotificationTriggers(
                booking,
                null,
                statusChange
            );

            // Send notifications
            for (const trigger of triggers) {
                if (trigger.type === 'user') {
                    await NotificationService.sendNotification(
                        { email: bookingOwner.email, phone: bookingOwner.phone },
                        trigger.template,
                        { ...trigger.data, clientName: bookingOwner.name }
                    );
                } else if (trigger.type === 'admin') {
                    const admins = await User.find({ role: 'admin' }).select('email phone name');
                    for (const admin of admins) {
                        await NotificationService.sendNotification(
                            { email: admin.email, phone: admin.phone },
                            trigger.template,
                            trigger.data
                        );
                    }
                }
            }
        }

        res.status(200).json(ApiResponse.success({ booking }, 'Booking updated with schedule successfully'));
    } catch (error) {
        next(error);
    }
};

// Update booking by ID with status-based logic
const updateBooking = async (req, res, next) => {
    try {
        const { date, time, notes, status, cancellationReason, couponCode, discountAmount, finalAmount, scheduledDate, scheduledTime, timeSlot } = req.body;
        const bookingId = req.params.id;

        // Build query based on user role
        let query;
        if (req.user.role === 'admin') {
            // Admin can update any booking
            query = { _id: bookingId };
        } else {
            // Regular user can only update their own bookings
            query = { _id: bookingId, userId: req.user.userId };
        }

        // Get current booking for status evaluation
        const currentBooking = await Booking.findOne(query);
        if (!currentBooking) {
            return res.status(404).json(ApiResponse.error('Booking not found or unauthorized'));
        }

        // Validate status transition for admins
        if (status && status !== currentBooking.status) {
            // Allow status change for both admins and users (owners of the booking)
            // Only validate transition rules for admins, but allow users to make reasonable changes
            if (req.user.role !== 'admin') {
                // For regular users, allow certain status transitions
                const allowedUserTransitions = ['pending', 'scheduled', 'cancelled'];
                if (!allowedUserTransitions.includes(status)) {
                    return res.status(403).json(ApiResponse.error('Users can only change status to pending, scheduled, or cancelled')); 
                }
                
                // Ensure user can only update their own booking
                if (!query.userId || !currentBooking.userId.equals(req.user.userId)) {
                    return res.status(403).json(ApiResponse.error('Unauthorized to change this booking status'));
                }
            } else {
                // For admins, validate status transition rules
                const isValidTransition = BookingStatusHandler.isValidStatusTransition(
                    currentBooking.status,
                    status,
                    req.user.role
                );

                if (!isValidTransition) {
                    return res.status(400).json(ApiResponse.error(
                        `Invalid status transition from ${currentBooking.status} to ${status}`
                    ));
                }
            }
        }

        // Prepare update data
        const updateData = { date, time, notes };
        
        // Add scheduling information if provided
        if (scheduledDate) updateData.scheduledDate = scheduledDate;
        if (scheduledTime) updateData.scheduledTime = scheduledTime;
        if (timeSlot) {
            updateData.timeSlot = timeSlot;
            // If scheduledTime is not provided but timeSlot is, construct the scheduledTime from timeSlot
            if (!scheduledTime) {
                updateData.scheduledTime = `${timeSlot.start}-${timeSlot.end}`;
            }
        }
        
        // Add coupon information if provided
        if (couponCode !== undefined) updateData.couponCode = couponCode;
        if (discountAmount !== undefined) updateData.discountAmount = discountAmount;
        if (finalAmount !== undefined) updateData.finalAmount = finalAmount;

        if (status) {
            updateData.status = status;

            // Handle cancellation
            if (status === 'cancelled' && cancellationReason) {
                updateData.cancellationReason = cancellationReason;
            }

            // Handle confirmation - calculate expiry date or create session for free consultation
            if (status === 'confirmed') {
                if (currentBooking.bookingType === 'free-consultation') {
                    // For free consultations, create a session immediately
                    const Session = require('../models/Session.model');
                    
                    // Calculate session time based on the booking time slot
                    const sessionStartTime = currentBooking.timeSlot ? 
                        new Date(`${currentBooking.date}T${currentBooking.timeSlot.start}:00`) :
                        new Date(`${currentBooking.date}T${currentBooking.scheduledTime || currentBooking.time}:00`);
                    const sessionEndTime = new Date(sessionStartTime.getTime() + 15 * 60000); // 15 minutes
                    
                    const sessionData = {
                        bookingId: currentBooking._id,
                        therapistId: currentBooking.therapistId,
                        userId: currentBooking.userId,
                        date: currentBooking.date,
                        time: currentBooking.timeSlot ? currentBooking.timeSlot.start : (currentBooking.scheduledTime || currentBooking.time),
                        startTime: sessionStartTime,
                        endTime: sessionEndTime,
                        type: "1-on-1",
                        status: "scheduled", // Schedule the session immediately
                        duration: 15,
                    };
                    
                    await Session.create(sessionData);
                    
                    // Calculate expiry date for free consultation
                    // Use the scheduled date if available, otherwise fall back to purchase date
                    const baseDate = currentBooking.scheduledDate ? 
                        new Date(`${currentBooking.scheduledDate}T00:00:00`) : 
                        (currentBooking.purchaseDate || currentBooking.createdAt);
                    const expiryDate = new Date(baseDate);
                    expiryDate.setDate(baseDate.getDate() + (currentBooking.serviceValidityDays || 30));
                    updateData.serviceExpiryDate = expiryDate;
                    
                    // Update availability to mark slot as booked
                    const Availability = require('../models/Availability.model');
                    if (currentBooking.timeSlot && currentBooking.timeSlot.start && currentBooking.timeSlot.end) {
                        await Availability.updateOne(
                            { therapistId: currentBooking.therapistId, date: currentBooking.date },
                            {
                                $set: {
                                    "timeSlots.$[slot].status": "booked",
                                },
                            },
                            {
                                arrayFilters: [
                                    {
                                        "slot.start": currentBooking.timeSlot.start,
                                        "slot.end": currentBooking.timeSlot.end,
                                    },
                                ],
                            }
                        );
                    } else if (currentBooking.scheduledTime) {
                        // Fallback to older time format if timeSlot is not available
                        await Availability.updateOne(
                            { therapistId: currentBooking.therapistId, date: currentBooking.date },
                            {
                                $set: {
                                    "timeSlots.$[slot].status": "booked",
                                },
                            },
                            {
                                arrayFilters: [
                                    {
                                        "slot.start": { $regex: `^${currentBooking.scheduledTime.substring(0, 5)}` },
                                    },
                                ],
                            }
                        );
                    }
                } else {
                    // For regular bookings, calculate expiry date
                    const service = await Service.findById(currentBooking.serviceId);
                    if (service && service.validity) {
                        const purchaseDate = currentBooking.purchaseDate || currentBooking.createdAt;
                        const expiryDate = new Date(purchaseDate);
                        expiryDate.setDate(purchaseDate.getDate() + service.validity);
                        updateData.serviceExpiryDate = expiryDate;
                    }
                }
            }
        }

        // Update booking
        const booking = await Booking.findOneAndUpdate(
            query,
            updateData,
            { new: true, runValidators: true }
        )
            .populate('serviceId', 'name price duration validity images')
            .populate('therapistId', 'name email role profilePicture');

        // For free consultation bookings, ensure service expiry is calculated
        if (booking.bookingType === 'free-consultation' && booking.paymentStatus === 'paid' && !booking.serviceExpiryDate) {
            // Calculate expiry date for free consultation if not already set
            const validityDays = booking.serviceValidityDays || 30; // Default to 30 days for free consultations
            // Use the scheduled date if available, otherwise fall back to purchase date
            const baseDate = booking.scheduledDate ? 
                new Date(`${booking.scheduledDate}T00:00:00`) : 
                (booking.purchaseDate || booking.createdAt);
            const expiryDate = new Date(baseDate);
            expiryDate.setDate(baseDate.getDate() + validityDays);
            
            booking.serviceExpiryDate = expiryDate;
            booking.serviceValidityDays = validityDays;
            
            // Save the updated booking with expiry date
            await booking.save();
        }

        // If payment status changed to 'paid', update the availability slot from 'tentative' to 'booked'
        if (updateData.paymentStatus === 'paid' && currentBooking.paymentStatus !== 'paid') {
            if (booking.scheduledDate && booking.timeSlot && booking.timeSlot.start && booking.timeSlot.end) {
                const Availability = require('../models/Availability.model');

                // Find the availability record for this therapist and date
                const availability = await Availability.findOne({
                    therapistId: booking.therapistId,
                    date: booking.scheduledDate
                });

                if (availability) {
                    // Find and update the specific time slot from 'tentative' to 'booked'
                    const slotIndex = availability.timeSlots.findIndex(slot =>
                        slot.start === booking.timeSlot.start &&
                        slot.end === booking.timeSlot.end
                    );

                    if (slotIndex !== -1) {
                        availability.timeSlots[slotIndex].status = 'booked';
                        await availability.save();
                        console.log(`Successfully booked slot ${booking.timeSlot.start}-${booking.timeSlot.end} for therapist ${booking.therapistId} on ${booking.scheduledDate}`);
                    } else {
                        console.log(`Time slot ${booking.timeSlot.start}-${booking.timeSlot.end} not found for therapist ${booking.therapistId} on ${booking.scheduledDate}`);
                    }
                } else {
                    console.log(`No availability found for therapist ${booking.therapistId} on date ${booking.scheduledDate}`);
                }
            }
        }

        if (status && status !== currentBooking.status) {
            // Get booking owner's contact information
            const bookingOwner = await User.findById(booking.userId).select('email phone name');

            const triggers = BookingStatusHandler.getNotificationTriggers(
                booking,
                null,
                { from: currentBooking.status, to: status }
            );

            // Send notifications
            for (const trigger of triggers) {
                if (trigger.type === 'user') {
                    await NotificationService.sendNotification(
                        { email: bookingOwner.email, phone: bookingOwner.phone },
                        trigger.template,
                        { ...trigger.data, clientName: bookingOwner.name }
                    );
                } else if (trigger.type === 'admin') {
                    const admins = await User.find({ role: 'admin' }).select('email phone name');
                    for (const admin of admins) {
                        await NotificationService.sendNotification(
                            { email: admin.email, phone: admin.phone },
                            trigger.template,
                            trigger.data
                        );
                    }
                }
            }
        }

        res.status(200).json(ApiResponse.success({ booking }, 'Booking updated successfully'));
    } catch (error) {
        next(error);
    }
};

// Update booking status by ID
const updateBookingStatus = async (req, res, next) => {
    try {
        const { status, couponCode, discountAmount, finalAmount } = req.body;

        // ✅ Validate status
        const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled', 'scheduled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json(
                ApiResponse.error('Invalid status. Valid statuses: pending, confirmed, completed, cancelled, scheduled')
            );
        }

        // ✅ Build query based on role
        let query;
        if (req.user.role === 'admin') {
            query = { _id: req.params.id };
        } else {
            query = { _id: req.params.id, userId: req.user.userId };

            const allowedUserTransitions = ['pending', 'scheduled', 'cancelled'];
            if (!allowedUserTransitions.includes(status)) {
                return res.status(403).json(
                    ApiResponse.error('Users can only change status to pending, scheduled, or cancelled')
                );
            }
        }

        // ✅ Find current booking
        const currentBooking = await Booking.findOne(query);
        if (!currentBooking) {
            return res.status(404).json(ApiResponse.error('Booking not found or unauthorized'));
        }

        // ✅ Prepare update object
        const updateData = { status };
        if (couponCode !== undefined) updateData.couponCode = couponCode;
        if (discountAmount !== undefined) updateData.discountAmount = discountAmount;
        if (finalAmount !== undefined) updateData.finalAmount = finalAmount;

        // ✅ Update booking
        const booking = await Booking.findOneAndUpdate(
            query,
            updateData,
            { new: true, runValidators: true }
        )
        .populate('serviceId', 'name price duration validity images')
        .populate('therapistId', 'name email role profilePicture');

        if (!booking) {
            return res.status(404).json(ApiResponse.error('Booking not found or unauthorized'));
        }

        // ✅ SEND NOTIFICATIONS FOR STATUS CHANGES
        if (status !== currentBooking.status) {  // Only send if status actually changed
            // Get booking owner's contact information
            const bookingOwner = await User.findById(booking.userId).select('email phone name');

            const statusChange = { from: currentBooking.status, to: status };
            const triggers = BookingStatusHandler.getNotificationTriggers(
                booking,
                null,
                statusChange
            );

            // Send notifications
            for (const trigger of triggers) {
                if (trigger.type === 'user') {
                    await NotificationService.sendNotification(
                        { email: bookingOwner.email, phone: bookingOwner.phone },
                        trigger.template,
                        { ...trigger.data, clientName: bookingOwner.name }
                    );
                } else if (trigger.type === 'admin') {
                    const admins = await User.find({ role: 'admin' }).select('email phone name');
                    for (const admin of admins) {
                        await NotificationService.sendNotification(
                            { email: admin.email, phone: admin.phone },
                            trigger.template,
                            trigger.data
                        );
                    }
                }
            }
        }

        /* =========================================================
           ✅ 1️⃣ AUTO CREATE SESSION (Subscription Covered)
        ========================================================== */
        if (status === 'confirmed' && booking.bookingType === 'subscription-covered') {

            const Session = require('../models/Session.model');

            const sessionDate = booking.scheduledDate || booking.date;
            // Use only the start time for session creation, not the time range
            const sessionTime = booking.timeSlot?.start || booking.scheduledTime || booking.time || '09:00';

            const startTime = new Date(`${sessionDate}T${sessionTime}`);

            const session = new Session({
                bookingId: booking._id,
                therapistId: booking.therapistId,
                userId: booking.userId,
                date: sessionDate,
                time: sessionTime,
                startTime,
                type: '1-on-1',
                status: 'pending',
                duration: 45,
                notes: `Auto-created from confirmed subscription booking #${booking._id}`
            });

            const endTime = new Date(startTime);
            endTime.setMinutes(endTime.getMinutes() + session.duration);
            session.endTime = endTime;

            await session.save();
            console.log(`✅ Session created for subscription booking ${booking._id}`);
        }

        /* =========================================================
           ✅ 2️⃣ AUTO CREATE SESSION FOR REGULAR CONFIRMED BOOKINGS
        ========================================================== */
        if (status === 'confirmed' && booking.scheduleType === 'now' && booking.bookingType !== 'subscription-covered') {
            const Session = require('../models/Session.model');

            const sessionDate = booking.scheduledDate || booking.date;
            // Use only the start time for session creation, not the time range
            const sessionTime = booking.timeSlot?.start || booking.scheduledTime || booking.time || '09:00';

            const startTime = new Date(`${sessionDate}T${sessionTime}`);

            const session = new Session({
                bookingId: booking._id,
                therapistId: booking.therapistId,
                userId: booking.userId,
                date: sessionDate,
                time: sessionTime,
                startTime,
                type: '1-on-1',
                status: 'pending',
                duration: 45,
                notes: `Auto-created from confirmed booking #${booking._id}`
            });

            const endTime = new Date(startTime);
            endTime.setMinutes(endTime.getMinutes() + session.duration);
            session.endTime = endTime;

            await session.save();
            console.log(`✅ Session created for regular booking ${booking._id}`);
        }

        /* =========================================================
           ✅ 2️⃣ FREE CONSULTATION EXPIRY CALCULATION
        ========================================================== */
        if (
            booking.bookingType === 'free-consultation' &&
            booking.paymentStatus === 'paid' &&
            !booking.serviceExpiryDate
        ) {
            const purchaseDate = booking.purchaseDate || booking.createdAt;
            const validityDays = booking.serviceValidityDays || 30;

            const expiryDate = new Date(purchaseDate);
            expiryDate.setDate(expiryDate.getDate() + validityDays);

            booking.serviceExpiryDate = expiryDate;
            booking.serviceValidityDays = validityDays;

            await booking.save();
        }

        /* =========================================================
           ✅ 3️⃣ SLOT UPDATE AFTER PAYMENT CONFIRMATION
        ========================================================== */
        if (
            finalAmount &&
            booking.paymentStatus !== 'paid' &&
            booking.scheduledDate &&
            booking.timeSlot?.start &&
            booking.timeSlot?.end
        ) {

            const Availability = require('../models/Availability.model');

            const availability = await Availability.findOne({
                therapistId: booking.therapistId,
                date: booking.scheduledDate
            });

            if (availability) {

                const slotIndex = availability.timeSlots.findIndex(slot =>
                    slot.start === booking.timeSlot.start &&
                    slot.end === booking.timeSlot.end
                );

                if (slotIndex !== -1) {
                    availability.timeSlots[slotIndex].status = 'booked';
                    await availability.save();
                    console.log(`✅ Slot booked successfully`);
                } else {
                    console.log(`⚠ Slot not found`);
                }

            } else {
                console.log(`⚠ No availability found`);
            }
        }

        return res.status(200).json(
            ApiResponse.success({ booking }, `Booking status updated to ${status} successfully`)
        );

    } catch (error) {
        next(error);
    }
};

// Delete/cancel booking by ID
const deleteBooking = async (req, res, next) => {
    try {
        // Get coupon information if provided
        const { couponCode, discountAmount, finalAmount } = req.body;
        
        // Build query based on user role
        let query;
        if (req.user.role === 'admin') {
            // Admin can delete/cancel any booking
            query = { _id: req.params.id };
        } else {
            // Regular user can only delete/cancel their own bookings
            query = { _id: req.params.id, userId: req.user.userId };
        }

        // Prepare update data
        const updateData = { status: 'cancelled' };
        if (couponCode !== undefined) updateData.couponCode = couponCode;
        if (discountAmount !== undefined) updateData.discountAmount = discountAmount;
        if (finalAmount !== undefined) updateData.finalAmount = finalAmount;
        
        const booking = await Booking.findOneAndUpdate(
            query,
            updateData,
            { new: true }
        )
            .populate('serviceId', 'name price duration validity images')
            .populate('therapistId', 'name email role profilePicture');

        if (!booking) {
            return res.status(404).json(ApiResponse.error('Booking not found or unauthorized'));
        }

        res.status(200).json(ApiResponse.success({ booking }, 'Booking cancelled successfully'));
    } catch (error) {
        next(error);
    }
};

// Update booking status by ID for guest users
const updateGuestBookingStatus = async (req, res, next) => {
    try {
        const { status, couponCode, discountAmount, finalAmount } = req.body;
        const { id: bookingId } = req.params; // Changed from bookingId to id to match the route parameter

        // Validate status
        const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled', 'scheduled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json(ApiResponse.error('Invalid status. Valid statuses: pending, confirmed, completed, cancelled, scheduled'));
        }

        // For guest users, we'll identify the booking by ID and require some identifying information
        // Since guest bookings might be associated with an email, we'll accept email in the request body
        const { clientEmail } = req.body;

        if (!clientEmail) {
            return res.status(400).json(ApiResponse.error('Client email is required for guest booking status update'));
        }

        // Find the booking by ID
        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return res.status(404).json(ApiResponse.error('Booking not found'));
        }

        // Verify that the booking is associated with the provided email
        // This can be done by checking if the user with the provided email owns this booking
        const user = await User.findOne({ email: clientEmail });

        if (user && booking.userId.equals(user._id)) {
            // If the user exists and the booking belongs to them, allow status update
            const updatedBooking = await Booking.findOneAndUpdate(
                { _id: bookingId, userId: user._id },
                { status },
                { new: true, runValidators: true }
            );

            if (!updatedBooking) {
                return res.status(404).json(ApiResponse.error('Booking not found or unauthorized'));
            }

            // Populate the booking before sending response
            await updatedBooking.populate('serviceId', 'name price duration images');
            await updatedBooking.populate('therapistId', 'name email role profilePicture');

            res.status(200).json(ApiResponse.success({ booking: updatedBooking }, `Booking status updated to ${status} successfully`));
        } else {
            // For guest bookings, we need to verify the booking is associated with the provided email
            // We can check if the booking was created for a user with this email
            const bookingUser = await User.findById(booking.userId);

            if (bookingUser && bookingUser.email === clientEmail) {
                // Update the booking status for guest bookings
                // Allow certain status changes for guest bookings
                if (['cancelled', 'scheduled'].includes(status)) {
                    // Allow cancelling and scheduling for guest bookings
                    const updatedBooking = await Booking.findByIdAndUpdate(
                        bookingId,
                        { status },
                        { new: true, runValidators: true }
                    );

                    if (!updatedBooking) {
                        return res.status(404).json(ApiResponse.error('Booking not found'));
                    }

                    // Populate the booking before sending response
                    await updatedBooking.populate('serviceId', 'name price duration');
                    await updatedBooking.populate('therapistId', 'name email role');

                    res.status(200).json(ApiResponse.success({ booking: updatedBooking }, `Booking status updated to ${status} successfully`));
                } else {
                    return res.status(403).json(ApiResponse.error('Unauthorized to update booking status to this value for guest bookings'));
                }
            } else {
                return res.status(403).json(ApiResponse.error('Unauthorized to update this booking status'));
            }
        }
    } catch (error) {
        next(error);
    }
};

// Get all bookings for admin with status-based filtering
const getAllBookingsForAdmin = async (req, res, next) => {
    try {
        // Only allow admin users to access all bookings
        if (req.user.role !== 'admin') {
            return res.status(403).json(ApiResponse.error('Access denied. Admin access only.'));
        }

        const { status, paymentStatus, dateFrom, dateTo } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        // Build query
        let query = {};

        // Show all bookings to admin by default, but allow filtering by payment status
        // Only apply default paymentStatus filter if no specific paymentStatus is requested
        if (!paymentStatus) {
            // Optionally filter to paid bookings only, but this can be overridden
            // For now, removing the hardcoded filter to show all bookings to admin
        } else {
            query.paymentStatus = paymentStatus; // Filter by specific paymentStatus if provided
        }
        
        if (status) query.status = status;
        if (req.query.paymentStatus) query.paymentStatus = req.query.paymentStatus; // Override with specific paymentStatus if provided

        if (dateFrom || dateTo) {
            query.date = {};
            if (dateFrom) query.date.$gte = dateFrom;
            if (dateTo) query.date.$lte = dateTo;
        }

        const skip = (page - 1) * limit;

        const bookings = await Booking.find(query)
            .populate('serviceId', 'name price duration validity images')
            .populate('therapistId', 'name email role profilePicture')
            .populate({
                path: 'userId',
                select: 'name email phone profilePicture joinDate healthProfile',
                populate: {
                    path: 'healthProfile',
                    select: 'questionnaireResponses questionnaireMetadata additionalNotes primaryConcern painIntensity priorTreatments'
                }
            })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Booking.countDocuments(query); // Count all bookings matching the query

        // Add status evaluation to each booking
        const bookingsWithStatus = bookings.map(booking => ({
            ...booking.toObject(),
            statusEvaluation: BookingStatusHandler.evaluateBookingStatus(booking)
        }));

        res.status(200).json(ApiResponse.success({
            bookings: bookingsWithStatus,
            pagination: {
                current: page,
                pages: Math.ceil(total / limit),
                total
            }
        }, 'All bookings retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Get bookings by status with enhanced filtering
const getBookingsByStatus = async (req, res, next) => {
    try {
        const { status } = req.params;
        const { paymentStatus, dateFrom, dateTo } = req.query;

        // Build query based on user role
        let query = { status: status };

        if (req.user.role !== 'admin') {
            // Regular user can only see their own bookings
            query.userId = req.user.userId;
        }

        if (paymentStatus) query.paymentStatus = paymentStatus;

        if (dateFrom || dateTo) {
            query.date = {};
            if (dateFrom) query.date.$gte = dateFrom;
            if (dateTo) query.date.$lte = dateTo;
        }

        const bookings = await Booking.find(query)
            .sort({ createdAt: -1 })
            .populate('serviceId', 'name price duration validity images')
            .populate('therapistId', 'name email role profilePicture')
            .populate('userId', 'name email phone');

        // Add status evaluation
        const bookingsWithStatus = bookings.map(booking => ({
            ...booking.toObject(),
            statusEvaluation: BookingStatusHandler.evaluateBookingStatus(booking)
        }));

        res.status(200).json(ApiResponse.success({
            bookings: bookingsWithStatus
        }, `Bookings with status '${status}' retrieved successfully`));
    } catch (error) {
        next(error);
    }
};

// Create a new booking for guest users
const createGuestBooking = async (req, res, next) => {
    try {
        const { serviceId, date, time, notes, clientName, clientEmail, clientPhone, scheduleType, scheduledDate, scheduledTime, timeSlot, couponCode, discountAmount, finalAmount, bookingType } = req.body;

        // Validate required fields for guest booking
        if (!clientName || !clientEmail || !clientPhone) {
            return res.status(400).json(ApiResponse.error("Name, email, and phone are required for guest booking"));
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(clientEmail)) {
            return res.status(400).json(ApiResponse.error("Invalid email format"));
        }

        // Check for duplicate booking to prevent multiple submissions
        const existingUser = await User.findOne({ email: clientEmail });
        if (existingUser) {
            const existingBooking = await Booking.findOne({
                userId: existingUser._id,
                date: date,
                time: time,
                bookingType: bookingType || 'regular',
                status: { $in: ['pending', 'confirmed', 'scheduled'] }
            });

            if (existingBooking) {
                return res.status(409).json(ApiResponse.error('You already have a booking for this date and time'));
            }
        }

        let service = null;
        let serviceName = "Free Consultation";
        let amount = 0;

        if (bookingType === 'free-consultation') {
            // For free consultations, no service validation needed
        } else {
            // Validate service exists for regular bookings
            service = await Service.findById(serviceId);
            if (!service || service.status !== 'active') {
                return res.status(404).json(ApiResponse.error('Service not found or not active'));
            }
            serviceName = service.name;
            amount = service.price;
        }

        // Check if user already exists
        let user = await User.findOne({ email: clientEmail });

        if (user) {
            // Check if there's already a booking with paid status for this user for the same slot
            const existingPaidBooking = await Booking.findOne({
                userId: user._id,
                paymentStatus: 'paid',
                serviceId: serviceId,
                date: date,
                time: time
            });

            if (existingPaidBooking) {
                // If there's already a paid booking for this slot, return appropriate message
                return res.status(409).json(ApiResponse.error(`You already have a paid booking for this time slot.`));
            }

            // If user exists but doesn't have a paid booking for this slot, use existing user
            // This allows users to make additional bookings
        } else {
            // Create a new user account with temporary password
            const tempPassword = Math.random().toString(36).slice(-8) + 'Temp1!'; // Generate temporary password

            user = new User({
                name: clientName,
                email: clientEmail,
                password: tempPassword, // Will be hashed by the pre-save hook
                phone: clientPhone,
                role: 'patient',
                status: 'active',
                hasTempPassword: true
            });

            await user.save();
        }

        // Automatically assign an available therapist (admin user)
        const therapist = await User.findOne({
            role: 'admin',
            status: 'active'
        });

        if (!therapist) {
            return res.status(404).json(ApiResponse.error('No active therapists available'));
        }

        // If scheduling now, validate the scheduled date and time
        if (scheduleType === 'now' && scheduledDate && scheduledTime) {
            // Check if the requested time slot is available
            const slotAvailability = await checkTimeSlotAvailability(therapist._id, scheduledDate, scheduledTime, timeSlot, bookingType);

            if (!slotAvailability.available) {
                return res.status(409).json(ApiResponse.error(slotAvailability.message));
            }
        }

        const booking = new Booking({
            serviceId: bookingType === 'free-consultation' ? serviceId : serviceId,
            serviceName: serviceName,
            therapistId: therapist._id,
            therapistName: therapist?.name || 'Admin',
            userId: user._id,
            clientName: clientName,
            date,
            time,
            notes,
            amount: amount,
            originalAmount: amount,
            finalAmount: finalAmount || amount,
            couponCode: couponCode || null,
            discountAmount: discountAmount || 0,
            paymentStatus: bookingType === 'free-consultation' ? 'paid' : 'pending',
            purchaseDate: new Date(),
            scheduleType: scheduleType || 'now',
            scheduledDate: scheduledDate || date || null,
            scheduledTime: scheduledTime || (timeSlot ? `${timeSlot.start}-${timeSlot.end}` : time) || null,
            timeSlot: timeSlot || (time && time.includes('-') ? {
                start: time.split('-')[0],
                end: time.split('-')[1]
            } : null),
            bookingType: bookingType || 'regular',
            status: bookingType === 'free-consultation' ? 'pending' : ((scheduledDate && scheduledTime) ? 'scheduled' : (scheduleType === 'later' ? 'pending' : 'scheduled'))
        });

        await booking.save();

        // Send booking confirmation notifications for free consultations
        if (bookingType === 'free-consultation') {
            try {
                const notificationService = require('../services/notificationService');
                
                // Prepare notification data
                const notificationData = {
                    clientName: clientName,
                    serviceName: booking.serviceName,
                    date: booking.scheduledDate || booking.date,
                    time: booking.scheduledTime || booking.time,
                    therapistName: booking.therapistName,
                    bookingId: booking._id
                };
                
                // Send email notification
                if (clientEmail) {
                    try {
                        await notificationService.sendEmail(
                            clientEmail,
                            'booking_confirmation',
                            notificationData
                        );
                        console.log(`✅ Email notification sent for guest free consultation booking ${booking._id}`);
                    } catch (emailError) {
                        console.error(`❌ Failed to send email for guest booking ${booking._id}:`, emailError);
                    }
                }
                
                // Send WhatsApp notification
                if (clientPhone) {
                    try {
                        await notificationService.sendWhatsApp(
                            clientPhone,
                            (data) => `🎉 Booking Confirmed!

Hello ${data.clientName},

Your free consultation with ${data.therapistName} is confirmed for ${data.date} at ${data.time}.

Booking ID: ${data.bookingId}

Looking forward to helping you!

- Tanish Physio Team`,
                            notificationData
                        );
                        console.log(`✅ WhatsApp notification sent for guest free consultation booking ${booking._id}`);
                    } catch (whatsappError) {
                        console.error(`❌ Failed to send WhatsApp for guest booking ${booking._id}:`, whatsappError);
                    }
                }
            } catch (notificationError) {
                console.error(`❌ Error sending notifications for guest booking ${booking._id}:`, notificationError);
                // Don't fail the booking if notifications fail
            }
        }

        // If scheduling now, update availability to mark the slot as tentative until payment is confirmed
        if (scheduleType === 'now' && scheduledDate && scheduledTime && timeSlot) {
            // Mark slot as tentative if payment is pending, booked if payment is confirmed
            const slotStatus = booking.paymentStatus === 'paid' ? 'booked' : 'tentative';
            await updateAvailabilitySlot(therapist._id, scheduledDate, timeSlot.start, timeSlot.end, slotStatus);
        }

        // Populate the response
        await booking.populate('serviceId', 'name price duration validity images');
        await booking.populate('therapistId', 'name email role profilePicture');

        // Send notifications to guest user
        const notificationData = {
            clientName: clientName,
            serviceName: serviceName,
            bookingId: booking._id,
            date: date,
            time: time
        };

        // Notify admins
        const admins = await User.find({ role: 'admin' }).select('email phone name');
        for (const admin of admins) {
            await NotificationService.sendNotification(
                { email: admin.email, phone: admin.phone },
                'new_booking',
                { ...notificationData, clientName: clientName }
            );
        }

        // Generate JWT token for auto-login
        const token = generateToken({ userId: user._id.toString(), role: user.role });

        res.status(201).json(ApiResponse.success({
            booking,
            token,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                role: user.role,
                phone: user.phone
            },
            message: 'Account created and booking made successfully. You are now logged in.'
        }, 'Account created and booking made successfully. You are now logged in.'));
    } catch (error) {
        next(error);
    }
};

// Helper function to calculate service expiry when booking is paid
async function calculateServiceExpiryForBooking(bookingId) {
    const Service = require('../models/Service.model');

    const booking = await Booking.findById(bookingId);
    if (booking && booking.paymentStatus === 'paid') {
        if (booking.bookingType === 'free-consultation') {
            // For free consultations, use the serviceValidityDays field or default to 30 days
            // Expiration should be calculated from the scheduled date, not purchase date
            const validityDays = booking.serviceValidityDays || 30;
            // Use the scheduled date if available, otherwise fall back to purchase date
            const baseDate = booking.scheduledDate ? 
                new Date(`${booking.scheduledDate}T00:00:00`) : 
                (booking.purchaseDate || booking.createdAt);
            const expiryDate = new Date(baseDate);
            expiryDate.setDate(baseDate.getDate() + validityDays);

            booking.serviceExpiryDate = expiryDate;
            booking.serviceValidityDays = validityDays;

            await booking.save();
        } else {
            // Calculate service expiry based on the service's validity
            const service = await Service.findById(booking.serviceId);
            if (service && service.validity > 0) {
                // Calculate expiry date based on service validity
                // Use the scheduled date if available, otherwise fall back to purchase date
                const baseDate = booking.scheduledDate ? 
                    new Date(`${booking.scheduledDate}T00:00:00`) : 
                    (booking.purchaseDate || booking.createdAt);
                const expiryDate = new Date(baseDate);
                expiryDate.setDate(baseDate.getDate() + service.validity);

                booking.serviceExpiryDate = expiryDate;
                booking.serviceValidityDays = service.validity;

                await booking.save();
            }
        }
    }
}

// Admin-only: Bulk status update
const bulkUpdateStatus = async (req, res, next) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json(ApiResponse.error('Admin access required'));
        }

        const { bookingIds, status, cancellationReason } = req.body;

        if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
            return res.status(400).json(ApiResponse.error('Booking IDs are required'));
        }

        if (!status) {
            return res.status(400).json(ApiResponse.error('Status is required'));
        }

        // Validate all booking IDs exist
        const existingBookings = await Booking.find({
            _id: { $in: bookingIds }
        });

        if (existingBookings.length !== bookingIds.length) {
            return res.status(404).json(ApiResponse.error('Some bookings not found'));
        }

        // Update all bookings
        const updateData = { status };
        if (status === 'cancelled' && cancellationReason) {
            updateData.cancellationReason = cancellationReason;
        }

        const result = await Booking.updateMany(
            { _id: { $in: bookingIds } },
            updateData,
            { runValidators: true }
        );

        res.status(200).json(ApiResponse.success({
            modifiedCount: result.modifiedCount,
            matchedCount: result.matchedCount
        }, `${result.modifiedCount} bookings updated successfully`));
    } catch (error) {
        next(error);
    }
};

// Get booking statistics
const getBookingStats = async (req, res, next) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json(ApiResponse.error('Admin access required'));
        }

        const stats = await Booking.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$amount' }
                }
            },
            {
                $project: {
                    status: '$_id',
                    count: 1,
                    totalAmount: 1,
                    _id: 0
                }
            }
        ]);

        const paymentStats = await Booking.aggregate([
            {
                $group: {
                    _id: '$paymentStatus',
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    paymentStatus: '$_id',
                    count: 1,
                    _id: 0
                }
            }
        ]);

        res.status(200).json(ApiResponse.success({
            bookingStats: stats,
            paymentStats: paymentStats
        }, 'Booking statistics retrieved successfully'));
    } catch (error) {
        next(error);
    }
};
module.exports = {
    getAllBookings,
    getBookingById,
    createBooking,
    createGuestBooking,
    updateBooking,
    updateBookingStatus,
    updateGuestBookingStatus,
    deleteBooking,
    getBookingsByStatus,
    getAllBookingsForAdmin,
    getBookingDetails, // Single unified function
    checkSlotAvailability,
    updateBookingWithSchedule,

    // Enhanced functions
    bulkUpdateStatus,
    getBookingStats
};

// Create a booking that uses subscription session (no payment required)
const createBookingWithSubscription = async (req, res, next) => {
    try {
        // Check if user is authenticated
        if (!req.user || !req.user.userId) {
            return res.status(401).json(ApiResponse.error('Authentication required'));
        }

        const { serviceId, date, time, notes, clientName, scheduleType, scheduledDate, scheduledTime, timeSlot } = req.body;

        // Check if user has an active subscription with remaining sessions
        const subscription = await Subscription.findOne({ 
            userId: req.user.userId, 
            status: 'active' 
        }).populate('planId');
        
        if (!subscription) {
            return res.status(400).json(ApiResponse.error('No active subscription found'));
        }
        
        if (subscription.isExpired) {
            return res.status(400).json(ApiResponse.error('Subscription has expired'));
        }
        
        // Fetch the plan data manually since planId might be a string field
        let plan = null;
        if (subscription.planId) {
            const isValidObjectId = require('mongoose').Types.ObjectId.isValid(subscription.planId);
            if (isValidObjectId) {
                const SubscriptionPlan = require('../models/SubscriptionPlan.model');
                plan = await SubscriptionPlan.findById(subscription.planId);
            } else {
                // Try to find by planId string
                const SubscriptionPlan = require('../models/SubscriptionPlan.model');
                plan = await SubscriptionPlan.findOne({ planId: subscription.planId });
            }
        }
        
        if (!plan) {
            console.error(`Plan not found for subscription ${subscription._id}`);
            return res.status(400).json(ApiResponse.error('Subscription plan not found'));
        }
        
        console.log(`Booking with subscription check:`, {
            subscriptionId: subscription._id,
            planName: plan.name,
            planSessions: plan.sessions,
            planType: typeof plan.sessions,
            userId: req.user.userId
        });
        
        // Check session limits - enforce actual session limit from subscription
        // Only count actual Session documents, not Booking documents
        const usedSessions = await Session.countDocuments({
            subscriptionId: subscription._id,
            status: { $ne: "cancelled" }
        });
        
        // Get total sessions from subscription plan (consider both sessions and totalService fields)
        // Some plans might use 'totalService' instead of 'sessions' field
        let totalSessions = 0;
        if (plan && typeof plan.sessions === 'number') {
            totalSessions = plan.sessions;
        } else if (plan && typeof plan.totalService === 'number') {
            totalSessions = plan.totalService;
        }
        const remainingSessions = totalSessions - usedSessions;
        
        console.log(`Session check for subscription ${subscription._id}:`, {
            planName: plan.name,
            planSessions: plan.sessions,
            planTotalService: plan.totalService,
            totalSessions: totalSessions,
            usedSessions: usedSessions,
            remainingSessions: remainingSessions
        });
        
        if (totalSessions <= 0) {
            console.log(`NO_SESSIONS_IN_PLAN triggered:`, {
                planSessions: plan.sessions,
                planTotalService: plan.totalService,
                totalSessions: totalSessions,
                planType: typeof plan.sessions
            });
            return res.status(400).json(ApiResponse.error(
                'Your subscription plan does not include any sessions. Please upgrade your plan.',
                'NO_SESSIONS_IN_PLAN'
            ));
        }
        
        if (remainingSessions <= 0) {
            return res.status(400).json(ApiResponse.error(
                `Session limit reached. You have used all ${totalSessions} sessions in your plan.`
            ));
        }

        // Validate service exists
        let service = null;
        let serviceName = "Session with Subscription";
        
        if (serviceId) {
            service = await Service.findById(serviceId);
            
            if (!service || service.status !== 'active') {
                return res.status(404).json(ApiResponse.error('Service not found or not active'));
            }
            
            serviceName = service.name;
        }

        // Automatically assign an available therapist (admin user)
        const therapist = await User.findOne({
            role: 'admin',
            status: 'active'
        });

        if (!therapist) {
            return res.status(404).json(ApiResponse.error('No active therapists available'));
        }

        // Create booking with paid status (since it's covered by subscription)
        const booking = new Booking({
            ...(serviceId && { serviceId }),
            serviceName: serviceName,
            therapistId: therapist._id,
            therapistName: therapist?.name || 'Admin',
            userId: req.user.userId,
            clientName: clientName || req.user?.name || 'Unknown User',
            date,
            time,
            notes,
            amount: 0, // No charge as it's covered by subscription
            originalAmount: 0,
            finalAmount: 0,
            paymentStatus: 'paid', // Mark as paid since it's covered by subscription
            status: 'pending', // All subscription bookings start with pending status for admin approval
            serviceValidityDays: service?.validity,
            purchaseDate: new Date(),
            scheduleType: scheduleType || 'now',
            scheduledDate: scheduledDate || null,
            scheduledTime: scheduledTime || null,
            timeSlot: timeSlot || null,
            bookingType: 'subscription-covered',
            subscriptionId: subscription._id // Link booking to subscription
        });

        await booking.save();

        // Don't create sessions automatically for subscription bookings
        // Sessions will be created by admin after accepting the booking
        console.log(`Subscription booking created with pending status. Admin will create session after acceptance.`);
        console.log(`User has ${remainingSessions === 'unlimited' ? 'unlimited' : remainingSessions} sessions remaining.`);

        // Populate the response
        await booking.populate('serviceId', 'name price duration validity images');
        await booking.populate('therapistId', 'name email role profilePicture');

        // Send notifications
        const notificationData = {
            clientName: req.user?.name || 'Unknown User',
            serviceName: serviceName,
            bookingId: booking._id,
            date: date,
            time: time,
            remainingSessions: remainingSessions
        };

        // Notify admins
        const admins = await User.find({ role: 'admin' }).select('email phone name');
        for (const admin of admins) {
            await NotificationService.sendNotification(
                { email: admin.email, phone: admin.phone },
                'new_booking',
                { ...notificationData, clientName: req.user?.name || 'Unknown User' }
            );
        }

        res.status(201).json(ApiResponse.success({ 
            booking, 
            subscriptionInfo: {
                totalSessions: plan.sessions,
                usedSessions: usedSessions,
                remainingSessions: remainingSessions
            }
        }, 'Session booked successfully with your subscription'));        
    } catch (error) {
        next(error);
    }
};

// Check if user can book service with subscription (session-based)
const checkSubscriptionBookingEligibility = async (req, res, next) => {
    try {
        const { serviceId } = req.query;
        
        if (!req.user || !req.user.userId) {
            return res.status(401).json(ApiResponse.error('Authentication required'));
        }
        
        // Check if user has an active subscription
        const subscription = await Subscription.findOne({ 
            userId: req.user.userId, 
            status: 'active' 
        }).populate('planId');
        
        if (!subscription) {
            return res.status(200).json(ApiResponse.success({
                eligible: false,
                reason: 'No active subscription found',
                message: 'You need an active subscription to book sessions'
            }));
        }
        
        if (subscription.isExpired) {
            return res.status(200).json(ApiResponse.success({
                eligible: false,
                reason: 'Subscription expired',
                message: 'Your subscription has expired'
            }));
        }
        
        const plan = subscription.planId;
        
        // Check session limits (this is the primary constraint)
        let usedSessions = 0;
        let remainingSessions = 0;
        
        if (plan && plan.sessions > 0) {
            usedSessions = await Session.countDocuments({
                subscriptionId: subscription._id,
                status: { $ne: "cancelled" }
            });
            
            remainingSessions = plan.sessions - usedSessions;
            
            if (remainingSessions <= 0) {
                return res.status(200).json(ApiResponse.success({
                    eligible: false,
                    reason: 'Session limit reached',
                    message: `You have used all ${plan.sessions} sessions in your plan`,
                    totalSessions: plan.sessions,
                    usedSessions: usedSessions,
                    remainingSessions: remainingSessions
                }));
            }
        } else {
            // Unlimited sessions
            remainingSessions = 'unlimited';
        }
        
        // Check if service exists and is active
        let service = null;
        if (serviceId) {
            service = await Service.findById(serviceId);
            if (!service || service.status !== 'active') {
                return res.status(200).json(ApiResponse.success({
                    eligible: false,
                    reason: 'Service not available',
                    message: 'Service not found or not active'
                }));
            }
        }
        
        res.status(200).json(ApiResponse.success({
            eligible: true,
            subscription: {
                id: subscription._id,
                planName: plan.name,
                planId: plan.planId,
                totalSessions: plan.sessions,
                usedSessions: usedSessions,
                remainingSessions: remainingSessions,
                totalServices: plan.totalService || 0,
                sessionType: plan.session_type || 'individual'
            },
            service: service ? {
                id: service._id,
                name: service.name,
                duration: service.duration,
                category: service.category
            } : null,
            message: `You can book this service. You have ${remainingSessions === 'unlimited' ? 'unlimited' : remainingSessions} sessions remaining.`
        }));
        
    } catch (error) {
        next(error);
    }
};

// Adding the new function to the existing module.exports
module.exports.createBookingWithSubscription = createBookingWithSubscription;
module.exports.checkSubscriptionBookingEligibility = checkSubscriptionBookingEligibility;

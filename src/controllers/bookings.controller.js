const Booking = require('../models/Booking.model');
const Service = require('../models/Service.model');
const User = require('../models/User.model');
const Payment = require('../models/Payment.model');
const Subscription = require('../models/Subscription.model');
const Session = require('../models/Session.model');
const Availability = require('../models/Availability.model'); // Added for group session support
const ApiResponse = require('../utils/apiResponse');
const BookingStatusHandler = require('../services/bookingStatusHandler');
const NotificationService = require('../services/notificationService');
const { generateToken } = require('../config/jwt');
const { getIO } = require('../utils/socketManager'); // Import socket manager
const logger = require('../utils/logger'); // Import logger

// Get all bookings for authenticated user
const getAllBookings = async (req, res, next) => {
    try {
        const bookings = await Booking.find({
            userId: req.user.userId,
            paymentStatus: 'paid' // Only show bookings where payment has been completed
        })
            .sort({ createdAt: -1 }) // Sort by createdAt descending
            .populate('serviceId', 'name price priceINR priceUSD duration validity images')
            .populate('therapistId', 'name email role profilePicture');

        // Add duration information for subscription-covered bookings
        const bookingsWithDuration = bookings.map(booking => {
            const bookingObj = booking.toObject();

            // For subscription-covered bookings without serviceId, add plan duration
            if (booking.bookingType === 'subscription-covered' && !booking.serviceId) {
                // Try to get duration from timeSlot
                if (booking.timeSlot?.start && booking.timeSlot?.end) {
                    const [startHours, startMinutes] = booking.timeSlot.start.split(':').map(Number);
                    const [endHours, endMinutes] = booking.timeSlot.end.split(':').map(Number);
                    const duration = (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes);
                    bookingObj.planDuration = `${duration} min`;
                } else {
                    // Default duration for subscription bookings
                    bookingObj.planDuration = '45 min';
                }
            }

            return bookingObj;
        });

        res.status(200).json(ApiResponse.success({ bookings: bookingsWithDuration }, 'Bookings retrieved successfully'));
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
            .populate('serviceId', 'name price priceINR priceUSD duration validity images')
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

        // Add duration information for subscription-covered bookings
        if (booking.bookingType === 'subscription-covered' && !booking.serviceId) {
            // Try to get duration from timeSlot
            if (booking.timeSlot?.start && booking.timeSlot?.end) {
                const [startHours, startMinutes] = booking.timeSlot.start.split(':').map(Number);
                const [endHours, endMinutes] = booking.timeSlot.end.split(':').map(Number);
                const duration = (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes);
                bookingObject.planDuration = `${duration} min`;
            } else {
                // Default duration for subscription bookings
                bookingObject.planDuration = '45 min';
            }
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
            .populate('serviceId', 'name price priceINR priceUSD duration description validity images')
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

        const { serviceId, date, time, notes, clientName, scheduleType, scheduledDate, scheduledTime, timeSlot, couponCode, discountAmount, finalAmount, bookingType, isScheduledLater } = req.body;

        // For schedule later, ignore the time field completely
        // Only validate time when scheduleType is 'now' or when actual scheduling is happening
        if (scheduleType === 'later') {
            // Clear the time field as it's not relevant for "Schedule Later"
            // Admin will set the actual time when confirming the booking
        }

        // Validate user's subscription plan type matches the slot session type
        if (scheduledDate && scheduledTime && timeSlot) {
            const availability = await Availability.findOne({
                therapistId: req.body.therapistId || (await User.findOne({ role: 'admin', status: 'active' }))._id,
                date: scheduledDate
            });

            if (availability) {
                const slot = availability.timeSlots.find(s =>
                    s.start === timeSlot.start && s.end === timeSlot.end
                );

                if (slot) {
                    // Get user's subscription info to validate plan type
                    const user = await User.findById(req.user.userId);

                    if (user && user.subscriptionInfo && user.subscriptionInfo.planId) {
                        const SubscriptionPlan = require('../models/SubscriptionPlan.model');
                        const userPlan = await SubscriptionPlan.findOne({
                            $or: [
                                { _id: user.subscriptionInfo.planId },
                                { planId: user.subscriptionInfo.planId }
                            ]
                        });

                        if (userPlan) {
                            // Validate session type matches plan type
                            const planSessionType = userPlan.session_type || 'individual';
                            const slotSessionType = slot.sessionType || 'one-to-one';

                            // Map 'one-to-one' to 'individual' for comparison
                            const normalizedSlotType = slotSessionType === 'one-to-one' ? 'individual' : slotSessionType;

                            if (planSessionType !== normalizedSlotType) {
                                return res.status(403).json(ApiResponse.error(
                                    `Your ${userPlan.name} plan only allows ${userPlan.session_type} sessions. This slot is for ${slot.sessionType} sessions.`
                                ));
                            }
                        }
                    }
                }
            }
        }

        // Check for duplicate booking to prevent multiple submissions
        // Only check for bookings that are confirmed or completed (not pending payment)
        const existingBooking = await Booking.findOne({
            userId: req.user.userId,
            date: date,
            time: time,
            bookingType: bookingType || 'regular',
            status: { $in: ['confirmed', 'scheduled', 'completed'] }, // Only block if booking is confirmed/active
            paymentStatus: 'paid' // Only consider bookings that have been paid
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
            // For free consultations, check if user has already used their free session(s)
            const User = require('../models/User.model');
            const user = await User.findById(req.user.userId);

            if (!user) {
                return res.status(404).json(ApiResponse.error('User not found'));
            }

            // Calculate how many free consultations the user is eligible for
            let maxFreeConsultations = 1; // Default: 1 free consultation for all users

            // Check if user has an active subscription
            if (subscription && !subscription.isExpired) {
                let plan = null;
                if (subscription.planId) {
                    const isValidObjectId = require('mongoose').Types.ObjectId.isValid(subscription.planId);
                    if (isValidObjectId) {
                        const SubscriptionPlan = require('../models/SubscriptionPlan.model');
                        plan = await SubscriptionPlan.findById(subscription.planId);
                    } else {
                        const SubscriptionPlan = require('../models/SubscriptionPlan.model');
                        plan = await SubscriptionPlan.findOne({ planId: subscription.planId });
                    }
                }

                if (plan) {
                    // Check plan duration to determine free sessions
                    if (plan.duration === 'monthly') {
                        maxFreeConsultations = 2; // Monthly plan gets 2 free sessions
                    } else if (plan.duration === 'one-time') {
                        maxFreeConsultations = 1; // One-time plan gets 1 free session
                    }
                }
            }

            // Check if user has already used their free consultations
            const freeConsultationsUsed = user.freeConsultationsUsed || 0;

            if (freeConsultationsUsed >= maxFreeConsultations) {
                return res.status(400).json(ApiResponse.error(
                    `You have already used your ${maxFreeConsultations} free consultation${maxFreeConsultations > 1 ? 's' : ''}. Please book a regular session.`
                ));
            }
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
                // Use priceINR for India, fallback to old price field and parse it
                amount = service.priceINR || (typeof service.price === 'string' ? parseInt(service.price.replace(/[₹$,]/g, '')) : service.price) || 0;
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
                    // Use priceINR for India, fallback to old price field and parse it
                    amount = service.priceINR || (typeof service.price === 'string' ? parseInt(service.price.replace(/[₹$,]/g, '')) : service.price) || 0;
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
                    // Use priceINR for India, fallback to old price field and parse it
                    amount = service.priceINR || (typeof service.price === 'string' ? parseInt(service.price.replace(/[₹$,]/g, '')) : service.price) || 0;
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
            // Use priceINR for India, fallback to old price field and parse it
            amount = service.priceINR || (typeof service.price === 'string' ? parseInt(service.price.replace(/[₹$,]/g, '')) : service.price) || 0;
        }

        // Automatically assign an available therapist (admin user)
        const therapist = await User.findOne({
            role: 'admin',
            status: 'active'
        });

        if (!therapist) {
            return res.status(404).json(ApiResponse.error('No active therapists available'));
        }

        // Always validate the scheduled date and time if provided, regardless of schedule type
        if (scheduledDate && scheduledTime) {
            // Check if the requested time slot is available
            const slotAvailability = await checkTimeSlotAvailability(
                therapist._id,
                scheduledDate,
                scheduledTime,
                timeSlot,
                bookingType,
                req.user.userId,
                serviceId
            );

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
            status: req.user.role === 'admin' && !bookingType ? 'pending' : (bookingType === 'subscription-covered' ? 'pending' : (bookingType === 'free-consultation' ? 'pending' : (isScheduledLater ? 'to-be-scheduled' : ((scheduledDate && scheduledTime) ? 'pending' : 'pending')))),
            serviceValidityDays: bookingType === 'free-consultation' ? 30 : service?.validity, // Free consultation has 30 days validity
            purchaseDate: new Date(),
            scheduleType: scheduleType || 'now',
            scheduledDate: scheduledDate || date || null,
            scheduledTime: scheduledTime || (timeSlot ? `${timeSlot.start}-${timeSlot.end}` : time) || null,
            timeSlot: timeSlot || (time && time.includes('-') ? {
                start: time.split('-')[0],
                end: time.split('-')[1]
            } : null),
            bookingType: bookingTypeFinal,
            // For schedule later option, add metadata to indicate it's not yet scheduled
            ...(isScheduledLater && { isScheduledLater: true, scheduledDate: null, scheduledTime: null, timeSlot: null })
        });

        await booking.save();

        // Increment free consultations used counter for free consultation bookings
        if (bookingTypeFinal === 'free-consultation') {
            const User = require('../models/User.model');
            await User.findByIdAndUpdate(req.user.userId, {
                $inc: { freeConsultationsUsed: 1 }
            });
        }

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

                    // Send notification to admin as well
                    try {
                        await notificationService.sendNotification(
                            { email: 'admin@tanishphysio.com', phone: 'admin' }, // Recipient data is handled by service for admin types
                            'new_booking',
                            {
                                ...notificationData,
                                clientName: user.name,
                                phone: user.phone || 'N/A',
                                serviceName: `${booking.serviceName} (Free Consultation)`
                            }
                        );
                        console.log(`✅ Admin notification triggered for free consultation booking ${booking._id}`);
                    } catch (adminNotifyError) {
                        console.error(`❌ Failed to send admin notification for booking ${booking._id}:`, adminNotifyError);
                    }
                }
            } catch (notificationError) {
                console.error(`❌ Error sending notifications for booking ${booking._id}:`, notificationError);
                // Don't fail the booking if notifications fail
            }
        }

        // ⚠️ NOTE: Session creation for subscription-covered bookings is now handled in updateBookingStatus
        // when status changes to 'confirmed' to avoid duplicate sessions

        // If scheduling now, update availability to mark the slot as tentative until payment is confirmed
        if (scheduleType === 'now' && scheduledDate && scheduledTime && timeSlot) {
            // Mark slot as tentative if payment is pending, booked if payment is confirmed
            const slotStatus = booking.paymentStatus === 'paid' ? 'booked' : 'tentative';
            await updateAvailabilitySlot(therapist._id, scheduledDate, timeSlot.start, timeSlot.end, slotStatus);
        }

        // Populate the response
        await booking.populate('serviceId', 'name price priceINR priceUSD duration validity images');
        await booking.populate('therapistId', 'name email role profilePicture');

        // Send real-time notification to admin panel
        try {
            const io = getIO();
            const Notification = require('../models/Notification.model');

            console.log(`📢 [Booking Notification] Preparing admin notification for booking ${booking._id}:`, {
                bookingType: bookingTypeFinal,
                paymentStatus: booking.paymentStatus,
                serviceName: serviceName,
                clientName: booking.clientName,
                date: date,
                time: time
            });

            // Save to database first
            const adminNotification = new Notification({
                title: isFreeConsultation ? 'New Free Consultation Request' : 'New Booking Request',
                message: `${booking.clientName} booked ${serviceName}${isFreeConsultation ? ' (Free Consultation)' : ''} for ${date} at ${time}`,
                type: 'booking',
                recipientType: 'admin',
                adminId: null, // Broadcast to all admins
                bookingId: booking._id,
                priority: isFreeConsultation ? 'high' : 'medium',
                channels: { inApp: true },
                metadata: {
                    clientName: booking.clientName,
                    serviceName: serviceName,
                    date: date,
                    time: time,
                    status: booking.status,
                    bookingType: bookingTypeFinal
                }
            });

            await adminNotification.save();
            console.log(`✅ [Booking Notification] Saved to database: ${adminNotification._id}`);

            // Emit with database ID
            const notificationPayload = {
                id: adminNotification._id,
                type: 'booking',
                title: isFreeConsultation ? 'New Free Consultation Request' : 'New Booking Request',
                message: `${booking.clientName} booked ${serviceName}${isFreeConsultation ? ' (Free Consultation)' : ''} for ${date} at ${time}`,
                bookingId: booking._id,
                clientName: booking.clientName,
                serviceName: isFreeConsultation ? `${serviceName} (Free Consultation)` : serviceName,
                date: date,
                time: time,
                status: booking.status,
                priority: adminNotification.priority,
                timestamp: adminNotification.createdAt
            };

            console.log(`📡 [Booking Notification] Emitting to admin_notifications room:`, notificationPayload);
            io.to('admin_notifications').emit('admin-notification', notificationPayload);

            logger.info(`Real-time notification saved and sent to admin for new booking ${booking._id}`);
            console.log(`✅ [Booking Notification] Successfully sent to admin for booking ${booking._id} (${bookingTypeFinal})`);
        } catch (socketError) {
            logger.error('Error sending real-time booking notification to admin:', socketError);
            console.error(`❌ [Booking Notification] Failed to send notification for booking ${booking._id}:`, socketError);
            // Don't fail the booking if socket notification fails
        }

        res.status(201).json(ApiResponse.success({ booking }, 'Booking created successfully'));
    } catch (error) {
        next(error);
    }
};

// Helper function to check time slot availability
async function checkTimeSlotAvailability(therapistId, date, time, timeSlot, bookingType, userId, serviceId = null) {
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

    // Handle free consultation - Bypass Availability check but maintain conflict check
    if (bookingType === 'free-consultation') {
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

        return { available: true, message: 'Free consultation slot is available' };
    }

    // Check if there's availability for the therapist on the given date
    const availability = await Availability.findOne({
        therapistId,
        date
    });

    let requestedSlot = null;

    if (availability) {
        // Check if the requested time slot exists in availability
        if (timeSlot) {
            // Validate timeSlot format
            if (!timeSlot.start || !timeSlot.end) {
                return { available: false, message: 'Invalid time slot format. Both start and end times are required.' };
            }

            console.log('[checkTimeSlotAvailability] Looking for slot:', timeSlot);
            console.log('[checkTimeSlotAvailability] Available slots:', availability.timeSlots.map(s => `${s.start}-${s.end} (${s.status}, ${s.bookingType})`));

            // For booking type validation, we need to check if the slot duration matches the booking type
            requestedSlot = availability.timeSlots.find(slot =>
                slot.start === timeSlot.start &&
                slot.end === timeSlot.end
            );

            if (!requestedSlot) {
                // Provide more detailed error message
                const existingSlot = availability.timeSlots.find(slot =>
                    slot.start === timeSlot.start && slot.end === timeSlot.end
                );

                if (!existingSlot) {
                    return {
                        available: false,
                        message: `No time slot found for ${timeSlot.start}-${timeSlot.end}. Please select a different time or check availability settings.`
                    };
                } else if (existingSlot.status === 'booked') {
                    return {
                        available: false,
                        message: `This time slot (${timeSlot.start}-${timeSlot.end}) is already booked. Please select another slot.`
                    };
                } else if (existingSlot.status === 'unavailable' || existingSlot.status === 'tentative') {
                    return {
                        available: false,
                        message: `This time slot (${timeSlot.start}-${timeSlot.end}) is not available (${existingSlot.status}). Please select another slot.`
                    };
                }

                return { available: false, message: 'Requested time slot is not available' };
            }

            // If slot is marked booked, it is not available
            if (requestedSlot.status === 'booked') {
                return { available: false, message: 'Requested time slot is not available' };
            }

            // Group slot availability is based on bookedParticipants
            if (requestedSlot.sessionType === 'group') {
                if (typeof requestedSlot.bookedParticipants !== 'number') {
                    requestedSlot.bookedParticipants = 0;
                }
                if (requestedSlot.bookedParticipants >= (requestedSlot.maxParticipants || 1)) {
                    return { available: false, message: 'Requested time slot is full' };
                }

                // If slot has a specific service attached, enforce service match
                if (requestedSlot.serviceId && serviceId) {
                    const slotServiceId = String(requestedSlot.serviceId);
                    const requestedServiceId = String(serviceId);
                    if (slotServiceId !== requestedServiceId) {
                        return { available: false, message: 'This group slot is not available for the selected service' };
                    }
                }
            }

            // Validate user's subscription plan type matches the slot session type (if userId provided)
            if (userId) {
                const user = await User.findById(userId);
                if (user && user.subscriptionInfo && user.subscriptionInfo.planId) {
                    const SubscriptionPlan = require('../models/SubscriptionPlan.model');
                    const userPlan = await SubscriptionPlan.findOne({
                        $or: [
                            { _id: user.subscriptionInfo.planId },
                            { planId: user.subscriptionInfo.planId }
                        ]
                    });

                    if (userPlan) {
                        const planSessionType = userPlan.session_type || 'individual';
                        const slotSessionType = requestedSlot.sessionType || 'one-to-one';
                        const normalizedSlotType = slotSessionType === 'one-to-one' ? 'individual' : slotSessionType;

                        if (planSessionType !== normalizedSlotType) {
                            return {
                                available: false,
                                message: `Your ${userPlan.name} plan only allows ${userPlan.session_type} sessions. This slot is for ${requestedSlot.sessionType} sessions.`
                            };
                        }
                    }
                }
            }

            // Validate that the slot duration matches the expected duration for the booking type
            if (bookingType === 'free-consultation' && requestedSlot.duration !== 15) {
                return { available: false, message: 'Free consultation requires 15-minute time slots' };
            } else if (bookingType === 'regular' && requestedSlot.duration !== 45) {
                return { available: false, message: 'Regular sessions require 45-minute time slots' };
            }
        } else {
            // If no specific timeSlot provided, just check if the time exists and is available
            requestedSlot = availability.timeSlots.find(slot =>
                slot.start === time && slot.status !== 'booked'
            );

            if (!requestedSlot) {
                const existingSlot = availability.timeSlots.find(slot => slot.start === time);
                if (!existingSlot) {
                    return {
                        available: false,
                        message: `No time slot found for ${time}. Please select a different time or check availability settings.`
                    };
                } else if (existingSlot.status === 'booked') {
                    return {
                        available: false,
                        message: `This time slot (${time}) is already booked. Please select another slot.`
                    };
                }
                return { available: false, message: 'Requested time slot is not available' };
            }
        }
    } else {
        // If no availability record exists for the date, assume slot is not available
        return { available: false, message: `No availability found for the selected date (${date}). Please choose a different date.` };
    }

    // For one-to-one slots, prevent double booking even if a paid booking exists
    if (!requestedSlot || requestedSlot.sessionType !== 'group') {
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
    }

    return { available: true, message: 'Time slot is available' };
}

// Helper function to update availability slot status
async function updateAvailabilitySlot(therapistId, date, startTime, endTime, status) {
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
            const slot = availability.timeSlots[slotIndex];

            // Handle group slots: increment bookedParticipants and only mark booked when full.
            if (slot.sessionType === 'group') {
                if (status === 'booked') {
                    slot.bookedParticipants = (slot.bookedParticipants || 0) + 1;

                    // Ensure bookedParticipants does not exceed maxParticipants
                    if (slot.maxParticipants && slot.bookedParticipants >= slot.maxParticipants) {
                        slot.status = 'booked';
                    } else {
                        // keep it available until full
                        slot.status = 'available';
                    }
                } else if (status === 'available') {
                    // If we are freeing a slot, decrement bookedParticipants
                    slot.bookedParticipants = Math.max((slot.bookedParticipants || 1) - 1, 0);
                    if (slot.bookedParticipants < (slot.maxParticipants || 1)) {
                        slot.status = 'available';
                    }
                } else {
                    // Other statuses should still be applied
                    slot.status = status;
                }
            } else {
                // Standard 1-on-1 flow
                slot.status = status;
            }

            await availability.save();
            console.log(`Successfully updated slot ${startTime}-${endTime} to ${slot.status} for therapist ${therapistId} on ${date}`);
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
        ).populate('serviceId', 'name price priceINR priceUSD duration validity images')
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
                    // Send admin notification - notification service will handle getting admin contact from credentials/profile
                    await NotificationService.sendNotification(
                        { email: 'placeholder', phone: 'placeholder' }, // Will be replaced by notification service
                        trigger.template,
                        trigger.data
                    );
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

                    // Get the slot's session type
                    let slotSessionType = 'one-to-one';
                    let slotMaxParticipants = 1;

                    if (currentBooking.timeSlot && currentBooking.date) {
                        const availability = await Availability.findOne({
                            therapistId: currentBooking.therapistId,
                            date: currentBooking.date
                        });

                        if (availability) {
                            const slot = availability.timeSlots.find(s =>
                                s.start === currentBooking.timeSlot.start && s.end === currentBooking.timeSlot.end
                            );

                            if (slot) {
                                slotSessionType = slot.sessionType || 'one-to-one';
                                slotMaxParticipants = slot.maxParticipants || 1;
                            }
                        }
                    }

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
                        type: slotSessionType === 'group' ? 'group' : '1-on-1',
                        sessionType: slotSessionType,
                        maxParticipants: slotMaxParticipants,
                        status: "pending", // Schedule the session immediately
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
            .populate('serviceId', 'name price priceINR priceUSD duration validity images')
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
                    // Send admin notification - notification service will handle getting admin contact from credentials/profile
                    await NotificationService.sendNotification(
                        { email: 'placeholder', phone: 'placeholder' }, // Will be replaced by notification service
                        trigger.template,
                        trigger.data
                    );
                }
            }
        }

        // If this booking uses a group slot, ensure a shared group session exists and the user is added
        if (booking.status === 'confirmed') {
            try {
                const Session = require('../models/Session.model');

                const bookingDate = booking.scheduledDate || booking.date;
                const bookingTime = booking.timeSlot?.start || (booking.scheduledTime || booking.time);

                const availability = await Availability.findOne({
                    therapistId: booking.therapistId,
                    date: bookingDate
                });

                const slot = availability?.timeSlots?.find(s =>
                    s.start === (booking.timeSlot?.start || bookingTime) &&
                    s.end === (booking.timeSlot?.end || (booking.timeSlot?.end || ''))
                );

                if (slot && slot.sessionType === 'group') {
                    const sessionTime = booking.timeSlot?.start || bookingTime;
                    const startTime = new Date(`${bookingDate}T${sessionTime}:00`);
                    const duration = slot.duration || 45;
                    const endTime = new Date(startTime.getTime() + duration * 60000);

                    // Find existing group session for this slot
                    let session = await Session.findOne({
                        therapistId: booking.therapistId,
                        date: bookingDate,
                        time: sessionTime,
                        sessionType: 'group'
                    });

                    if (!session) {
                        session = await Session.create({
                            bookingId: booking._id,
                            therapistId: booking.therapistId,
                            date: bookingDate,
                            time: sessionTime,
                            startTime,
                            endTime,
                            type: 'group',
                            sessionType: 'group',
                            maxParticipants: slot.maxParticipants || 1,
                            duration,
                            status: 'pending',
                            participants: [
                                {
                                    userId: booking.userId,
                                    bookingId: booking._id,
                                    status: 'pending'
                                }
                            ]
                        });
                    } else {
                        const already = session.participants.some(
                            p => p.userId.toString() === booking.userId.toString()
                        );
                        if (!already) {
                            session.participants.push({
                                userId: booking.userId,
                                bookingId: booking._id,
                                status: 'pending'
                            });
                            await session.save();
                        }
                    }
                }
            } catch (sessionErr) {
                console.error('Error ensuring group session exists for booking', booking._id, sessionErr);
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
            .populate('serviceId', 'name price priceINR priceUSD duration validity images')
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
                    // Only send user notification if bookingOwner exists
                    if (bookingOwner) {
                        await NotificationService.sendNotification(
                            { email: bookingOwner.email, phone: bookingOwner.phone },
                            trigger.template,
                            { ...trigger.data, clientName: bookingOwner.name }
                        );
                    }
                } else if (trigger.type === 'admin') {
                    // Send admin notification - notification service will handle getting admin contact from credentials/profile
                    await NotificationService.sendNotification(
                        { email: 'placeholder', phone: 'placeholder' }, // Will be replaced by notification service
                        trigger.template,
                        trigger.data
                    );
                }
            }

            // Send real-time socket notification to client
            try {
                const io = getIO();
                const Notification = require('../models/Notification.model');
                const userNotificationRoom = `user_notifications_${booking.userId.toString()}`;

                // Determine notification based on new status
                let notificationTitle = 'Booking Update';
                let notificationType = 'booking';

                if (status === 'confirmed') {
                    notificationTitle = 'Booking Confirmed!';
                } else if (status === 'cancelled') {
                    notificationTitle = 'Booking Cancelled';
                } else if (status === 'scheduled') {
                    notificationTitle = 'Session Scheduled';
                    notificationType = 'session';
                }

                // Save to database first
                const clientNotification = new Notification({
                    title: notificationTitle,
                    message: `Your booking for ${booking.serviceName} has been ${status}`,
                    type: notificationType,
                    recipientType: 'client',
                    userId: booking.userId,
                    bookingId: booking._id,
                    sessionId: booking.sessionId || null,
                    priority: 'medium',
                    channels: { inApp: true },
                    metadata: { status }
                });

                await clientNotification.save();

                // Emit with database ID
                io.to(userNotificationRoom).emit('client-notification', {
                    id: clientNotification._id,
                    type: notificationType,
                    title: notificationTitle,
                    message: `Your booking for ${booking.serviceName} has been ${status}`,
                    bookingId: booking._id,
                    sessionId: booking.sessionId || null,
                    status: status,
                    timestamp: clientNotification.createdAt
                });

                logger.info(`Real-time notification saved and sent to client for booking status change to ${status}`);
            } catch (socketError) {
                logger.error('Error sending real-time notification to client:', socketError);
                // Don't fail the operation if socket notification fails
            }
        }

        // Handle bookedParticipants decrement for cancelled group sessions
        if (status === 'cancelled' && booking.timeSlot && booking.scheduledDate) {
            try {
                const availability = await Availability.findOne({
                    therapistId: booking.therapistId,
                    date: booking.scheduledDate
                });

                if (availability) {
                    const slotIndex = availability.timeSlots.findIndex(s =>
                        s.start === booking.timeSlot.start && s.end === booking.timeSlot.end
                    );

                    if (slotIndex !== -1) {
                        const slot = availability.timeSlots[slotIndex];

                        // Only decrement for group slots
                        if (slot.sessionType === 'group') {
                            if (typeof slot.bookedParticipants === 'number' && slot.bookedParticipants > 0) {
                                slot.bookedParticipants -= 1;

                                // Update slot status based on capacity
                                if (slot.bookedParticipants < slot.maxParticipants) {
                                    slot.status = 'available';
                                }

                                await availability.save();
                                console.log(`✅ Decremented bookedParticipants for cancelled group slot: ${slot.bookedParticipants}/${slot.maxParticipants} participants booked`);
                            }
                        }
                    }
                }
            } catch (availError) {
                console.error('❌ Error decrementing bookedParticipants for cancelled booking:', availError);
                // Continue without failing the cancellation
            }
        }

        /* =========================================================
           ✅ 1️⃣ AUTO CREATE SESSION (Subscription Covered)
        ========================================================== */
        if (status === 'confirmed' && booking.bookingType === 'subscription-covered') {
            const Session = require('../models/Session.model');

            // Check if session already exists for this booking to prevent duplicates
            const existingSession = await Session.findOne({
                bookingId: booking._id
            });

            if (existingSession) {
                console.log(`ℹ️ Session already exists for subscription booking ${booking._id}, skipping creation`);
            } else {
                const sessionDate = booking.scheduledDate || booking.date;
                // Use only the start time for session creation, not the time range
                const sessionTime = booking.timeSlot?.start || booking.scheduledTime || booking.time;

                // Get the slot's session type
                let slotSessionType = 'one-to-one';
                let slotMaxParticipants = 1;

                if (booking.timeSlot && booking.scheduledDate) {
                    const availability = await Availability.findOne({
                        therapistId: booking.therapistId,
                        date: booking.scheduledDate
                    });

                    if (availability) {
                        const slot = availability.timeSlots.find(s =>
                            s.start === booking.timeSlot.start && s.end === booking.timeSlot.end
                        );

                        if (slot) {
                            slotSessionType = slot.sessionType || 'one-to-one';
                            slotMaxParticipants = slot.maxParticipants || 1;
                        }
                    }
                }

                const startTime = new Date(`${sessionDate}T${sessionTime}`);

                // For group sessions, find or create the GroupSession to link to
                let groupSessionId = null;
                if (slotSessionType === 'group' && booking.timeSlot && booking.scheduledDate) {
                    try {
                        const GroupSession = require('../models/GroupSession.model');
                        const groupSessionStartTime = new Date(`${booking.scheduledDate}T${booking.timeSlot.start}:00`);
                        const groupSessionEndTime = new Date(`${booking.scheduledDate}T${booking.timeSlot.end}:00`);

                        // Find existing GroupSession for this time slot
                        let existingGroupSession = await GroupSession.findOne({
                            therapistId: booking.therapistId,
                            startTime: groupSessionStartTime,
                            endTime: groupSessionEndTime,
                            status: 'scheduled'
                        });

                        if (!existingGroupSession) {
                            // Create new GroupSession for this time slot
                            existingGroupSession = new GroupSession({
                                title: `Group Session - ${booking.therapistName || 'Therapist'} - ${booking.timeSlot.start}`,
                                description: 'Group physiotherapy session',
                                therapistId: booking.therapistId,
                                startTime: groupSessionStartTime,
                                endTime: groupSessionEndTime,
                                maxParticipants: slotMaxParticipants,
                                participants: [],
                                status: 'scheduled',
                                isActiveCall: false
                            });

                            await existingGroupSession.save();
                            console.log(`✅ Created new GroupSession ${existingGroupSession._id} for time slot ${booking.timeSlot.start}-${booking.timeSlot.end}`);
                        }

                        // Add user to GroupSession participants if not already added
                        const userAlreadyInGroup = existingGroupSession.participants.some(
                            p => p.userId && p.userId.toString() === booking.userId.toString()
                        );

                        if (!userAlreadyInGroup) {
                            existingGroupSession.participants.push({
                                userId: booking.userId,
                                joinedAt: new Date(),
                                status: 'accepted',
                                bookingId: booking._id
                            });

                            await existingGroupSession.save();
                            console.log(`✅ Added user ${booking.userId} to GroupSession ${existingGroupSession._id}`);
                        }

                        groupSessionId = existingGroupSession._id;
                        console.log(`✅ Found existing GroupSession ${groupSessionId} for group booking ${booking._id}`);
                    } catch (groupError) {
                        console.error('❌ Error creating/finding GroupSession:', groupError);
                        // Continue without failing the session creation
                    }
                }

                const session = new Session({
                    bookingId: booking._id,
                    therapistId: booking.therapistId,
                    userId: booking.userId,
                    date: sessionDate,
                    time: sessionTime,
                    startTime,
                    type: slotSessionType === 'group' ? 'group' : '1-on-1',
                    sessionType: slotSessionType,
                    maxParticipants: slotMaxParticipants,
                    status: 'pending',
                    duration: 45,
                    notes: `Auto-created from confirmed subscription booking #${booking._id}`,
                    ...(groupSessionId && { groupSessionId }) // Link to GroupSession if exists
                });

                const endTime = new Date(startTime);
                endTime.setMinutes(endTime.getMinutes() + session.duration);
                session.endTime = endTime;

                await session.save();

                // Update booking with groupSessionId if this is a group session
                if (groupSessionId) {
                    booking.groupSessionId = groupSessionId;
                    await booking.save();
                    console.log(`✅ Updated booking ${booking._id} with groupSessionId ${groupSessionId}`);
                }
                console.log(`✅ Session created for subscription booking ${booking._id} with sessionType: ${slotSessionType}`);

                // Update availability slot's bookedParticipants for group sessions
                if (slotSessionType === 'group' && booking.timeSlot && booking.scheduledDate) {
                    try {
                        const availability = await Availability.findOne({
                            therapistId: booking.therapistId,
                            date: booking.scheduledDate
                        });

                        if (availability) {
                            const slotIndex = availability.timeSlots.findIndex(s =>
                                s.start === booking.timeSlot.start && s.end === booking.timeSlot.end
                            );

                            if (slotIndex !== -1) {
                                const slot = availability.timeSlots[slotIndex];

                                // Increment bookedParticipants for group slots
                                if (typeof slot.bookedParticipants !== 'number') {
                                    slot.bookedParticipants = 0;
                                }
                                slot.bookedParticipants += 1;

                                // Update slot status based on capacity
                                if (slot.maxParticipants && slot.bookedParticipants >= slot.maxParticipants) {
                                    slot.status = 'booked';
                                } else {
                                    slot.status = 'available'; // Keep available until full
                                }

                                await availability.save();
                                console.log(`✅ Updated availability slot: ${slot.bookedParticipants}/${slot.maxParticipants} participants booked`);
                            }
                        }
                    } catch (availError) {
                        console.error('❌ Error updating availability slot bookedParticipants:', availError);
                        // Continue without failing the booking confirmation
                    }
                }
            }
        }

        /* =========================================================
           ✅ 2️⃣ AUTO CREATE SESSION FOR REGULAR CONFIRMED BOOKINGS
        ========================================================== */
        if (status === 'confirmed' && booking.scheduleType === 'now' && booking.bookingType !== 'subscription-covered') {
            const Session = require('../models/Session.model');

            // Check if session already exists for this booking to prevent duplicates
            const existingSession = await Session.findOne({
                bookingId: booking._id
            });

            if (existingSession) {
                console.log(`ℹ️ Session already exists for booking ${booking._id}, skipping creation`);
            } else {
                const sessionDate = booking.scheduledDate || booking.date;
                // Use only the start time for session creation, not the time range
                const sessionTime = booking.timeSlot?.start || booking.scheduledTime || booking.time;

                // Get the slot's session type
                let slotSessionType = 'one-to-one';
                let slotMaxParticipants = 1;

                if (booking.timeSlot && booking.scheduledDate) {
                    const availability = await Availability.findOne({
                        therapistId: booking.therapistId,
                        date: booking.scheduledDate
                    });

                    if (availability) {
                        const slot = availability.timeSlots.find(s =>
                            s.start === booking.timeSlot.start && s.end === booking.timeSlot.end
                        );

                        if (slot) {
                            slotSessionType = slot.sessionType || 'one-to-one';
                            slotMaxParticipants = slot.maxParticipants || 1;
                        }
                    }
                }

                const startTime = new Date(`${sessionDate}T${sessionTime}`);

                // For group sessions, find or create the GroupSession to link to
                let groupSessionId = null;
                if (slotSessionType === 'group' && booking.timeSlot && booking.scheduledDate) {
                    try {
                        const GroupSession = require('../models/GroupSession.model');
                        const groupSessionStartTime = new Date(`${booking.scheduledDate}T${booking.timeSlot.start}:00`);
                        const groupSessionEndTime = new Date(`${booking.scheduledDate}T${booking.timeSlot.end}:00`);

                        // Find existing GroupSession for this time slot
                        let existingGroupSession = await GroupSession.findOne({
                            therapistId: booking.therapistId,
                            startTime: groupSessionStartTime,
                            endTime: groupSessionEndTime,
                            status: 'scheduled'
                        });

                        if (!existingGroupSession) {
                            // Create new GroupSession for this time slot
                            existingGroupSession = new GroupSession({
                                title: `Group Session - ${booking.therapistName || 'Therapist'} - ${booking.timeSlot.start}`,
                                description: 'Group physiotherapy session',
                                therapistId: booking.therapistId,
                                startTime: groupSessionStartTime,
                                endTime: groupSessionEndTime,
                                maxParticipants: slotMaxParticipants,
                                participants: [],
                                status: 'scheduled',
                                isActiveCall: false
                            });

                            await existingGroupSession.save();
                            console.log(`✅ Created new GroupSession ${existingGroupSession._id} for time slot ${booking.timeSlot.start}-${booking.timeSlot.end}`);
                        }

                        // Add user to GroupSession participants if not already added
                        const userAlreadyInGroup = existingGroupSession.participants.some(
                            p => p.userId && p.userId.toString() === booking.userId.toString()
                        );

                        if (!userAlreadyInGroup) {
                            existingGroupSession.participants.push({
                                userId: booking.userId,
                                joinedAt: new Date(),
                                status: 'accepted',
                                bookingId: booking._id
                            });

                            await existingGroupSession.save();
                            console.log(`✅ Added user ${booking.userId} to GroupSession ${existingGroupSession._id}`);
                        }

                        groupSessionId = existingGroupSession._id;
                        console.log(`✅ Found existing GroupSession ${groupSessionId} for group booking ${booking._id}`);
                    } catch (groupError) {
                        console.error('❌ Error creating/finding GroupSession:', groupError);
                        // Continue without failing the session creation
                    }
                }

                const session = new Session({
                    bookingId: booking._id,
                    therapistId: booking.therapistId,
                    userId: booking.userId,
                    date: sessionDate,
                    time: sessionTime,
                    startTime,
                    type: slotSessionType === 'group' ? 'group' : '1-on-1',
                    sessionType: slotSessionType,
                    maxParticipants: slotMaxParticipants,
                    status: 'pending',
                    duration: 45,
                    notes: `Auto-created from confirmed booking #${booking._id}`,
                    ...(groupSessionId && { groupSessionId }) // Link to GroupSession if exists
                });

                const endTime = new Date(startTime);
                endTime.setMinutes(endTime.getMinutes() + session.duration);
                session.endTime = endTime;

                await session.save();

                // Update booking with groupSessionId if this is a group session
                if (groupSessionId) {
                    booking.groupSessionId = groupSessionId;
                    await booking.save();
                    console.log(`✅ Updated booking ${booking._id} with groupSessionId ${groupSessionId}`);
                }

                console.log(`✅ Session created for booking ${booking._id} with sessionType: ${slotSessionType}`);

                // Update availability slot's bookedParticipants for group sessions
                if (slotSessionType === 'group' && booking.timeSlot && booking.scheduledDate) {
                    try {
                        const availability = await Availability.findOne({
                            therapistId: booking.therapistId,
                            date: booking.scheduledDate
                        });

                        if (availability) {
                            const slotIndex = availability.timeSlots.findIndex(s =>
                                s.start === booking.timeSlot.start && s.end === booking.timeSlot.end
                            );

                            if (slotIndex !== -1) {
                                const slot = availability.timeSlots[slotIndex];

                                // Increment bookedParticipants for group slots
                                if (typeof slot.bookedParticipants !== 'number') {
                                    slot.bookedParticipants = 0;
                                }
                                slot.bookedParticipants += 1;

                                // Update slot status based on capacity
                                if (slot.maxParticipants && slot.bookedParticipants >= slot.maxParticipants) {
                                    slot.status = 'booked';
                                } else {
                                    slot.status = 'available'; // Keep available until full
                                }

                                await availability.save();
                                console.log(`✅ Updated availability slot: ${slot.bookedParticipants}/${slot.maxParticipants} participants booked`);
                            }
                        }
                    } catch (availError) {
                        console.error('❌ Error updating availability slot bookedParticipants:', availError);
                        // Continue without failing the booking confirmation
                    }
                }
            }
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
            .populate('serviceId', 'name price priceINR priceUSD duration validity images')
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
            await updatedBooking.populate('serviceId', 'name price priceINR priceUSD duration images');
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

        // Build query - Show ONLY PAID bookings by default
        let query = {
            paymentStatus: 'paid' // Only show bookings with paid status
        };

        // Allow additional filtering
        if (status) query.status = status;

        // Override paymentStatus if explicitly provided (to view cancelled/pending if needed)
        if (req.query.paymentStatus && req.query.paymentStatus !== 'all') {
            query.paymentStatus = req.query.paymentStatus;
        } else if (req.query.paymentStatus === 'all') {
            // If 'all' is specified, remove the paymentStatus filter
            delete query.paymentStatus;
        }

        if (dateFrom || dateTo) {
            query.date = {};
            if (dateFrom) query.date.$gte = dateFrom;
            if (dateTo) query.date.$lte = dateTo;
        }

        const skip = (page - 1) * limit;

        const bookings = await Booking.find(query)
            .populate('serviceId', 'name price priceINR priceUSD duration validity images')
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

        const total = await Booking.countDocuments(query); // Count only paid bookings

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
        }, 'Paid bookings retrieved successfully'));
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
            .populate('serviceId', 'name price priceINR priceUSD duration validity images')
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

        // For schedule later, ignore the time field completely
        // Only validate time when scheduleType is 'now' or when actual scheduling is happening
        if (scheduleType === 'later') {
            // Clear the time field as it's not relevant for "Schedule Later"
            // Admin will set the actual time when confirming the booking
        }

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
        // Only check for bookings that are confirmed or completed (not pending payment)
        const existingUser = await User.findOne({ email: clientEmail });
        if (existingUser) {
            const existingBooking = await Booking.findOne({
                userId: existingUser._id,
                date: date,
                time: time,
                bookingType: bookingType || 'regular',
                status: { $in: ['confirmed', 'scheduled', 'completed'] }, // Only block if booking is confirmed/active
                paymentStatus: 'paid' // Only consider bookings that have been paid
            });

            if (existingBooking) {
                return res.status(409).json(ApiResponse.error('You already have a booking for this date and time'));
            }
        }

        let service = null;
        let serviceName = "Free Consultation";
        let amount = 0;

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

        // NOW check free consultation eligibility (after user is found/created)
        if (bookingType === 'free-consultation') {
            // Calculate how many free consultations the user is eligible for
            let maxFreeConsultations = 1; // Default: 1 free consultation for all users

            console.log('[Free Consultation Check] User:', user._id, 'Email:', user.email);

            // Check if user has an active subscription
            const subscription = await Subscription.findOne({
                userId: user._id,
                status: 'active'
            }).populate('planId');

            console.log('[Free Consultation Check] Subscription:', subscription ? { id: subscription._id, status: subscription.status } : 'No active subscription');

            if (subscription && !subscription.isExpired) {
                let plan = null;
                if (subscription.planId) {
                    const isValidObjectId = require('mongoose').Types.ObjectId.isValid(subscription.planId);
                    if (isValidObjectId) {
                        const SubscriptionPlan = require('../models/SubscriptionPlan.model');
                        plan = await SubscriptionPlan.findById(subscription.planId);
                    } else {
                        const SubscriptionPlan = require('../models/SubscriptionPlan.model');
                        plan = await SubscriptionPlan.findOne({ planId: subscription.planId });
                    }
                }

                console.log('[Free Consultation Check] Plan:', plan ? { name: plan.name, duration: plan.duration } : 'No plan found');

                if (plan) {
                    // Check plan duration to determine free sessions
                    if (plan.duration === 'monthly') {
                        maxFreeConsultations = 2; // Monthly plan gets 2 free sessions
                        console.log('[Free Consultation Check] Monthly plan detected - 2 free sessions allowed');
                    } else if (plan.duration === 'one-time') {
                        maxFreeConsultations = 1; // One-time plan gets 1 free session
                        console.log('[Free Consultation Check] One-time plan detected - 1 free session allowed');
                    }
                }
            }

            // Check if user has already used their free consultations
            const freeConsultationsUsed = user.freeConsultationsUsed || 0;

            console.log('[Free Consultation Check]', { maxFreeConsultations, freeConsultationsUsed, isEligible: freeConsultationsUsed < maxFreeConsultations });

            if (freeConsultationsUsed >= maxFreeConsultations) {
                return res.status(400).json(ApiResponse.error(
                    `You have already used your ${maxFreeConsultations} free consultation${maxFreeConsultations > 1 ? 's' : ''}. Please book a regular session.`
                ));
            }
        } else {
            // Validate service exists for regular bookings
            service = await Service.findById(serviceId);
            if (!service || service.status !== 'active') {
                return res.status(404).json(ApiResponse.error('Service not found or not active'));
            }
            serviceName = service.name;
            // Use priceINR for India, fallback to old price field and parse it
            amount = service.priceINR || (typeof service.price === 'string' ? parseInt(service.price.replace(/[₹$,]/g, '')) : service.price) || 0;
        }

        console.log('[createGuestBooking] Before slot validation:', { scheduledDate, scheduledTime, timeSlot, bookingType });

        // Automatically assign an available therapist (admin user)
        const therapist = await User.findOne({
            role: 'admin',
            status: 'active'
        });

        if (!therapist) {
            return res.status(404).json(ApiResponse.error('No active therapists available'));
        }

        console.log('[createGuestBooking] Therapist found:', therapist._id);

        // Always validate the scheduled date and time if provided, regardless of schedule type
        if (scheduledDate && scheduledTime) {
            // Check if the requested time slot is available
            const slotAvailability = await checkTimeSlotAvailability(
                therapist._id,
                scheduledDate,
                scheduledTime,
                timeSlot,
                bookingType,
                user._id,
                serviceId
            );

            console.log('[createGuestBooking] Slot availability result:', slotAvailability);

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
            status: bookingType === 'free-consultation' ? 'pending' : ((scheduledDate && scheduledTime) ? 'pending' : (scheduleType === 'later' ? 'pending' : 'scheduled'))
        });

        await booking.save();

        // Increment free consultations used counter for free consultation bookings
        if (bookingType === 'free-consultation') {
            await User.findByIdAndUpdate(user._id, {
                $inc: { freeConsultationsUsed: 1 }
            });
        }

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

                // Send notification to admin as well
                try {
                    await notificationService.sendNotification(
                        { email: 'admin@tanishphysio.com', phone: 'admin' }, // Recipient data is handled by service for admin types
                        'new_booking',
                        {
                            ...notificationData,
                            clientName: clientName,
                            phone: clientPhone || 'N/A',
                            serviceName: `${booking.serviceName} (Free Consultation)`
                        }
                    );
                    console.log(`✅ Admin notification triggered for guest free consultation booking ${booking._id}`);
                } catch (adminNotifyError) {
                    console.error(`❌ Failed to send admin notification for guest booking ${booking._id}:`, adminNotifyError);
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

        await booking.populate('therapistId', 'name email role profilePicture');

        const isFreeConsultation = bookingType === 'free-consultation';

        // Send real-time notification to admin panel
        try {
            const { getIO } = require('../utils/socketManager');
            const io = getIO();
            const Notification = require('../models/Notification.model');

            console.log(`📢 [Guest Booking Notification] Preparing admin notification for booking ${booking._id}`);

            // Save to database first
            const adminNotification = new Notification({
                title: isFreeConsultation ? 'New Free Consultation Request' : 'New Guest Booking Request',
                message: `${clientName} (Guest) booked ${serviceName}${isFreeConsultation ? ' (Free Consultation)' : ''} for ${date} at ${time}`,
                type: 'booking',
                recipientType: 'admin',
                adminId: null, // Broadcast to all admins
                bookingId: booking._id,
                priority: isFreeConsultation ? 'high' : 'medium',
                channels: { inApp: true },
                metadata: {
                    clientName: clientName,
                    serviceName: serviceName,
                    date: date,
                    time: time,
                    status: booking.status,
                    bookingType: bookingType,
                    isGuest: true
                }
            });

            await adminNotification.save();
            console.log(`✅ [Guest Booking Notification] Saved to database: ${adminNotification._id}`);

            // Emit with database ID
            const notificationPayload = {
                id: adminNotification._id,
                type: 'booking',
                title: isFreeConsultation ? 'New Free Consultation Request' : 'New Guest Booking Request',
                message: `${clientName} (Guest) booked ${serviceName}${isFreeConsultation ? ' (Free Consultation)' : ''} for ${date} at ${time}`,
                bookingId: booking._id,
                clientName: clientName,
                serviceName: isFreeConsultation ? `${serviceName} (Free Consultation)` : serviceName,
                date: date,
                time: time,
                status: booking.status,
                priority: adminNotification.priority,
                isGuest: true,
                timestamp: adminNotification.createdAt
            };

            io.to('admin_notifications').emit('admin-notification', notificationPayload);
            console.log('✅ [Guest Booking Notification] Emitted to admin_notifications room');
        } catch (socketError) {
            console.error('❌ Error sending live notification for guest booking:', socketError);
        }

        // Send notifications to guest user
        const notificationData = {
            clientName: clientName,
            serviceName: serviceName,
            bookingId: booking._id,
            date: date,
            time: time
        };

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
        // Get the most recent active subscription
        const subscription = await Subscription.findOne({
            userId: req.user.userId,
            status: 'active'
        })
            .sort({ createdAt: -1 }) // Get the most recent one
            .populate('planId');

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

        console.log(`🔍 DEBUG: Counting sessions for subscription ${subscription._id}:`, {
            subscriptionId: subscription._id,
            planName: plan.name,
            planId: plan._id,
            userSubscriptionCount: await Subscription.countDocuments({ userId: req.user.userId, status: 'active' })
        });

        // Log all sessions for this subscription
        const allSessions = await Session.find({ subscriptionId: subscription._id }).select('status createdAt');
        console.log(`📋 All sessions for this subscription:`, allSessions.map(s => ({
            sessionId: s._id,
            status: s.status,
            createdAt: s.createdAt
        })));

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
            console.log(`SESSION_LIMIT_REACHED:`, {
                totalSessions,
                usedSessions,
                remainingSessions,
                planName: plan.name
            });
            return res.status(400).json(ApiResponse.error(
                `Session limit reached. You have used all ${totalSessions} sessions in your plan.`
            ));
        }

        // Validate service exists
        let service = null;
        let serviceName = "Session with Subscription";

        // For schedule later, ignore the time field completely
        // Only validate time when scheduleType is 'now' or when actual scheduling is happening
        if (scheduleType === 'later') {
            // Clear the time field as it's not relevant for "Schedule Later"
            // Admin will set the actual time when confirming the booking
        }

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

        // Validate user's subscription plan type matches the slot session type
        let slotSessionType = 'one-to-one';
        let slotMaxParticipants = 1;
        if (scheduledDate && scheduledTime && timeSlot) {
            const availability = await Availability.findOne({
                therapistId: therapist._id,
                date: scheduledDate
            });

            if (availability) {
                const slot = availability.timeSlots.find(s =>
                    s.start === timeSlot.start && s.end === timeSlot.end
                );

                if (slot) {
                    slotSessionType = slot.sessionType || 'one-to-one';
                    slotMaxParticipants = slot.maxParticipants || 1;

                    // Validate plan type matches slot type
                    const planSessionType = plan.session_type || 'individual';
                    const normalizedSlotType = slotSessionType === 'one-to-one' ? 'individual' : slotSessionType;

                    if (planSessionType !== normalizedSlotType) {
                        return res.status(403).json(ApiResponse.error(
                            `Your ${plan.name} plan only allows ${plan.session_type} sessions. This slot is for ${slotSessionType} sessions.`
                        ));
                    }
                }
            }
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

        // Don't create sessions automatically for subscription bookings with schedule later
        // Sessions will be created by admin after accepting the booking
        let session = null; // Declare session variable at higher scope

        if (scheduleType !== 'later') {
            console.log(`Subscription booking created. Creating session automatically.`);

            // Require Session model
            const Session = require('../models/Session.model');

            let groupSessionId = null;

            // For group sessions, find or create a GroupSession for this time slot
            if (slotSessionType === 'group' && scheduledDate && timeSlot) {
                try {
                    const GroupSession = require('../models/GroupSession.model');

                    // Calculate start and end times
                    const sessionStartTime = new Date(`${scheduledDate}T${timeSlot.start}:00`);
                    const sessionEndTime = new Date(`${scheduledDate}T${timeSlot.end}:00`);

                    // Find existing GroupSession for this time slot
                    let existingGroupSession = await GroupSession.findOne({
                        therapistId: therapist._id,
                        startTime: sessionStartTime,
                        endTime: sessionEndTime,
                        status: 'scheduled'
                    });

                    if (!existingGroupSession) {
                        // Create new GroupSession for this time slot
                        existingGroupSession = new GroupSession({
                            title: `Group Session - ${therapist.name || 'Therapist'} - ${timeSlot.start}`,
                            description: 'Group physiotherapy session',
                            therapistId: therapist._id,
                            startTime: sessionStartTime,
                            endTime: sessionEndTime,
                            maxParticipants: slotMaxParticipants,
                            participants: [],
                            status: 'scheduled',
                            isActiveCall: false
                        });

                        await existingGroupSession.save();
                        console.log(`✅ Created new GroupSession for time slot ${timeSlot.start}-${timeSlot.end}`);
                    }

                    // Add user to GroupSession participants if not already added
                    const userAlreadyInGroup = existingGroupSession.participants.some(
                        p => p.userId.toString() === req.user.userId.toString()
                    );

                    if (!userAlreadyInGroup) {
                        existingGroupSession.participants.push({
                            userId: req.user.userId,
                            joinedAt: new Date(),
                            status: 'accepted', // Auto-accept for now, admin can review later
                            bookingId: booking._id
                        });

                        await existingGroupSession.save();
                        console.log(`✅ Added user ${req.user.userId} to GroupSession ${existingGroupSession._id}`);
                    }

                    groupSessionId = existingGroupSession._id;

                    // Update booking with groupSessionId
                    booking.groupSessionId = groupSessionId;
                    await booking.save();

                } catch (groupError) {
                    console.error('❌ Error creating/finding GroupSession:', groupError);
                    // Don't fail the booking if GroupSession creation fails
                }
            }

            // Create session with correct session type based on the slot
            session = new Session({
                subscriptionId: subscription._id,
                bookingId: booking._id,
                ...(groupSessionId && { groupSessionId }), // Link to GroupSession if exists
                therapistId: therapist._id,
                userId: req.user.userId,
                date: date,
                time: time,
                startTime: new Date(`${date}T${time}:00`),
                type: slotSessionType === 'group' ? 'group' : '1-on-1',
                sessionType: slotSessionType,
                maxParticipants: slotMaxParticipants,
                status: 'pending', // Session status matches booking status
                notes: `Session created from subscription booking #${booking._id}`,
                sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            });

            // Calculate end time if service duration is available
            if (service && service.duration) {
                const durationMatch = service.duration.match(/(\d+)/);
                if (durationMatch) {
                    const duration = parseInt(durationMatch[1]);
                    const endTime = new Date(session.startTime);
                    endTime.setMinutes(endTime.getMinutes() + duration);
                    session.endTime = endTime;
                    session.duration = duration;
                }
            }

            await session.save();

            // Update availability slot to increment bookedParticipants for group sessions
            if (scheduledDate && scheduledTime && timeSlot && slotSessionType === 'group') {
                try {
                    const availability = await Availability.findOne({
                        therapistId: therapist._id,
                        date: scheduledDate
                    });

                    if (availability) {
                        const slotIndex = availability.timeSlots.findIndex(s =>
                            s.start === timeSlot.start && s.end === timeSlot.end
                        );

                        if (slotIndex !== -1) {
                            const slot = availability.timeSlots[slotIndex];
                            slot.bookedParticipants = (slot.bookedParticipants || 0) + 1;

                            // Mark as booked only if full
                            if (slot.bookedParticipants >= slot.maxParticipants) {
                                slot.status = 'booked';
                            } else {
                                slot.status = 'available'; // Keep available until full
                            }

                            await availability.save();
                            console.log(`✅ Updated group slot: ${slot.bookedParticipants}/${slot.maxParticipants} participants booked`);
                        }
                    }
                } catch (availError) {
                    console.error('❌ Error updating availability slot for group session:', availError);
                    // Continue without failing the booking
                }
            }
        } else {
            console.log(`Subscription booking created with pending status. Admin will create session after acceptance.`);
            console.log(`User has ${remainingSessions === 'unlimited' ? 'unlimited' : remainingSessions} sessions remaining.`);

            // Populate the response
            await booking.populate('serviceId', 'name price priceINR priceUSD duration validity images');
            await booking.populate('therapistId', 'name email role profilePicture');
        }

        // Send new session request notification to admin (only when session is created)
        if (scheduleType !== 'later') {
            try {
                const User = require('../models/User.model');
                const user = await User.findById(req.user.userId).select('email phone name');

                if (user) {
                    const notificationData = {
                        clientName: user.name,
                        phone: user.phone || 'N/A',
                        serviceName: service?.name || 'Subscription Session',
                        date: date,
                        time: time,
                        sessionId: session._id
                    };

                    // Send notification to admin
                    await NotificationService.sendNotification(
                        { email: 'placeholder', phone: 'placeholder' }, // Admin contact will be retrieved by notification service
                        'new_session_request',
                        notificationData
                    );

                    console.log(`✅ New session request notification sent to admin for subscription session ${session._id}`);
                }

                /* ================= SEND REAL-TIME NOTIFICATION TO ADMIN ================= */
                // Send real-time socket notification to admin about new subscription session
                const io = getIO();
                const Notification = require('../models/Notification.model');

                // Save to database first
                const adminNotification = new Notification({
                    title: 'New Subscription Session Request',
                    message: `${user?.name || 'Client'} booked a session with subscription for ${date} at ${time}`,
                    type: 'session',
                    recipientType: 'admin',
                    adminId: req.user.userId, // ✅ Set admin ID
                    sessionId: session._id,
                    bookingId: booking._id,
                    subscriptionId: subscription._id,
                    priority: 'medium',
                    channels: { inApp: true },
                    metadata: {
                        clientName: user?.name || 'Client',
                        serviceName: service?.name || 'Subscription Session',
                        date: date,
                        time: time
                    }
                });

                await adminNotification.save();

                // Emit with database ID
                io.to('admin_notifications').emit('admin-notification', {
                    id: adminNotification._id,
                    type: 'session',
                    title: 'New Subscription Session Request',
                    message: `${user?.name || 'Client'} booked a session with subscription for ${date} at ${time}`,
                    sessionId: session._id,
                    bookingId: booking._id,
                    subscriptionId: subscription._id,
                    clientName: user?.name || 'Client',
                    serviceName: service?.name || 'Subscription Session',
                    date: date,
                    time: time,
                    timestamp: adminNotification.createdAt
                });

                logger.info(`Real-time notification saved and sent to admin for subscription session`);
            } catch (notificationError) {
                console.error(`❌ Error sending admin session notification:`, notificationError);
                logger.error('Error sending real-time subscription session notification to admin:', notificationError);
                // Continue with response even if notification fails
            }
        } // End of if (scheduleType !== 'later') for notifications

        // Also update the booking to link it properly with subscription
        // This ensures both session and service counts are tracked correctly
        booking.subscriptionId = subscription._id;
        await booking.save();

        // Get updated counts for the response
        const updatedUsedSessions = usedSessions + 1;
        const updatedRemainingSessions = remainingSessions - 1;

        // Count used services for this subscription (all bookings associated with subscription)
        const updatedUsedServices = await Booking.countDocuments({
            $or: [
                { subscriptionId: subscription._id },
                { subscriptionId: subscription._id.toString() }
            ],
            status: { $ne: "cancelled" }
        });
        const updatedRemainingServices = plan.totalService ? plan.totalService - updatedUsedServices : 0;

        // Prepare response data
        const responseData = {
            booking,
            subscriptionInfo: {
                totalSessions: plan.sessions,
                usedSessions: scheduleType !== 'later' ? updatedUsedSessions : usedSessions, // Only increment if session was created
                remainingSessions: scheduleType !== 'later' ? updatedRemainingSessions : remainingSessions,
                totalServices: plan.totalService || 0,
                usedServices: updatedUsedServices,
                remainingServices: updatedRemainingServices
            }
        };

        // Include session only if it was created (not for schedule later)
        if (scheduleType !== 'later') {
            responseData.session = session;
        }

        res.status(201).json(ApiResponse.success(responseData, scheduleType !== 'later' ? 'Session booked successfully with your subscription' : 'Booking created successfully. Admin will contact you to schedule the session.'));
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
        // Get the most recent active subscription
        const subscription = await Subscription.findOne({
            userId: req.user.userId,
            status: 'active'
        })
            .sort({ createdAt: -1 }) // Get the most recent one
            .populate('planId');

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
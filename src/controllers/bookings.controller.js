const Booking = require('../models/Booking.model');
const Service = require('../models/Service.model');
const User = require('../models/User.model');
const Payment = require('../models/Payment.model');
const ApiResponse = require('../utils/apiResponse');
const BookingStatusHandler = require('../services/bookingStatusHandler');
const NotificationService = require('../services/notificationService');

// Get all bookings for authenticated user
const getAllBookings = async (req, res, next) => {
    try {
        const bookings = await Booking.find({ userId: req.user.userId })
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
            .populate('userId', 'name email phone');

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

        res.status(200).json(ApiResponse.success({
            booking: {
                ...booking.toObject(),
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
            .populate('therapistId', 'name email role profilePicture');

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

        res.status(200).json(ApiResponse.success({ booking }, 'Booking details retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Create a new booking with notification triggers
const createBooking = async (req, res, next) => {
    try {
        const { serviceId, date, time, notes, clientName, scheduleType, scheduledDate, scheduledTime, timeSlot, couponCode, discountAmount, finalAmount } = req.body;

        // Validate required fields
        if (!serviceId) {
            return res.status(400).json(ApiResponse.error('Service ID is required'));
        }

        // Validate service exists
        const service = await Service.findById(serviceId);

        if (!service || service.status !== 'active') {
            return res.status(404).json(ApiResponse.error('Service not found or not active'));
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
            const slotAvailability = await checkTimeSlotAvailability(therapist._id, scheduledDate, scheduledTime, timeSlot);

            if (!slotAvailability.available) {
                return res.status(409).json(ApiResponse.error(slotAvailability.message));
            }
        }

        // Create booking with default status values
        const booking = new Booking({
            serviceId,
            serviceName: service.name,
            therapistId: therapist._id,
            therapistName: therapist.name,
            userId: req.user.userId,
            clientName: clientName || req.user.name,
            date,
            time,
            notes,
            amount: service.price,
            originalAmount: service.price, // Store original price for discount calculations
            finalAmount: finalAmount || service.price,
            couponCode: couponCode || null,
            discountAmount: discountAmount || 0,
            paymentStatus: 'pending', // Default from existing enum
            status: (scheduledDate && scheduledTime) ? 'scheduled' : (scheduleType === 'later' ? 'pending' : 'scheduled'), // Scheduled when time is selected, otherwise based on scheduleType
            serviceValidityDays: service.validity,
            purchaseDate: new Date(),
            scheduleType: scheduleType || 'now',
            scheduledDate: scheduledDate || null,
            scheduledTime: scheduledTime || null,
            timeSlot: timeSlot || null
        });

        await booking.save();

        // If scheduling now, update availability to mark the slot as booked
        if (scheduleType === 'now' && scheduledDate && scheduledTime && timeSlot) {
            await updateAvailabilitySlot(therapist._id, scheduledDate, timeSlot.start, timeSlot.end, 'booked');
        }

        // Populate for response
        await booking.populate('serviceId', 'name price duration validity images');
        await booking.populate('therapistId', 'name email role profilePicture');

        // Send notifications
        const notificationData = {
            clientName: req.user.name,
            serviceName: service.name,
            bookingId: booking._id,
            date: date,
            time: time
        };

        // Removed booking request submitted notification
        // Previous code: Notify user (using the booking creator's contact info)
        // await NotificationService.sendNotification(
        //     { email: req.user.email, phone: req.user.phone },
        //     'booking_created',
        //     notificationData
        // );

        // Notify admin
        const admins = await User.find({ role: 'admin' }).select('email phone name');
        for (const admin of admins) {
            await NotificationService.sendNotification(
                { email: admin.email, phone: admin.phone },
                'new_booking',
                { ...notificationData, clientName: req.user.name }
            );
        }

        res.status(201).json(ApiResponse.success({ booking }, 'Booking created successfully'));
    } catch (error) {
        next(error);
    }
};

// Helper function to check time slot availability
async function checkTimeSlotAvailability(therapistId, date, time, timeSlot) {
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
            const requestedSlot = availability.timeSlots.find(slot =>
                slot.start === timeSlot.start && slot.end === timeSlot.end && slot.status !== 'booked'
            );

            if (!requestedSlot) {
                return { available: false, message: 'Requested time slot is not available' };
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

    // Check if there's already a booking for this therapist at the same time
    const Booking = require('../models/Booking.model');
    const existingBooking = await Booking.findOne({
        therapistId,
        scheduledDate: date,
        $or: [
            { 'timeSlot.start': timeSlot ? timeSlot.start : time },
            { scheduledTime: time }
        ]
    });

    if (existingBooking) {
        return { available: false, message: 'A booking already exists for this time slot' };
    }

    return { available: true, message: 'Time slot is available' };
}

// Helper function to update availability slot status
async function updateAvailabilitySlot(therapistId, date, startTime, endTime, status) {
    const Availability = require('../models/Availability.model');

    try {
        await Availability.updateOne(
            {
                therapistId,
                date
            },
            {
                $set: {
                    "timeSlots.$[elem].status": status,
                },
            },
            {
                arrayFilters: [
                    {
                        "elem.start": startTime,
                        "elem.end": endTime,
                    },
                ],
                upsert: false // Don't create if doesn't exist
            }
        );
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

        // Check if there's already a booking for this therapist at the same time
        const existingBooking = await Booking.findOne({
            therapistId,
            date,
            $or: [
                { scheduledDate: date, 'timeSlot.start': start, 'timeSlot.end': end },
                { scheduledDate: date, time: { $regex: `^${start.substring(0, 5)}.*` } } // Match if time starts with the same hour
            ]
        });

        if (existingBooking) {
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
        if (timeSlot) updateData.timeSlot = timeSlot;
        if (status) updateData.status = status;
        
        // Add coupon information if provided
        if (couponCode !== undefined) updateData.couponCode = couponCode;
        if (discountAmount !== undefined) updateData.discountAmount = discountAmount;
        if (finalAmount !== undefined) updateData.finalAmount = finalAmount;
        
        // If scheduling now, update status to scheduled
        if (scheduledDate && scheduledTime) {
            updateData.status = 'scheduled';
        }

        // Update booking
        const booking = await Booking.findOneAndUpdate(
            query,
            updateData,
            { new: true, runValidators: true }
        ).populate('serviceId', 'name price duration validity images')
          .populate('therapistId', 'name email role profilePicture');

        res.status(200).json(ApiResponse.success({ booking }, 'Booking updated with schedule successfully'));
    } catch (error) {
        next(error);
    }
};

// Update booking by ID with status-based logic
const updateBooking = async (req, res, next) => {
    try {
        const { date, time, notes, status, cancellationReason, couponCode, discountAmount, finalAmount } = req.body;
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
            if (req.user.role !== 'admin') {
                return res.status(403).json(ApiResponse.error('Only admins can change booking status'));
            }

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

        // Prepare update data
        const updateData = { date, time, notes };
        
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

            // Handle confirmation - calculate expiry date
            if (status === 'confirmed') {
                const service = await Service.findById(currentBooking.serviceId);
                if (service && service.validity) {
                    const purchaseDate = currentBooking.purchaseDate || currentBooking.createdAt;
                    const expiryDate = new Date(purchaseDate);
                    expiryDate.setDate(purchaseDate.getDate() + service.validity);
                    updateData.serviceExpiryDate = expiryDate;
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

        // Handle status change notifications
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

        // Validate status
        const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json(ApiResponse.error('Invalid status. Valid statuses: pending, confirmed, completed, cancelled'));
        }

        // Build query based on user role
        let query;
        if (req.user.role === 'admin') {
            // Admin can update status of any booking
            query = { _id: req.params.id };
        } else {
            // Regular user can only update status of their own bookings
            query = { _id: req.params.id, userId: req.user.userId };
        }

        // Prepare update data
        const updateData = { status };
        if (couponCode !== undefined) updateData.couponCode = couponCode;
        if (discountAmount !== undefined) updateData.discountAmount = discountAmount;
        if (finalAmount !== undefined) updateData.finalAmount = finalAmount;
        
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

        res.status(200).json(ApiResponse.success({ booking }, `Booking status updated to ${status} successfully`));
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

        if (status) query.status = status;
        if (paymentStatus) query.paymentStatus = paymentStatus;

        if (dateFrom || dateTo) {
            query.date = {};
            if (dateFrom) query.date.$gte = dateFrom;
            if (dateTo) query.date.$lte = dateTo;
        }

        const skip = (page - 1) * limit;

        const bookings = await Booking.find(query)
            .populate('serviceId', 'name price duration validity images')
            .populate('therapistId', 'name email role profilePicture')
            .populate('userId', 'name email phone profilePicture')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Booking.countDocuments(query);

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
        const { serviceId, date, time, notes, clientName, clientEmail, clientPhone, scheduleType, scheduledDate, scheduledTime, timeSlot, couponCode, discountAmount, finalAmount } = req.body;

        // Validate required fields for guest booking
        if (!clientName || !clientEmail || !clientPhone) {
            return res.status(400).json(ApiResponse.error("Name, email, and phone are required for guest booking"));
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(clientEmail)) {
            return res.status(400).json(ApiResponse.error("Invalid email format"));
        }

        // Validate service exists
        const service = await Service.findById(serviceId);

        if (!service || service.status !== 'active') {
            return res.status(404).json(ApiResponse.error('Service not found or not active'));
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
                status: 'active'
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
            const slotAvailability = await checkTimeSlotAvailability(therapist._id, scheduledDate, scheduledTime, timeSlot);

            if (!slotAvailability.available) {
                return res.status(409).json(ApiResponse.error(slotAvailability.message));
            }
        }

        const booking = new Booking({
            serviceId,
            serviceName: service.name, // Get from service model
            therapistId: therapist._id,
            therapistName: therapist.name, // Get from therapist model
            userId: user._id, // Assign the newly created user
            clientName: clientName,
            date,
            time,
            notes,
            amount: service.price, // Get from service model
            originalAmount: service.price, // Store original price for discount calculations
            finalAmount: finalAmount || service.price,
            couponCode: couponCode || null,
            discountAmount: discountAmount || 0,
            paymentStatus: 'pending', // Initially pending until payment is made
            purchaseDate: new Date(), // Set purchase date when booking is created
            scheduleType: scheduleType || 'now',
            scheduledDate: scheduledDate || null,
            scheduledTime: scheduledTime || null,
            timeSlot: timeSlot || null,
            status: (scheduledDate && scheduledTime) ? 'scheduled' : (scheduleType === 'later' ? 'pending' : 'scheduled') // Scheduled when time is selected, otherwise based on scheduleType
        });

        await booking.save();

        // If scheduling now, update availability to mark the slot as booked
        if (scheduleType === 'now' && scheduledDate && scheduledTime && timeSlot) {
            await updateAvailabilitySlot(therapist._id, scheduledDate, timeSlot.start, timeSlot.end, 'booked');
        }

        // Populate the response
        await booking.populate('serviceId', 'name price duration validity images');
        await booking.populate('therapistId', 'name email role profilePicture');

        // Send notifications to guest user
        const notificationData = {
            clientName: clientName,
            serviceName: service.name,
            bookingId: booking._id,
            date: date,
            time: time
        };

        // Removed booking request submitted notification
        // Previous code: Notify guest user
        // await NotificationService.sendNotification(
        //     { email: clientEmail, phone: clientPhone },
        //     'booking_created',
        //     notificationData
        // );

        // Notify admins
        const admins = await User.find({ role: 'admin' }).select('email phone name');
        for (const admin of admins) {
            await NotificationService.sendNotification(
                { email: admin.email, phone: admin.phone },
                'new_booking',
                { ...notificationData, clientName: clientName }
            );
        }

        res.status(201).json(ApiResponse.success({
            booking,
            message: 'Account created and booking made successfully. Login credentials will be sent after payment verification.'
        }, 'Account created and booking made successfully. Login credentials will be sent after payment verification.'));
    } catch (error) {
        next(error);
    }
};

// Helper function to calculate service expiry when booking is paid
async function calculateServiceExpiryForBooking(bookingId) {
    const Booking = require('../models/Booking.model');
    const Service = require('../models/Service.model');

    const booking = await Booking.findById(bookingId);
    if (booking && booking.paymentStatus === 'paid') {
        // Calculate service expiry based on the service's validity
        const service = await Service.findById(booking.serviceId);
        if (service && service.validity > 0) {
            // Calculate expiry date based on service validity
            const purchaseDate = booking.purchaseDate || booking.createdAt;
            const expiryDate = new Date(purchaseDate);
            expiryDate.setDate(purchaseDate.getDate() + service.validity);

            booking.serviceExpiryDate = expiryDate;
            booking.serviceValidityDays = service.validity;

            await booking.save();
        }
    }
}

// Helper function to send welcome email with credentials
async function sendWelcomeEmail(email, name, username, password) {
    const nodemailer = require('nodemailer');
    const { createTransport } = nodemailer;

    const transporter = createTransport({
        service: 'gmail',
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    const message = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Welcome to Tanish Physio</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>

<body style="margin:0; padding:0; background-color:#f4f6f8; font-family:Arial, Helvetica, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f8; padding:30px 0;">
    <tr>
      <td align="center">

        <!-- Main Container -->
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 6px 18px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#667eea,#764ba2); padding:30px; text-align:center; color:#ffffff;">
              <h1 style="margin:0; font-size:26px;">Tanish Physio</h1>
              <p style="margin:8px 0 0; font-size:14px; opacity:0.9;">
                Physical Therapy & Rehabilitation Center
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:35px; color:#333333;">
              <h2 style="margin-top:0; font-size:22px; color:#222;">
                Welcome to Tanish Physio
              </h2>

              <p style="font-size:15px; line-height:1.6;">
                Hello <strong>${name}</strong>,
              </p>

              <p style="font-size:15px; line-height:1.6;">
                Thank you for booking a session with us! Your account has been created successfully.
              </p>
              
              <p style="font-size:15px; line-height:1.6;">
                <strong>Login Credentials:</strong><br>
                Email: ${username}<br>
                Temporary Password: ${password}
              </p>
              
              <p style="font-size:15px; line-height:1.6; color: #ff6b6b; font-weight: bold;">
                IMPORTANT: Please change your password after first login for security.
              </p>

              <p style="font-size:15px; line-height:1.6;">
                You can now log in to your account and manage your bookings.
              </p>

              <p style="font-size:15px; margin-top:30px;">
                Regards,<br>
                <strong>Tanish Physio Team</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f1f3f6; padding:20px; text-align:center; font-size:12px; color:#777;">
              <p style="margin:0;">
                © 2024 Tanish Physio. All rights reserved.
              </p>
              <p style="margin:6px 0 0;">
                This is an automated email. Please do not reply.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
`;

    const mailOptions = {
        to: email,
        from: process.env.EMAIL_USER,
        subject: 'Welcome to Tanish Physio - Account Created',
        html: message
    };

    // Send email
    await transporter.sendMail(mailOptions);
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

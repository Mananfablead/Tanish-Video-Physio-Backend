const Session = require("../models/Session.model");
const Booking = require("../models/Booking.model");
const Service = require("../models/Service.model");
const Availability = require("../models/Availability.model");
const Subscription = require("../models/Subscription.model");
const SubscriptionPlan = require("../models/SubscriptionPlan.model");
const ApiResponse = require("../utils/apiResponse");
const { parseDurationString } = require("../utils/session.utils");
const { generateJoinLink } = require("../utils/videoCall.utils");

// Helper function to check subscription session limits
const checkSubscriptionLimits = async (subscriptionId, userId = null) => {
  try {
    // Find subscription with user verification if userId provided
    let subscription;
    if (userId) {
      subscription = await Subscription.findOne({ _id: subscriptionId, userId }).populate('planId');
    } else {
      subscription = await Subscription.findById(subscriptionId).populate('planId');
    }
    
    console.log(`Checking subscription limits for ID: ${subscriptionId}, User: ${userId}`);
    console.log(`Subscription found:`, subscription ? { id: subscription._id, planId: subscription.planId, status: subscription.status } : 'null');
    
    if (!subscription) {
      console.log(`No subscription found for ID: ${subscriptionId}`);
      return { allowed: true, message: "No subscription found" };
    }
    
    console.log(`Subscription data:`, { 
      id: subscription._id, 
      planId: subscription.planId, 
      planIdType: typeof subscription.planId,
      status: subscription.status 
    });
    
    if (!subscription.planId) {
      console.log(`No planId found in subscription: ${subscriptionId}`);
      return { allowed: true, message: "No planId found in subscription" };
    }
    
    // Try to find the plan
    console.log(`Looking up plan with planId: ${subscription.planId}`);
    const plan = await SubscriptionPlan.findOne({ planId: subscription.planId });
    console.log(`Plan lookup result:`, plan ? { id: plan._id, name: plan.name, sessions: plan.sessions } : 'null');
    
    if (!plan) {
      console.log(`Plan not found for planId: ${subscription.planId}`);
      return { allowed: true, message: "Plan not found" };
    }
    
    // 0 means unlimited sessions
    if (plan.sessions === 0) {
      console.log(`Unlimited sessions for subscription: ${subscriptionId}`);
      return { allowed: true, message: "Unlimited sessions" };
    }
    
    // Count all non-cancelled sessions
    console.log(`Counting sessions for subscription: ${subscription._id}`);
    const usedSessions = await Session.countDocuments({
      subscriptionId: subscription._id,
      status: { $ne: "cancelled" }
    });
    console.log(`Found ${usedSessions} used sessions for subscription ${subscription._id}`);
    
    const remainingSessions = plan.sessions - usedSessions;
    
    console.log(`Subscription ${subscriptionId} - Plan: ${plan.name}, Total: ${plan.sessions}, Used: ${usedSessions}, Remaining: ${remainingSessions}`);
    
    if (remainingSessions <= 0) {
      return { 
        allowed: false, 
        message: `Session limit reached. You have used all ${plan.sessions} sessions in your plan.`,
        used: usedSessions,
        total: plan.sessions
      };
    }
    
    return { 
      allowed: true, 
      used: usedSessions,
      total: plan.sessions,
      remaining: remainingSessions
    };
    
  } catch (error) {
    console.error("Error checking subscription limits:", error);
    return { allowed: false, message: "Error checking session limits" };
  }
};

// Helper function to check service session limits
const checkServiceLimits = async (bookingId) => {
  try {
    const booking = await Booking.findById(bookingId).populate('serviceId');
    
    if (!booking || !booking.serviceId) {
      console.log(`No booking or service found for ID: ${bookingId}`);
      return { allowed: true, message: "No booking or service found" };
    }
    
    // Check if the service has session limits (0 means unlimited)
    if (!booking.serviceId.sessions || booking.serviceId.sessions === 0) {
      console.log(`Unlimited sessions for service: ${bookingId}`);
      return { allowed: true, message: "Unlimited sessions" };
    }
    
    // Count all non-cancelled sessions for this specific booking
    const usedSessions = await Session.countDocuments({
      bookingId: booking._id,
      status: { $ne: "cancelled" }
    });
    
    const remainingSessions = booking.serviceId.sessions - usedSessions;
    
    console.log(`Booking ${bookingId} - Service: ${booking.serviceId.name}, Total: ${booking.serviceId.sessions}, Used: ${usedSessions}, Remaining: ${remainingSessions}`);
    
    if (remainingSessions <= 0) {
      return { 
        allowed: false, 
        message: `Session limit reached. You have used all ${booking.serviceId.sessions} sessions in your service.`,
        used: usedSessions,
        total: booking.serviceId.sessions
      };
    }
    
    return { 
      allowed: true, 
      message: `Sessions remaining: ${remainingSessions}/${booking.serviceId.sessions}`,
      used: usedSessions,
      total: booking.serviceId.sessions,
      remaining: remainingSessions
    };
    
  } catch (error) {
    console.error("Error checking service limits:", error);
    return { allowed: false, message: "Error checking session limits" };
  }
};

// Get all sessions for authenticated user
const getUserSessions = async (req, res, next) => {
  try {
    const sessions = await Session.find({ userId: req.user.userId })
      .sort({ createdAt: -1 }) // Descending order by creation time
      .populate("bookingId", "serviceName therapistName date time")
      .populate("subscriptionId", "planId planName startDate endDate status")
      .populate("therapistId", "name email role");

    // Update statuses as needed
    // console.log("Updating session statuses...", sessions);
    const updatedSessions = await updateSessionStatusesIfNeeded(sessions);

    res
      .status(200)
      .json(
        ApiResponse.success({ sessions: updatedSessions }, "Sessions retrieved successfully")
      );
  } catch (error) {
    next(error);
  }
};

// Helper function to calculate time until session
const calculateTimeUntilSession = (session) => {
  if (!session || !session.startTime) {
    return { minutes: Infinity, hours: Infinity };
  }
  
  const now = new Date();
  const sessionStartTime = new Date(session.startTime);
  const diffMs = sessionStartTime.getTime() - now.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  
  return { minutes: diffMinutes, hours: diffHours };
};

// Helper function to determine session status based on timing
const getSessionTimingStatus = (session) => {
  if (!session || !session.startTime) {
    return 'normal';
  }
  
  const { minutes, hours } = calculateTimeUntilSession(session);
  
  if (minutes <= 10 && minutes > 0) {
    return 'join_now'; // Within 10 minutes
  } else if (minutes <= 60 && minutes > 10) {
    return 'join_soon'; // Within 1 hour
  } else {
    return 'normal'; // More than 1 hour away
  }
};

// Function to update session status based on time and status
const updateSessionStatusIfNeeded = async (session) => {
  if (!session || !session.startTime || !session.status) {
    return session;
  }

  const now = new Date();
  const sessionStartTime = new Date(session.startTime);
  const sessionEndTime = session.endTime ? new Date(session.endTime) : null;

  // If session has endTime, use that for completion. Otherwise, use 1 hour after start
  let completionTime = sessionEndTime;
  if (!completionTime) {
    completionTime = new Date(sessionStartTime.getTime() + 60 * 60000); // 1 hour default
  }

  // If session is Live and current time is past completion time
  if (session.status === "live" && now > completionTime) {
    await Session.findByIdAndUpdate(session._id, {
      status: "completed",
      completedAt: now
    });
    return { ...session.toObject(), status: "completed", completedAt: now };
  }
  
  // If session is Scheduled and current time is past completion time
  if (session.status === "scheduled" && now > completionTime) {
    await Session.findByIdAndUpdate(session._id, {
      status: "missed",
      missedAt: now
    });
    return { ...session.toObject(), status: "missed", missedAt: now };
  }

  return session;
};

// Function to update session statuses in bulk
const updateSessionStatusesIfNeeded = async (sessions) => {
  return await Promise.all(sessions.map(async (session) => {
    if (!session || !session.startTime || !session.status) {
      return session;
    }

    const now = new Date();
    const sessionStartTime = new Date(session.startTime);
    const sessionEndTime = session.endTime ? new Date(session.endTime) : null;

    // If session has endTime, use that for completion. Otherwise, use 1 hour after start
    let completionTime = sessionEndTime;
    if (!completionTime) {
      completionTime = new Date(sessionStartTime.getTime() + 60 * 60000); // 1 hour default
    }

    // If session is Live and current time is past completion time
    if (session.status === "live" && now > completionTime) {
      await Session.findByIdAndUpdate(session._id, {
        status: "completed",
        completedAt: now
      });
      return { ...session.toObject(), status: "completed", completedAt: now };
    }
    
    // If session is Scheduled and current time is past completion time
    if (session.status === "scheduled" && now > completionTime) {
      await Session.findByIdAndUpdate(session._id, {
        status: "missed",
        missedAt: now
      });
      return { ...session.toObject(), status: "missed", missedAt: now };
    }

    return session;
  }));
};

// Get all sessions for admin
const getAllSessions = async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user.role !== "admin" && req.user.role !== "therapist") {
      return res
        .status(403)
        .json(ApiResponse.error("Insufficient permissions"));
    }

    const sessions = await Session.find()
      .sort({ createdAt: -1 }) // Descending order by creation time
      .populate("bookingId", "serviceName therapistName date time")
      .populate("subscriptionId", "planId planName startDate endDate status")
      .populate("therapistId", "name email role")
      .populate("userId", "name email");

    // Update statuses as needed
    // console.log("Updating session statuses...", sessions)
    const updatedSessions = await updateSessionStatusesIfNeeded(sessions);

    res
      .status(200)
      .json(
        ApiResponse.success({ sessions: updatedSessions }, "All sessions retrieved successfully")
      );
  } catch (error) {
    next(error);
  }
};

// Get upcoming sessions for authenticated user
const getUserUpcomingSessions = async (req, res, next) => {
  try {
    const now = new Date();
    const twentyFourHoursLater = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

    const sessions = await Session.find({
      userId: req.user.userId,
      startTime: { $gte: now, $lte: twentyFourHoursLater },
      status: { $in: ["scheduled", "live"] },
    })
      .sort({ startTime: 1 }) // Ascending order by start time
      .populate("bookingId", "serviceName therapistName date time")
      .populate("subscriptionId", "planId planName startDate endDate status")
      .populate("therapistId", "name email role");

    // Update statuses as needed and add timing information
    const updatedSessions = await updateSessionStatusesIfNeeded(sessions);
    
    // Add timing status to each session
    const sessionsWithTiming = updatedSessions.map(session => {
      const timingStatus = getSessionTimingStatus(session);
      return {
        ...session.toObject ? session.toObject() : session,
        timingStatus
      };
    });

    res
      .status(200)
      .json(
        ApiResponse.success(
          { sessions: sessionsWithTiming },
          "Upcoming sessions retrieved successfully"
        )
      );
  } catch (error) {
    next(error);
  }
};

// Get all upcoming sessions for admin
const getAllUpcomingSessions = async (req, res, next) => {
  try {
    if (!["admin", "therapist"].includes(req.user.role)) {
      return res
        .status(403)
        .json(ApiResponse.error("Insufficient permissions"));
    }

    const now = new Date();
    const twentyFourHoursLater = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

    const sessions = await Session.find({
      startTime: { $gte: now, $lte: twentyFourHoursLater },
      status: { $in: ["scheduled", "live"] },
    })
      .sort({ startTime: 1 }) // Ascending order by start time
      .populate("bookingId", "serviceName therapistName date time")
      .populate("subscriptionId", "planId planName startDate endDate status")
      .populate("therapistId", "name email role")
      .populate("userId", "name email");

    // Update statuses as needed and add timing information
    const updatedSessions = await updateSessionStatusesIfNeeded(sessions);
    
    // Add timing status to each session
    const sessionsWithTiming = updatedSessions.map(session => {
      const timingStatus = getSessionTimingStatus(session);
      return {
        ...session.toObject ? session.toObject() : session,
        timingStatus
      };
    });

    res
      .status(200)
      .json(
        ApiResponse.success(
          { sessions: sessionsWithTiming },
          "All upcoming sessions retrieved successfully"
        )
      );
  } catch (error) {
    next(error);
  }
};

// Get session by ID
const getSessionById = async (req, res, next) => {
  try {
    const session = await Session.findOne({
      _id: req.params.id,
      userId: req.user.userId,
    })
      .populate("bookingId", "serviceName therapistName date time")
      .populate("subscriptionId", "planId planName startDate endDate status")
      .populate("therapistId", "name email role");

    if (!session) {
      return res.status(404).json(ApiResponse.error("Session not found"));
    }

    // Update status as needed
    const updatedSession = await updateSessionStatusIfNeeded(session);

    res
      .status(200)
      .json(ApiResponse.success({ session: updatedSession }, "Session retrieved successfully"));
  } catch (error) {
    next(error);
  }
};

// Create a new session
// Create a new session
const createSession = async (req, res, next) => {
  try {
    const {
      bookingId,
      subscriptionId,
      therapistId: bodyTherapistId,
      date,
      time,
      type,
      status,
      duration: reqDuration,
    } = req.body;

    // Use a mutable variable for duration that can be auto-populated
    let duration = reqDuration;

    if (!bookingId && !subscriptionId) {
      return res
        .status(400)
        .json(
          ApiResponse.error(
            "Either bookingId or subscriptionId must be provided"
          )
        );
    }

    const userId = req.user.userId;
    let therapistId = null;

    /* ================= BOOKING FLOW ================= */
    if (bookingId) {
      const booking = await Booking.findOne({ _id: bookingId, userId }).populate('serviceId');

      if (!booking) {
        return res.status(404).json(ApiResponse.error("Booking not found"));
      }

      if (booking.paymentStatus !== "paid") {
        return res
          .status(400)
          .json(ApiResponse.error("Booking payment not completed"));
      }

      // 🔥 CHECK SERVICE EXPIRATION - NEW VALIDATION
      if (booking.isServiceExpired) {
        return res
          .status(400)
          .json(ApiResponse.error("Cannot create session: Service purchase has expired"));
      }

      therapistId = booking.therapistId;

      // 🔥 ONE SESSION PER DAY LIMIT
      const existingSession = await Session.findOne({
        userId: userId,
        date: date,
        status: { $ne: "cancelled" }
      });

      if (existingSession) {
        return res
          .status(400)
          .json(ApiResponse.error("You can only create one session per day. Please choose a different date."));
      }

      // Auto-populate duration from service if not provided
      if (!duration && booking.serviceId && booking.serviceId.duration) {
        const parsedDuration = parseDurationString(booking.serviceId.duration);
        console.log(`Auto-populating duration from service: ${booking.serviceId.duration} -> ${parsedDuration} minutes`);
        if (parsedDuration) {
          duration = parsedDuration;
        }
      }
    }

    /* ================= SUBSCRIPTION FLOW ================= */
    if (subscriptionId) {
      console.log(`Looking up subscription ${subscriptionId} for user ${userId}`);
      const subscription = await Subscription.findOne({
        _id: subscriptionId,
        userId,
      }).populate('planId');

      console.log(`Subscription lookup result:`, subscription ? { id: subscription._id, planId: subscription.planId, status: subscription.status } : 'null');
      
      if (!subscription) {
        return res
          .status(404)
          .json(ApiResponse.error("Subscription not found"));
      }

      if (subscription.status !== "active") {
        return res
          .status(400)
          .json(ApiResponse.error("Subscription is not active"));
      }

      if (subscription.endDate && subscription.endDate < new Date()) {
        return res.status(400).json(ApiResponse.error("Subscription expired"));
      }

      // 🔥 CHECK SUBSCRIPTION EXPIRATION STATUS - NEW VALIDATION
      if (subscription.isExpired) {
        return res.status(400).json(ApiResponse.error("Subscription expired"));
      }

      // 🔥 CHECK SESSION LIMITS using helper function
      const limitCheck = await checkSubscriptionLimits(subscriptionId, userId);
      if (!limitCheck.allowed) {
        return res
          .status(400)
          .json(ApiResponse.error(limitCheck.message));
      }

      // 🔥 IMPORTANT FIX
      therapistId = bodyTherapistId || null;

      if (!therapistId) {
        return res
          .status(400)
          .json(
            ApiResponse.error(
              "therapistId is required for subscription and session booking"
            )
          );
      }
    }
    
    /* ================= BOOKING FLOW WITH SERVICE LIMITS ================= */
    if (bookingId) {
      // Check service session limits if it's a service-based booking
      const serviceLimitCheck = await checkServiceLimits(bookingId);
      if (!serviceLimitCheck.allowed) {
        return res
          .status(400)
          .json(ApiResponse.error(serviceLimitCheck.message));
      }
    }

    /* ================= SLOT VALIDATION ================= */
    // Fetch the availability to get the slot information
    const availability = await Availability.findOne({ therapistId, date });
    if (availability) {
      const selectedSlot = availability.timeSlots.find(slot => slot.start === time);
      if (selectedSlot) {
        // Calculate the slot duration in minutes
        const [startHour, startMinute] = selectedSlot.start.split(':').map(Number);
        const [endHour, endMinute] = selectedSlot.end.split(':').map(Number);
        
        const slotStartTime = new Date();
        slotStartTime.setHours(startHour, startMinute, 0, 0);
        
        const slotEndTime = new Date();
        slotEndTime.setHours(endHour, endMinute, 0, 0);
        
        const slotDurationMinutes = (slotEndTime - slotStartTime) / (1000 * 60);
        
        // Check if service duration fits in the selected slot
        if (bookingId) {
          const booking = await Booking.findOne({ _id: bookingId, userId }).populate('serviceId');
          if (booking && booking.serviceId && booking.serviceId.duration) {
            const serviceDuration = parseDurationString(booking.serviceId.duration);
            if (serviceDuration > slotDurationMinutes) {
              return res
                .status(400)
                .json(
                  ApiResponse.error(
                    `Selected service requires ${serviceDuration} minutes but selected slot is only ${slotDurationMinutes} minutes. Please select a larger time slot.`
                  )
                );
            }
          }
        }
      }
    }

    /* ================= TIME ================= */
    const startTime = new Date(`${date}T${time}:00`);
    const endTime =
      duration && duration > 0
        ? new Date(startTime.getTime() + duration * 60000)
        : null;

    /* ================= CREATE SESSION ================= */
    console.log(`Creating session with subscriptionId: ${subscriptionId}, userId: ${userId}`);
    console.log(`Subscription data being passed:`, { subscriptionId, subscriptionIdType: typeof subscriptionId });
    
    const sessionData = {
      bookingId: bookingId || undefined,
      subscriptionId: subscriptionId || undefined,
      therapistId,
      userId,
      date,
      time,
      startTime,
      endTime,
      type: type || "1-on-1",
      status: status, // Let it use the default 'pending' status from the model if not provided
      duration: duration || 0,
    };
    
    console.log(`Session data being created:`, sessionData);
    
    const session = await Session.create(sessionData);
    
    console.log(`Session created successfully: ${session._id}`);
    console.log(`Created session data:`, { 
      id: session._id, 
      subscriptionId: session.subscriptionId, 
      subscriptionIdType: typeof session.subscriptionId,
      userId: session.userId 
    });

    /* ================= AVAILABILITY UPDATE ================= */
    await Availability.updateOne(
      { therapistId, date },
      {
        $set: {
          "timeSlots.$[slot].status": "booked",
        },
      },
      {
        arrayFilters: [
          {
            "slot.start": time,
            "slot.status": "available",
          },
        ],
      }
    );

    /* ================= POPULATE ================= */
    await session.populate("bookingId", "serviceName therapistName date time");
    await session.populate(
      "subscriptionId",
      "planId planName startDate endDate status"
    );
    await session.populate("therapistId", "name email role");

    return res
      .status(201)
      .json(ApiResponse.success({ session }, "Session created successfully"));
  } catch (error) {
    next(error);
  }
};

// Update session by ID
const updateSession = async (req, res, next) => {
  try {
    const { status, notes, duration, time } = req.body;

    // Check if session belongs to user
    const session = await Session.findOne({
      _id: req.params.id,
      userId: req.user.userId,
    });
    if (!session) {
      return res.status(404).json(ApiResponse.error("Session not found"));
    }

    // Update status as needed first
    const sessionWithUpdatedStatus = await updateSessionStatusIfNeeded(session);
    
    // Prevent updating if session is completed, missed, or live
    if (sessionWithUpdatedStatus.status === "completed" || sessionWithUpdatedStatus.status === "missed" || sessionWithUpdatedStatus.status === "live") {
      return res
        .status(400)
        .json(ApiResponse.error("Cannot update completed, missed, or live session"));
    }

    // Prepare update object
    const updateFields = { status, notes };

    // Include duration if provided
    if (duration !== undefined) {
      updateFields.duration = duration;
    }

    // If time is provided, update time fields
    if (time !== undefined) {
      updateFields.time = time;
      const startTime = new Date(`${sessionWithUpdatedStatus.date}T${time}:00`);
      updateFields.startTime = startTime;
    }

    // Update session
    const updatedSession = await Session.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      updateFields,
      { new: true, runValidators: true }
    )
      .populate("bookingId", "serviceName therapistName date time")
      .populate("subscriptionId", "planId planName startDate endDate status")
      .populate("therapistId", "name email role");

    // Update availability status if time changed
    if (time !== undefined && session.therapistId) {
      try {
        // Mark old time slot as available
        await Availability.updateOne(
          { therapistId: session.therapistId, date: session.date },
          {
            $set: {
              "timeSlots.$[elem].status": "available",
            },
          },
          {
            arrayFilters: [
              {
                "elem.start": session.time,
                "elem.status": "booked",
              },
            ],
          }
        );

        // Mark new time slot as booked
        await Availability.updateOne(
          { therapistId: session.therapistId, date: date },
          {
            $set: {
              "timeSlots.$[elem].status": "booked",
            },
          },
          {
            arrayFilters: [
              {
                "elem.start": time,
                "elem.status": "available",
              },
            ],
          }
        );
      } catch (availabilityError) {
        console.error(
          "Error updating availability status during session update:",
          availabilityError
        );
        // Continue with response even if availability update fails
      }
    }

    res
      .status(200)
      .json(
        ApiResponse.success(
          { session: updatedSession },
          "Session updated successfully"
        )
      );
  } catch (error) {
    next(error);
  }
};

// Delete session by ID
const deleteSession = async (req, res, next) => {
  try {
    const session = await Session.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.userId,
    })
      .populate("bookingId", "serviceName therapistName date time")
      .populate("subscriptionId", "planId planName startDate endDate status")
      .populate("therapistId", "name email role");

    if (!session) {
      return res.status(404).json(ApiResponse.error("Session not found"));
    }

    // Update availability status back to 'available' if therapistId exists
    if (session.therapistId) {
      try {
        await Availability.updateOne(
          { therapistId: session.therapistId, date: session.date },
          {
            $set: {
              "timeSlots.$[elem].status": "available",
            },
          },
          {
            arrayFilters: [
              {
                "elem.start": session.time,
                "elem.status": "booked",
              },
            ],
          }
        );
      } catch (availabilityError) {
        console.error(
          "Error updating availability status after session deletion:",
          availabilityError
        );
        // Continue with response even if availability update fails
      }
    }

    res
      .status(200)
      .json(ApiResponse.success({ session }, "Session deleted successfully"));
  } catch (error) {
    next(error);
  }
};

// Reschedule session for user
const rescheduleUserSession = async (req, res, next) => {
  try {
    const { date, time, duration } = req.body;

    // Find the session and verify ownership
    const session = await Session.findOne({
      _id: req.params.id,
      userId: req.user.userId,
    });
    if (!session) {
      return res.status(404).json(ApiResponse.error("Session not found"));
    }

    // Update status as needed first
    const sessionWithUpdatedStatus = await updateSessionStatusIfNeeded(session);
    
    // Check if session can be rescheduled (should not be live, completed, or missed)
    if (sessionWithUpdatedStatus.status === "live" || sessionWithUpdatedStatus.status === "completed" || sessionWithUpdatedStatus.status === "missed") {
      return res
        .status(400)
        .json(ApiResponse.error("Cannot reschedule live, completed, or missed session"));
    }

    // Auto-generate new startTime from date and time
    const startTime = new Date(`${date}T${time}:00`);

    /* ================= RESCHEDULE SLOT VALIDATION ================= */
    // Fetch the availability to get the slot information
    const availability = await Availability.findOne({ therapistId: session.therapistId, date: date });
    if (availability) {
      const selectedSlot = availability.timeSlots.find(slot => slot.start === time);
      if (selectedSlot) {
        // Calculate the slot duration in minutes
        const [startHour, startMinute] = selectedSlot.start.split(':').map(Number);
        const [endHour, endMinute] = selectedSlot.end.split(':').map(Number);
        
        const slotStartTime = new Date();
        slotStartTime.setHours(startHour, startMinute, 0, 0);
        
        const slotEndTime = new Date();
        slotEndTime.setHours(endHour, endMinute, 0, 0);
        
        const slotDurationMinutes = (slotEndTime - slotStartTime) / (1000 * 60);
        
        // Check if service duration fits in the selected slot
        if (sessionWithUpdatedStatus.bookingId) {
          const booking = await Booking.findById(sessionWithUpdatedStatus.bookingId).populate('serviceId');
          if (booking && booking.serviceId && booking.serviceId.duration) {
            const serviceDuration = parseDurationString(booking.serviceId.duration);
            if (serviceDuration > slotDurationMinutes) {
              return res
                .status(400)
                .json(
                  ApiResponse.error(
                    `Selected service requires ${serviceDuration} minutes but selected slot is only ${slotDurationMinutes} minutes. Please select a larger time slot.`
                  )
                );
            }
          }
        }
      }
    }

    // Calculate endTime based on duration if provided
    let endTime = null;
    if (duration && typeof duration === "number" && duration > 0) {
      endTime = new Date(startTime.getTime() + duration * 60000); // duration in minutes converted to milliseconds
    }

    // Prepare update object
    const updateFields = {
      date,
      time,
      startTime,
      status: "scheduled",
    };

    // Include duration and endTime if provided
    if (duration !== undefined) {
      updateFields.duration = duration;
      updateFields.endTime = endTime;
    }

    // Update session with new date, time, and startTime
    const updatedSession = await Session.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true, runValidators: true }
    )
      .populate("bookingId", "serviceName therapistName date time")
      .populate("subscriptionId", "planId planName startDate endDate status")
      .populate("therapistId", "name email role");

    // Update availability statuses: mark old time slot as available and new time slot as booked
    if (updatedSession.therapistId) {
      try {
        // Mark OLD time slot as available (using the original session data)
        await Availability.updateOne(
          {
            therapistId: updatedSession.therapistId,
            date: session.date, // Use original session date, not updated date
          },
          {
            $set: {
              "timeSlots.$[elem].status": "available",
            },
          },
          {
            arrayFilters: [
              {
                "elem.start": session.time, // Use original session time, not updated time
                "elem.status": "booked",
              },
            ],
          }
        );

        // Mark NEW time slot as booked
        await Availability.updateOne(
          { therapistId: updatedSession.therapistId, date },
          {
            $set: {
              "timeSlots.$[elem].status": "booked",
            },
          },
          {
            arrayFilters: [
              {
                "elem.start": time,
                "elem.status": "available",
              },
            ],
          }
        );
      } catch (availabilityError) {
        console.error(
          "Error updating availability status during reschedule:",
          availabilityError
        );
        // Continue with response even if availability update fails
      }
    }

    res
      .status(200)
      .json(
        ApiResponse.success(
          { session: updatedSession },
          "Session rescheduled successfully"
        )
      );
  } catch (error) {
    next(error);
  }
};

// Admin function to get session by ID
const getAdminSessionById = async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user.role !== "admin" && req.user.role !== "therapist") {
      return res
        .status(403)
        .json(ApiResponse.error("Insufficient permissions"));
    }

    const session = await Session.findById(req.params.id)
      .populate("bookingId", "serviceName therapistName date time")
      .populate("subscriptionId", "planId planName startDate endDate status")
      .populate("therapistId", "name email role")
      .populate("userId", "name email");

    if (!session) {
      return res.status(404).json(ApiResponse.error("Session not found"));
    }

    // Update status as needed
    const updatedSession = await updateSessionStatusIfNeeded(session);

    res
      .status(200)
      .json(ApiResponse.success({ session: updatedSession }, "Session retrieved successfully"));
  } catch (error) {
    next(error);
  }
};

// Admin function to create a new session
const createAdminSession = async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user.role !== "admin" && req.user.role !== "therapist") {
      return res
        .status(403)
        .json(ApiResponse.error("Insufficient permissions"));
    }

    const {
      bookingId,
      subscriptionId,
      userId,
      therapistId,
      date,
      time,
      type,
      status,
      duration: reqDuration,
      notes,
    } = req.body;

    // Use a mutable variable for duration that can be auto-populated
    let duration = reqDuration;

    // Validate that either bookingId or subscriptionId is provided
    if (!bookingId && !subscriptionId) {
      return res
        .status(400)
        .json(
          ApiResponse.error(
            "Either bookingId or subscriptionId must be provided"
          )
        );
    }

    // Validate that userId and therapistId are provided for admin-created sessions
    if (!userId || !therapistId) {
      return res
        .status(400)
        .json(
          ApiResponse.error(
            "User ID and Therapist ID are required for admin-created sessions"
          )
        );
    }

    let booking = null;
    let subscription = null;

    // Handle booking-based session
    if (bookingId) {
      const Booking = require("../models/Booking.model");
      booking = await Booking.findById(bookingId).populate('serviceId');
      if (!booking) {
        return res.status(404).json(ApiResponse.error("Booking not found"));
      }

      // Check if the booking has been paid
      if (booking.paymentStatus !== "paid") {
        return res
          .status(400)
          .json(
            ApiResponse.error(
              "Cannot create session: Booking payment status is not paid"
            )
          );
      }

      // 🔥 CHECK SERVICE EXPIRATION - NEW VALIDATION
      if (booking.isServiceExpired) {
        return res
          .status(400)
          .json(
            ApiResponse.error(
              "Cannot create session: Service purchase has expired"
            )
          );
      }

      // 🔥 ONE SESSION PER DAY LIMIT (for admin too)
      const existingSession = await Session.findOne({
        userId: userId,
        date: date,
        status: { $ne: "cancelled" }
      });

      if (existingSession) {
        return res
          .status(400)
          .json(ApiResponse.error(`User can only have one session per day. A session already exists for ${date}.`));
      }

      // Check service session limits if it's a service-based booking
      const serviceLimitCheck = await checkServiceLimits(bookingId);
      if (!serviceLimitCheck.allowed) {
        return res
          .status(400)
          .json(ApiResponse.error(`Cannot create session: ${serviceLimitCheck.message}`));
      }

      // Auto-populate duration from service if not provided
      if (!duration && booking.serviceId && booking.serviceId.duration) {
        const parsedDuration = parseDurationString(booking.serviceId.duration);
        console.log(`Auto-populating duration from service: ${booking.serviceId.duration} -> ${parsedDuration} minutes`);
        if (parsedDuration) {
          duration = parsedDuration;
        }
      }
    }

    // Handle subscription-based session
    if (subscriptionId) {
      subscription = await Subscription.findById(subscriptionId).populate('planId');
      if (!subscription) {
        return res
          .status(404)
          .json(ApiResponse.error("Subscription not found"));
      }

      // Check if subscription is active
      if (subscription.status !== "active") {
        return res
          .status(400)
          .json(
            ApiResponse.error(
              "Cannot create session: Subscription is not active"
            )
          );
      }

      // Check subscription validity dates
      const now = new Date();
      if (subscription.endDate && subscription.endDate < now) {
        return res
          .status(400)
          .json(
            ApiResponse.error("Cannot create session: Subscription has expired")
          );
      }

      // 🔥 CHECK SUBSCRIPTION EXPIRATION STATUS - NEW VALIDATION
      if (subscription.isExpired) {
        return res
          .status(400)
          .json(
            ApiResponse.error("Cannot create session: Subscription has expired")
          );
      }

      // 🔥 CHECK SESSION LIMITS using helper function
      const limitCheck = await checkSubscriptionLimits(subscriptionId, userId);
      if (!limitCheck.allowed) {
        return res
          .status(400)
          .json(ApiResponse.error(`Cannot create session: ${limitCheck.message}`));
      }
    }

    // Auto-generate startTime from date and time
    const startTime = new Date(`${date}T${time}:00`);

    /* ================= ADMIN SLOT VALIDATION ================= */
    // Fetch the availability to get the slot information
    const availability = await Availability.findOne({ therapistId: therapistId, date: date });
    if (availability) {
      const selectedSlot = availability.timeSlots.find(slot => slot.start === time);
      if (selectedSlot) {
        // Calculate the slot duration in minutes
        const [startHour, startMinute] = selectedSlot.start.split(':').map(Number);
        const [endHour, endMinute] = selectedSlot.end.split(':').map(Number);
        
        const slotStartTime = new Date();
        slotStartTime.setHours(startHour, startMinute, 0, 0);
        
        const slotEndTime = new Date();
        slotEndTime.setHours(endHour, endMinute, 0, 0);
        
        const slotDurationMinutes = (slotEndTime - slotStartTime) / (1000 * 60);
        
        // Check if service duration fits in the selected slot
        if (bookingId) {
          const Booking = require("../models/Booking.model");
          const booking = await Booking.findById(bookingId).populate('serviceId');
          if (booking && booking.serviceId && booking.serviceId.duration) {
            const serviceDuration = parseDurationString(booking.serviceId.duration);
            if (serviceDuration > slotDurationMinutes) {
              return res
                .status(400)
                .json(
                  ApiResponse.error(
                    `Selected service requires ${serviceDuration} minutes but selected slot is only ${slotDurationMinutes} minutes. Please select a larger time slot.`
                  )
                );
            }
          }
        }
      }
    }

    // Calculate endTime based on duration if provided
    let endTime = null;
    if (duration && typeof duration === "number" && duration > 0) {
      endTime = new Date(startTime.getTime() + duration * 60000); // duration in minutes converted to milliseconds
    }

    // Generate a unique sessionId
    const sessionId = `session_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    const sessionData = {
      therapistId,
      userId,
      sessionId, // Add the unique sessionId
      date,
      time,
      startTime, // Add the required startTime field
      endTime, // Add the calculated endTime based on duration
      type: type || "1-on-1",
      status: status || "scheduled",
      duration, // Add the duration field
      notes,
    };

    // Add bookingId or subscriptionId depending on the session type
    if (bookingId) {
      sessionData.bookingId = bookingId;
      // Update booking status to confirmed when session is created
      await Booking.findByIdAndUpdate(bookingId, { status: 'confirmed' });
    }

    if (subscriptionId) {
      sessionData.subscriptionId = subscriptionId;
    }

    const session = new Session(sessionData);

    await session.save();

    // Update availability status to 'booked' if therapistId exists
    if (therapistId) {
      try {
        await Availability.updateOne(
          { therapistId: sessionData.therapistId, date: sessionData.date },
          {
            $set: {
              "timeSlots.$[elem].status": "booked",
            },
          },
          {
            arrayFilters: [
              {
                "elem.start": sessionData.time,
                "elem.status": "available",
              },
            ],
          }
        );
      } catch (availabilityError) {
        console.error("Error updating availability status:", availabilityError);
        // Continue with response even if availability update fails
      }
    }

    // Populate the response based on session type
    if (bookingId) {
      await session.populate(
        "bookingId",
        "serviceName therapistName date time"
      );
    }

    if (subscriptionId) {
      await session.populate(
        "subscriptionId",
        "planId planName startDate endDate status"
      );
    }

    await session.populate("therapistId", "name email role");
    await session.populate("userId", "name email");

    res
      .status(201)
      .json(ApiResponse.success({ session }, "Session created successfully"));
  } catch (error) {
    next(error);
  }
};

// Admin function to update session by ID
const updateAdminSession = async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user.role !== "admin" && req.user.role !== "therapist") {
      return res
        .status(403)
        .json(ApiResponse.error("Insufficient permissions"));
    }

    const { status, notes, duration, date, time } = req.body;

    // Get the current session to check old values
    const currentSession = await Session.findById(req.params.id);
    if (!currentSession) {
      return res.status(404).json(ApiResponse.error("Session not found"));
    }

    // Update status as needed first
    const sessionWithUpdatedStatus = await updateSessionStatusIfNeeded(currentSession);
    
    // Prevent updating certain statuses if session has become completed or missed
    if (sessionWithUpdatedStatus.status === "completed" || sessionWithUpdatedStatus.status === "missed") {
      if (status && status !== "completed" && status !== "missed") {
        return res
          .status(400)
          .json(ApiResponse.error("Cannot update status of completed or missed session"));
      }
    }

    // Prepare update object
    const updateFields = {};
    if (status !== undefined) updateFields.status = status;
    if (notes !== undefined) updateFields.notes = notes;
    if (duration !== undefined) updateFields.duration = duration;
    if (date !== undefined) updateFields.date = date;
    if (time !== undefined) updateFields.time = time;

    // If date and time are provided, update startTime as well
    if (date && time) {
      updateFields.startTime = new Date(`${date}T${time}:00`);
    } else if (time && !date) {
      // If only time is provided, use the existing date
      updateFields.startTime = new Date(`${sessionWithUpdatedStatus.date}T${time}:00`);
    } else if (date && !time) {
      // If only date is provided, use the existing time
      updateFields.startTime = new Date(`${date}T${sessionWithUpdatedStatus.time}:00`);
    }

    // Update session
    const updatedSession = await Session.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true, runValidators: true }
    )
      .populate("bookingId", "serviceName therapistName date time")
      .populate("subscriptionId", "planId planName startDate endDate status")
      .populate("therapistId", "name email role")
      .populate("userId", "name email");

    if (!updatedSession) {
      return res.status(404).json(ApiResponse.error("Session not found"));
    }

    // Update availability status if time changed
    if ((date || time) && currentSession.therapistId) {
      try {
        // Determine the old and new date/time values
        const oldDate = currentSession.date;
        const newDate = date || currentSession.date;
        const oldTime = currentSession.time;
        const newTime = time || currentSession.time;

        // Mark old time slot as available
        await Availability.updateOne(
          { therapistId: currentSession.therapistId, date: oldDate },
          {
            $set: {
              "timeSlots.$[elem].status": "available",
            },
          },
          {
            arrayFilters: [
              {
                "elem.start": oldTime,
                "elem.status": "booked",
              },
            ],
          }
        );

        // Mark new time slot as booked
        await Availability.updateOne(
          { therapistId: currentSession.therapistId, date: newDate },
          {
            $set: {
              "timeSlots.$[elem].status": "booked",
            },
          },
          {
            arrayFilters: [
              {
                "elem.start": newTime,
                "elem.status": "available",
              },
            ],
          }
        );
      } catch (availabilityError) {
        console.error(
          "Error updating availability status during admin session update:",
          availabilityError
        );
        // Continue with response even if availability update fails
      }
    }

    res
      .status(200)
      .json(
        ApiResponse.success(
          { session: updatedSession },
          "Session updated successfully"
        )
      );
  } catch (error) {
    next(error);
  }
};

// Admin function to delete session by ID
const deleteAdminSession = async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user.role !== "admin" && req.user.role !== "therapist") {
      return res
        .status(403)
        .json(ApiResponse.error("Insufficient permissions"));
    }

    const session = await Session.findByIdAndDelete(req.params.id)
      .populate("bookingId", "serviceName therapistName date time")
      .populate("subscriptionId", "planId planName startDate endDate status")
      .populate("therapistId", "name email role")
      .populate("userId", "name email");

    if (!session) {
      return res.status(404).json(ApiResponse.error("Session not found"));
    }

    // Update availability status back to 'available' if therapistId exists
    if (session.therapistId) {
      try {
        await Availability.updateOne(
          { therapistId: session.therapistId, date: session.date },
          {
            $set: {
              "timeSlots.$[elem].status": "available",
            },
          },
          {
            arrayFilters: [
              {
                "elem.start": session.time,
                "elem.status": "booked",
              },
            ],
          }
        );
      } catch (availabilityError) {
        console.error(
          "Error updating availability status after session deletion:",
          availabilityError
        );
        // Continue with response even if availability update fails
      }
    }

    res
      .status(200)
      .json(ApiResponse.success({ session }, "Session deleted successfully"));
  } catch (error) {
    next(error);
  }
};

// Admin function to reschedule session
const rescheduleAdminSession = async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user.role !== "admin" && req.user.role !== "therapist") {
      return res
        .status(403)
        .json(ApiResponse.error("Insufficient permissions"));
    }

    const { date, time, duration } = req.body;

    // Find the session
    const session = await Session.findById(req.params.id);
    if (!session) {
      return res.status(404).json(ApiResponse.error("Session not found"));
    }

    // Update status as needed first
    const sessionWithUpdatedStatus = await updateSessionStatusIfNeeded(session);
    
    // Check if session can be rescheduled (should not be live, completed, or missed)
    if (sessionWithUpdatedStatus.status === "live" || sessionWithUpdatedStatus.status === "completed" || sessionWithUpdatedStatus.status === "missed") {
      return res
        .status(400)
        .json(ApiResponse.error("Cannot reschedule live, completed, or missed session"));
    }

    // Ensure bookingId exists to check service duration
    if (!sessionWithUpdatedStatus.bookingId) {
      return res
        .status(400)
        .json(ApiResponse.error("Cannot reschedule subscription-based session using this endpoint"));
    }

    // Auto-generate new startTime from date and time
    const startTime = new Date(`${date}T${time}:00`);

    /* ================= RESCHEDULE SLOT VALIDATION ================= */
    // Fetch the availability to get the slot information
    const availability = await Availability.findOne({ therapistId: session.therapistId, date: date });
    if (availability) {
      const selectedSlot = availability.timeSlots.find(slot => slot.start === time);
      if (selectedSlot) {
        // Calculate the slot duration in minutes
        const [startHour, startMinute] = selectedSlot.start.split(':').map(Number);
        const [endHour, endMinute] = selectedSlot.end.split(':').map(Number);
        
        const slotStartTime = new Date();
        slotStartTime.setHours(startHour, startMinute, 0, 0);
        
        const slotEndTime = new Date();
        slotEndTime.setHours(endHour, endMinute, 0, 0);
        
        const slotDurationMinutes = (slotEndTime - slotStartTime) / (1000 * 60);
        
        // Check if service duration fits in the selected slot
        if (session.bookingId) {
          const booking = await Booking.findById(session.bookingId).populate('serviceId');
          if (booking && booking.serviceId && booking.serviceId.duration) {
            const serviceDuration = parseDurationString(booking.serviceId.duration);
            if (serviceDuration > slotDurationMinutes) {
              return res
                .status(400)
                .json(
                  ApiResponse.error(
                    `Selected service requires ${serviceDuration} minutes but selected slot is only ${slotDurationMinutes} minutes. Please select a larger time slot.`
                  )
                );
            }
          }
        }
      }
    }

    // Calculate endTime based on duration if provided
    let endTime = null;
    if (duration && typeof duration === "number" && duration > 0) {
      endTime = new Date(startTime.getTime() + duration * 60000); // duration in minutes converted to milliseconds
    }

    // Prepare update object
    const updateFields = {
      date,
      time,
      startTime,
      status: "scheduled", // Reset status to scheduled
    };

    // Include duration and endTime if provided
    if (duration !== undefined) {
      updateFields.duration = duration;
      updateFields.endTime = endTime;
    }

    // Update session with new date, time, and startTime
    const updatedSession = await Session.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true, runValidators: true }
    )
      .populate("bookingId", "serviceName therapistName date time")
      .populate("subscriptionId", "planId planName startDate endDate status")
      .populate("therapistId", "name email role")
      .populate("userId", "name email");

    // Update availability statuses: mark old time slot as available and new time slot as booked
    if (updatedSession.therapistId) {
      try {
        // Mark OLD time slot as available (using the original session data)
        await Availability.updateOne(
          {
            therapistId: updatedSession.therapistId,
            date: session.date, // Use original session date, not updated date
          },
          {
            $set: {
              "timeSlots.$[elem].status": "available",
            },
          },
          {
            arrayFilters: [
              {
                "elem.start": session.time, // Use original session time, not updated time
                "elem.status": "booked",
              },
            ],
          }
        );

        // Mark NEW time slot as booked
        await Availability.updateOne(
          { therapistId: updatedSession.therapistId, date },
          {
            $set: {
              "timeSlots.$[elem].status": "booked",
            },
          },
          {
            arrayFilters: [
              {
                "elem.start": time,
                "elem.status": "available",
              },
            ],
          }
        );
      } catch (availabilityError) {
        console.error(
          "Error updating availability status during reschedule:",
          availabilityError
        );
        // Continue with response even if availability update fails
      }
    }

    res
      .status(200)
      .json(
        ApiResponse.success(
          { session: updatedSession },
          "Session rescheduled successfully"
        )
      );
  } catch (error) {
    next(error);
  }
};
// Admin function to accept session
const acceptSession = async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user.role !== "admin" && req.user.role !== "therapist") {
      return res
        .status(403)
        .json(ApiResponse.error("Insufficient permissions"));
    }

    const session = await Session.findById(req.params.id);
    if (!session) {
      return res.status(404).json(ApiResponse.error("Session not found"));
    }

    // Generate video call join links for both user and therapist
    // Check if userId exists before calling toString()
    if (!session.userId) {
      return res.status(400).json(ApiResponse.error("Session does not have a valid user ID"));
    }
    
    // Handle case where therapistId might be null
    // Try to populate it from related booking or subscription if missing
    let therapistId = session.therapistId;
    
    if (!therapistId && session.bookingId) {
      // If therapistId is null but booking exists, get therapistId from booking
      const booking = await Booking.findById(session.bookingId);
      if (booking && booking.therapistId) {
        therapistId = booking.therapistId;
      }
    } else if (!therapistId && session.subscriptionId) {
      // If therapistId is null but subscription exists, we might need to get it differently
      // For subscription-based sessions, therapist is typically assigned later
      // We'll need to get it from the request body or find another way
      console.log("Session has subscription but no therapistId. This might need manual assignment.");
    }
    
    if (!therapistId) {
      return res.status(400).json(ApiResponse.error("Session does not have a valid therapist ID and cannot determine it from related records"));
    }
    
    const userJoinLink = generateJoinLink(session.sessionId, session.userId.toString(), 'user');
    const therapistJoinLink = generateJoinLink(session.sessionId, therapistId.toString(), 'therapist');
    
    // Update session with join links and status
    // Only update status if it's not already 'scheduled'
    const updateData = {
        joinLink: userJoinLink, // Store user join link in the main field
        therapistJoinLink: therapistJoinLink // Store therapist link separately
    };
    
    // Always set status to 'scheduled' when accepting
    updateData.status = 'scheduled';
    
    const updatedSession = await Session.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate("bookingId", "serviceName therapistName date time")
      .populate("subscriptionId", "planId planName startDate endDate status")
      .populate("therapistId", "name email role")
      .populate("userId", "name email");

    // Update associated booking status to 'confirmed' if it exists
    if (updatedSession.bookingId) {
      await Booking.findByIdAndUpdate(updatedSession.bookingId, { 
        status: 'confirmed',
        updatedAt: new Date()
      });
    }

    // Update availability status to 'booked' if therapistId exists
    if (updatedSession.therapistId) {
      try {
        await Availability.updateOne(
          {
            therapistId: updatedSession.therapistId,
            date: updatedSession.date,
          },
          {
            $set: {
              "timeSlots.$[elem].status": "booked",
            },
          },
          {
            arrayFilters: [
              {
                "elem.start": updatedSession.time,
                "elem.status": "available",
              },
            ],
          }
        );
      } catch (availabilityError) {
        console.error(
          "Error updating availability status during session accept:",
          availabilityError
        );
        // Continue with response even if availability update fails
      }
    }

    res
      .status(200)
      .json(
        ApiResponse.success(
          { session: updatedSession },
          "Session accepted successfully"
        )
      );
  } catch (error) {
    next(error);
  }
};

// Admin function to reject session
const rejectSession = async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user.role !== "admin" && req.user.role !== "therapist") {
      return res
        .status(403)
        .json(ApiResponse.error("Insufficient permissions"));
    }

    const session = await Session.findById(req.params.id);
    if (!session) {
      return res.status(404).json(ApiResponse.error("Session not found"));
    }

    // Update session status to cancelled
    const updatedSession = await Session.findByIdAndUpdate(
      req.params.id,
      { status: "cancelled" },
      { new: true, runValidators: true }
    )
      .populate("bookingId", "serviceName therapistName date time")
      .populate("subscriptionId", "planId planName startDate endDate status")
      .populate("therapistId", "name email role")
      .populate("userId", "name email");

    // Update availability status back to 'available' if therapistId exists
    if (updatedSession.therapistId) {
      try {
        await Availability.updateOne(
          {
            therapistId: updatedSession.therapistId,
            date: updatedSession.date,
          },
          {
            $set: {
              "timeSlots.$[elem].status": "available",
            },
          },
          {
            arrayFilters: [
              {
                "elem.start": updatedSession.time,
                "elem.status": "booked",
              },
            ],
          }
        );
      } catch (availabilityError) {
        console.error(
          "Error updating availability status during session reject:",
          availabilityError
        );
        // Continue with response even if availability update fails
      }
    }

    res
      .status(200)
      .json(
        ApiResponse.success(
          { session: updatedSession },
          "Session rejected successfully"
        )
      );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  // User functions
  getUserSessions,
  getUserUpcomingSessions,
  getSessionById,
  createSession,
  updateSession,
  deleteSession,
  rescheduleUserSession,

  // Admin functions
  getAllSessions,
  getAllUpcomingSessions,
  getAdminSessionById,
  createAdminSession,
  updateAdminSession,
  deleteAdminSession,
  rescheduleAdminSession,

  // Session approval functions
  acceptSession,
  rejectSession,
  
  // Helper functions
  checkSubscriptionLimits
};

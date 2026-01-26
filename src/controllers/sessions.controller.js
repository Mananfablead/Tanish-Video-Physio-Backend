const Session = require("../models/Session.model");
const Booking = require("../models/Booking.model");
const Availability = require("../models/Availability.model");
const ApiResponse = require("../utils/apiResponse");

// Get all sessions for authenticated user
const getUserSessions = async (req, res, next) => {
  try {
    const sessions = await Session.find({ userId: req.user.userId })
      .populate("bookingId", "serviceName therapistName date time")
      .populate("subscriptionId", "planId planName startDate endDate status")
      .populate("therapistId", "name email role");

    res
      .status(200)
      .json(
        ApiResponse.success({ sessions }, "Sessions retrieved successfully")
      );
  } catch (error) {
    next(error);
  }
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
      .populate("bookingId", "serviceName therapistName date time")
      .populate("subscriptionId", "planId planName startDate endDate status")
      .populate("therapistId", "name email role")
      .populate("userId", "name email");

    res
      .status(200)
      .json(
        ApiResponse.success({ sessions }, "All sessions retrieved successfully")
      );
  } catch (error) {
    next(error);
  }
};

// Get upcoming sessions for authenticated user
const getUserUpcomingSessions = async (req, res, next) => {
  try {
    const now = new Date();

    const sessions = await Session.find({
      userId: req.user.userId,
      startTime: { $gte: now },
      status: { $in: ["scheduled", "live"] },
    })
      .populate("bookingId", "serviceName therapistName date time")
      .populate("subscriptionId", "planId planName startDate endDate status")
      .populate("therapistId", "name email role");

    res
      .status(200)
      .json(
        ApiResponse.success(
          { sessions },
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

    const sessions = await Session.find({
      startTime: { $gte: now },
      status: { $in: ["scheduled", "live"] },
    })
      .populate("bookingId", "serviceName therapistName date time")
      .populate("subscriptionId", "planId planName startDate endDate status")
      .populate("therapistId", "name email role")
      .populate("userId", "name email");

    res
      .status(200)
      .json(
        ApiResponse.success(
          { sessions },
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

    res
      .status(200)
      .json(ApiResponse.success({ session }, "Session retrieved successfully"));
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
      duration,
    } = req.body;

    if (!bookingId && !subscriptionId) {
      return res.status(400).json(
        ApiResponse.error(
          "Either bookingId or subscriptionId must be provided"
        )
      );
    }

    const userId = req.user.userId;
    let therapistId = null;

    /* ================= BOOKING FLOW ================= */
    if (bookingId) {
      const booking = await Booking.findOne({ _id: bookingId, userId });

      if (!booking) {
        return res
          .status(404)
          .json(ApiResponse.error("Booking not found"));
      }

      if (booking.paymentStatus !== "paid") {
        return res
          .status(400)
          .json(ApiResponse.error("Booking payment not completed"));
      }

      therapistId = booking.therapistId;
    }

    /* ================= SUBSCRIPTION FLOW ================= */
    if (subscriptionId) {
      const Subscription = require("../models/Subscription.model");

      const subscription = await Subscription.findOne({
        _id: subscriptionId,
        userId,
      });

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
        return res
          .status(400)
          .json(ApiResponse.error("Subscription expired"));
      }

      // 🔥 IMPORTANT FIX
      therapistId = bodyTherapistId || null;

      if (!therapistId) {
        return res.status(400).json(
          ApiResponse.error(
            "therapistId is required for subscription session booking"
          )
        );
      }
    }

    /* ================= TIME ================= */
    const startTime = new Date(`${date}T${time}:00`);
    const endTime =
      duration && duration > 0
        ? new Date(startTime.getTime() + duration * 60000)
        : null;

    /* ================= CREATE SESSION ================= */
    const session = await Session.create({
      bookingId: bookingId || undefined,
      subscriptionId: subscriptionId || undefined,
      therapistId,
      userId,
      date,
      time,
      startTime,
      endTime,
      type: type || "1-on-1",
      status: status || "scheduled",
      duration: duration || 0,
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

    return res.status(201).json(
      ApiResponse.success(
        { session },
        "Session created successfully"
      )
    );
  } catch (error) {
    next(error);
  }
};



// Update session by ID
const updateSession = async (req, res, next) => {
  try {
    const { status, notes, duration, time } = req.body;

    // Check if session belongs to user
    const session = await Session.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!session) {
      return res.status(404).json(ApiResponse.error("Session not found"));
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
      const startTime = new Date(`${session.date}T${time}:00`);
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
              "timeSlots.$[elem].status": "available" 
            } 
          },
          { 
            arrayFilters: [
              { 
                "elem.start": session.time, 
                "elem.status": "booked" 
              }
            ]
          }
        );

        // Mark new time slot as booked
        await Availability.updateOne(
          { therapistId: session.therapistId, date: session.date },
          { 
            $set: { 
              "timeSlots.$[elem].status": "booked" 
            } 
          },
          { 
            arrayFilters: [
              { 
                "elem.start": time, 
                "elem.status": "available" 
              }
            ]
          }
        );
      } catch (availabilityError) {
        console.error('Error updating availability status during session update:', availabilityError);
        // Continue with response even if availability update fails
      }
    }

    res
      .status(200)
      .json(ApiResponse.success({ session: updatedSession }, "Session updated successfully"));
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
              "timeSlots.$[elem].status": "available" 
            } 
          },
          { 
            arrayFilters: [
              { 
                "elem.start": session.time, 
                "elem.status": "booked" 
              }
            ]
          }
        );
      } catch (availabilityError) {
        console.error('Error updating availability status after session deletion:', availabilityError);
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

    // Check if session can be rescheduled (should not be live or completed)
    if (session.status === "live" || session.status === "completed") {
      return res
        .status(400)
        .json(ApiResponse.error("Cannot reschedule live or completed session"));
    }

    // Auto-generate new startTime from date and time
    const startTime = new Date(`${date}T${time}:00`);

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
      .populate("therapistId", "name email role");

    // Update availability statuses: mark old time slot as available and new time slot as booked
    if (updatedSession.therapistId) {
      try {
        // Mark old time slot as available
        await Availability.updateOne(
          { therapistId: updatedSession.therapistId, date: updatedSession.date },
          { 
            $set: { 
              "timeSlots.$[elem].status": "available" 
            } 
          },
          { 
            arrayFilters: [
              { 
                "elem.start": updatedSession.time, 
                "elem.status": "booked" 
              }
            ]
          }
        );

        // Mark new time slot as booked
        await Availability.updateOne(
          { therapistId: updatedSession.therapistId, date },
          { 
            $set: { 
              "timeSlots.$[elem].status": "booked" 
            } 
          },
          { 
            arrayFilters: [
              { 
                "elem.start": time, 
                "elem.status": "available" 
              }
            ]
          }
        );
      } catch (availabilityError) {
        console.error('Error updating availability status during reschedule:', availabilityError);
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

    res
      .status(200)
      .json(ApiResponse.success({ session }, "Session retrieved successfully"));
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
      duration,
      notes,
    } = req.body;

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
      booking = await Booking.findById(bookingId);
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
    }

    // Handle subscription-based session
    if (subscriptionId) {
      const Subscription = require("../models/Subscription.model");
      const SubscriptionPlan = require("../models/SubscriptionPlan.model");
      const sessionModel = require("../models/Session.model");

      subscription = await Subscription.findById(subscriptionId);
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

      // Check session limits if the subscription plan has a limit
      const plan = await SubscriptionPlan.findById(subscription.planId);
      if (plan && plan.sessions > 0) {
        // 0 means unlimited sessions
        // Count completed sessions for this subscription
        const completedSessionsCount = await sessionModel.countDocuments({
          subscriptionId: subscription._id,
          status: "completed",
        });

        if (completedSessionsCount >= plan.sessions) {
          return res
            .status(400)
            .json(
              ApiResponse.error(
                `Cannot create session: Maximum session limit of ${plan.sessions} reached for this subscription`
              )
            );
        }
      }
    }

    // Auto-generate startTime from date and time
    const startTime = new Date(`${date}T${time}:00`);

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
              "timeSlots.$[elem].status": "booked" 
            } 
          },
          { 
            arrayFilters: [
              { 
                "elem.start": sessionData.time, 
                "elem.status": "available" 
              }
            ]
          }
        );
      } catch (availabilityError) {
        console.error('Error updating availability status:', availabilityError);
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
      updateFields.startTime = new Date(`${currentSession.date}T${time}:00`);
    } else if (date && !time) {
      // If only date is provided, use the existing time
      updateFields.startTime = new Date(`${date}T${currentSession.time}:00`);
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
              "timeSlots.$[elem].status": "available" 
            } 
          },
          { 
            arrayFilters: [
              { 
                "elem.start": oldTime, 
                "elem.status": "booked" 
              }
            ]
          }
        );

        // Mark new time slot as booked
        await Availability.updateOne(
          { therapistId: currentSession.therapistId, date: newDate },
          { 
            $set: { 
              "timeSlots.$[elem].status": "booked" 
            } 
          },
          { 
            arrayFilters: [
              { 
                "elem.start": newTime, 
                "elem.status": "available" 
              }
            ]
          }
        );
      } catch (availabilityError) {
        console.error('Error updating availability status during admin session update:', availabilityError);
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
              "timeSlots.$[elem].status": "available" 
            } 
          },
          { 
            arrayFilters: [
              { 
                "elem.start": session.time, 
                "elem.status": "booked" 
              }
            ]
          }
        );
      } catch (availabilityError) {
        console.error('Error updating availability status after session deletion:', availabilityError);
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

    // Check if session can be rescheduled (should not be live or completed)
    if (session.status === "live" || session.status === "completed") {
      return res
        .status(400)
        .json(ApiResponse.error("Cannot reschedule live or completed session"));
    }

    // Auto-generate new startTime from date and time
    const startTime = new Date(`${date}T${time}:00`);

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
        // Mark old time slot as available
        await Availability.updateOne(
          { therapistId: updatedSession.therapistId, date: updatedSession.date },
          { 
            $set: { 
              "timeSlots.$[elem].status": "available" 
            } 
          },
          { 
            arrayFilters: [
              { 
                "elem.start": updatedSession.time, 
                "elem.status": "booked" 
              }
            ]
          }
        );

        // Mark new time slot as booked
        await Availability.updateOne(
          { therapistId: updatedSession.therapistId, date },
          { 
            $set: { 
              "timeSlots.$[elem].status": "booked" 
            } 
          },
          { 
            arrayFilters: [
              { 
                "elem.start": time, 
                "elem.status": "available" 
              }
            ]
          }
        );
      } catch (availabilityError) {
        console.error('Error updating availability status during reschedule:', availabilityError);
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

    // Update session status to scheduled
    const updatedSession = await Session.findByIdAndUpdate(
      req.params.id,
      { status: "scheduled" },
      { new: true, runValidators: true }
    )
      .populate("bookingId", "serviceName therapistName date time")
      .populate("subscriptionId", "planId planName startDate endDate status")
      .populate("therapistId", "name email role")
      .populate("userId", "name email");

    // Update availability status to 'booked' if therapistId exists
    if (updatedSession.therapistId) {
      try {
        await Availability.updateOne(
          { therapistId: updatedSession.therapistId, date: updatedSession.date },
          { 
            $set: { 
              "timeSlots.$[elem].status": "booked" 
            } 
          },
          { 
            arrayFilters: [
              { 
                "elem.start": updatedSession.time, 
                "elem.status": "available" 
              }
            ]
          }
        );
      } catch (availabilityError) {
        console.error('Error updating availability status during session accept:', availabilityError);
        // Continue with response even if availability update fails
      }
    }

    res
      .status(200)
      .json(ApiResponse.success({ session: updatedSession }, "Session accepted successfully"));
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
          { therapistId: updatedSession.therapistId, date: updatedSession.date },
          { 
            $set: { 
              "timeSlots.$[elem].status": "available" 
            } 
          },
          { 
            arrayFilters: [
              { 
                "elem.start": updatedSession.time, 
                "elem.status": "booked" 
              }
            ]
          }
        );
      } catch (availabilityError) {
        console.error('Error updating availability status during session reject:', availabilityError);
        // Continue with response even if availability update fails
      }
    }

    res
      .status(200)
      .json(ApiResponse.success({ session: updatedSession }, "Session rejected successfully"));
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
};

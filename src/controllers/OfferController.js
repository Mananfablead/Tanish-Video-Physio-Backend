const Offer = require("../models/Offer");
const ApiResponse = require("../utils/apiResponse");

/**
 * @desc    Create new offer
 * @route   POST /api/offers
 * @access  Private/Admin
 */
exports.createOffer = async (req, res, next) => {
  try {
    // Check if user is authenticated
    if (!req.user) {
      return next(ApiResponse.error('Authentication required', 401));
    }
    
    const {
      code,
      discount,
      type,
      value,
      description,
      minimumAmount,
      maxDiscountAmount,
      usageLimit,
      startDate,
      endDate,
      appliesToUsers,
      appliesToNewUsersOnly,
      allowedBookingTypes,
    } = req.body;

    // Check if offer code already exists
    const existingOffer = await Offer.findOne({ code: code.toUpperCase() });
    if (existingOffer) {
      return next(ApiResponse.error("Offer code already exists", 400));
    }

    // Validate dates
    const now = new Date();
    if (new Date(startDate) < now) {
      return next(ApiResponse.error("Start date must be in the future", 400));
    }
    if (new Date(endDate) <= new Date(startDate)) {
      return next(ApiResponse.error("End date must be after start date", 400));
    }

    const offer = await Offer.create({
      code: code.toUpperCase(),
      discount,
      type,
      value,
      description,
      minimumAmount,
      maxDiscountAmount,
      usageLimit,
      startDate,
      endDate,
      appliesToUsers: appliesToUsers || [],
      appliesToNewUsersOnly: appliesToNewUsersOnly || false,
      allowedBookingTypes: allowedBookingTypes || ['booking', 'subscription'],
      createdBy: req.user.userId || req.user._id || req.user.id,
    });

    res.status(201).json({
      success: true,
      data: offer,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all offers
 * @route   GET /api/offers
 * @access  Public
 */
exports.getAllOffers = async (req, res, next) => {
  try {
    const { isActive = "true", page = 1, limit = 10 } = req.query;

    // Build query
    const query = { isActive: isActive === "true" };

    // For public access, only show currently active offers
    // Filter by active date range
    const now = new Date();
    query.startDate = { $lte: now };
    query.endDate = { $gte: now };

    // Add usage limit filter if needed
    if (req.query.excludeUsedUp) {
      query.$expr = { $lt: ["$usedCount", "$usageLimit"] };
    }

    const offers = await Offer.find(query)
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Offer.countDocuments(query);

    res.status(200).json({
      success: true,
      count: offers.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      data: offers,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all offers (admin only - no date restrictions)
 * @route   GET /api/offers/admin
 * @access  Private/Admin
 */
exports.getAllOffersAdmin = async (req, res, next) => {
  try {
    const { isActive = "true", page = 1, limit = 10 } = req.query;

    // Build query - only filter by active status, not by date
    const query = { isActive: isActive === "true" };

    // Add usage limit filter if needed
    if (req.query.excludeUsedUp) {
      query.$expr = { $lt: ["$usedCount", "$usageLimit"] };
    }

    const offers = await Offer.find(query)
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Offer.countDocuments(query);

    res.status(200).json({
      success: true,
      count: offers.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      data: offers,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get offer by ID
 * @route   GET /api/offers/:id
 * @access  Public
 */
exports.getOfferById = async (req, res, next) => {
  try {
    const offer = await Offer.findById(req.params.id).populate(
      "createdBy",
      "name email"
    );

    if (!offer) {
      return next(
        ApiResponse.error(`Offer not found with id ${req.params.id}`, 404)
      );
    }

    // Check if offer is active and within date range
    const now = new Date();
    if (!offer.isActive || now < offer.startDate || now > offer.endDate) {
      return next(ApiResponse.error("Offer is not available", 400));
    }

    // Check if usage limit reached
    if (offer.usageLimit && offer.usedCount >= offer.usageLimit) {
      return next(ApiResponse.error("Offer usage limit reached", 400));
    }

    res.status(200).json({
      success: true,
      data: offer,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update offer
 * @route   PUT /api/offers/:id
 * @access  Private/Admin
 */
exports.updateOffer = async (req, res, next) => {
  try {
    const offer = await Offer.findById(req.params.id);

    if (!offer) {
      return next(
        ApiResponse.error(`Offer not found with id ${req.params.id}`, 404)
      );
    }

    const updatedOffer = await Offer.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      {
        new: true,
        runValidators: true,
      }
    ).populate("createdBy", "name email");

    res.status(200).json({
      success: true,
      data: updatedOffer,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete offer
 * @route   DELETE /api/offers/:id
 * @access  Private/Admin
 */
exports.deleteOffer = async (req, res, next) => {
  try {
    const offer = await Offer.findById(req.params.id);

    if (!offer) {
      return next(
        ApiResponse.error(`Offer not found with id ${req.params.id}`, 404)
      );
    }

    await offer.remove();

    res.status(200).json({
      success: true,
      message: "Offer remo                                  ved",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Validate offer code
 * @route   POST /api/offers/validate
 * @access  Public
 */
exports.validateOffer = async (req, res, next) => {
  try {
    const { code, amount, bookingType, userId } = req.body;

    if (!code) {
      return next(ApiResponse.error("Offer code is required", 400));
    }

    const offer = await Offer.findOne({ code: code.toUpperCase() }).populate(
      "appliesToUsers",
      "_id"
    );

    if (!offer) {
      return next(ApiResponse.error("Invalid offer code", 400));
    }

    // Check if offer is active
    if (!offer.isActive) {
      return next(ApiResponse.error("Offer is not active", 400));
    }

    // Check date range
    const now = new Date();
    if (now < offer.startDate || now > offer.endDate) {
      return next(ApiResponse.error("Offer is not valid at this time", 400));
    }

    // Check minimum amount
    if (amount && offer.minimumAmount > amount) {
      return next(
        ApiResponse.error(
          `Minimum order amount ₹${offer.minimumAmount} required for this offer`,
          400
        )
      );
    }

    // Check usage limit
    if (offer.usageLimit && offer.usedCount >= offer.usageLimit) {
      return next(ApiResponse.error("Offer usage limit reached", 400));
    }

    // Check booking type limitation
    if (
      bookingType &&
      offer.allowedBookingTypes &&
      offer.allowedBookingTypes.length > 0
    ) {
      if (!offer.allowedBookingTypes.includes(bookingType)) {
        return next(
          ApiResponse.error(
            `Offer is not applicable for ${bookingType} type`,
            400
          )
        );
      }
    }

    // Check user-specific restrictions
    if (userId) {
      // Check if offer is restricted to specific users
      if (offer.appliesToUsers && offer.appliesToUsers.length > 0) {
        const userFound = offer.appliesToUsers.some(
          (user) => user._id.toString() === userId
        );
        if (!userFound) {
          return next(
            ApiResponse.error("Offer is not applicable to this user", 400)
          );
        }
      }

      // Check if offer is for new users only
      if (offer.appliesToNewUsersOnly) {
        const User = require("../models/User");
        const user = await User.findById(userId);
        if (user && user.createdAt) {
          // Check if user was created more than 30 days ago (considered not new)
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          if (user.createdAt < thirtyDaysAgo) {
            return next(
              ApiResponse.error("Offer is only available for new users", 400)
            );
          }
        }
      }
    }

    res.status(200).json({
      success: true,
      data: {
        _id: offer._id,
        code: offer.code,
        discount: offer.discount,
        type: offer.type,
        value: offer.value,
        maxDiscountAmount: offer.maxDiscountAmount,
        minimumAmount: offer.minimumAmount,
        allowedBookingTypes: offer.allowedBookingTypes,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Increment offer usage count
 * @route   POST /api/offers/:id/increment-usage
 * @access  Private/Admin
 */
exports.incrementUsage = async (req, res, next) => {
  try {
    const offer = await Offer.findById(req.params.id);

    if (!offer) {
      return next(
        ApiResponse.error(`Offer not found with id ${req.params.id}`, 404)
      );
    }

    // Increment usage count
    offer.usedCount = offer.usedCount + 1;
    await offer.save();

    res.status(200).json({
      success: true,
      data: {
        _id: offer._id,
        usedCount: offer.usedCount,
        usageLimit: offer.usageLimit,
      },
    });
  } catch (error) {
    next(error);
  }
};

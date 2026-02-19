const Availability = require('../models/Availability.model');
const User = require('../models/User.model');
const ApiResponse = require('../utils/apiResponse');

// Get all availability
const getAvailability = async (req, res, next) => {
    try {
        const availability = await Availability.find()
            .populate('therapistId', 'name email role')

        res.status(200).json(ApiResponse.success({ availability }, 'Availability retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Get availability by therapist
const getAvailabilityByTherapist = async (req, res, next) => {
    try {
        const { therapistId } = req.params;

        // Validate therapist exists
        const therapist = await User.findById(therapistId);
        if (!therapist || (therapist.role !== 'admin' && therapist.role !== 'therapist')) {
            return res.status(404).json(ApiResponse.error('Therapist not found'));
        }

        const availability = await Availability.find({ therapistId })
            .populate('therapistId', 'name email role')

        res.status(200).json(ApiResponse.success({ availability }, 'Therapist availability retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Create availability
const createAvailability = async (req, res, next) => {
    try {
        const { therapistId, date, timeSlots } = req.body;

        // Validate therapist exists
        const therapist = await User.findById(therapistId);
        if (!therapist || (therapist.role !== 'admin' && therapist.role !== 'therapist')) {
            return res.status(404).json(ApiResponse.error('Therapist not found'));
        }

        // Validate time slots format and add default duration/bookingType if not provided
        const validatedTimeSlots = timeSlots.map(slot => {
            // Set default duration to 45 min and bookingType to regular if not provided
            return {
                start: slot.start,
                end: slot.end,
                status: slot.status || 'available',
                duration: slot.duration || 45, // Default to 45 min
                bookingType: slot.bookingType || 'regular' // Default to regular
            };
        });

        // Check if availability already exists for the same therapist and date
        const existingAvailability = await Availability.findOne({ therapistId, date });
        if (existingAvailability) {
            return res.status(409).json(ApiResponse.error('Availability already exists for this date and therapist'));
        }

        const availability = new Availability({
            therapistId,
            date,
            timeSlots: validatedTimeSlots
        });

        await availability.save();

        await availability.populate('therapistId', 'name specialty');

        res.status(201).json(ApiResponse.success({ availability }, 'Availability created successfully'));
    } catch (error) {
        next(error);
    }
};

// Update availability
const updateAvailability = async (req, res, next) => {
    try {
        const { timeSlots } = req.body;

        // Validate time slots format and add default duration/bookingType if not provided
        const validatedTimeSlots = timeSlots.map(slot => {
            // Set default duration to 45 min and bookingType to regular if not provided
            return {
                start: slot.start,
                end: slot.end,
                status: slot.status || 'available',
                duration: slot.duration || 45, // Default to 45 min
                bookingType: slot.bookingType || 'regular' // Default to regular
            };
        });

        const availability = await Availability.findByIdAndUpdate(
            req.params.id,
            { timeSlots: validatedTimeSlots },
            { new: true, runValidators: true }
        )
            .populate('therapistId', 'name email role')

        if (!availability) {
            return res.status(404).json(ApiResponse.error('Availability not found'));
        }

        res.status(200).json(ApiResponse.success({ availability }, 'Availability updated successfully'));
    } catch (error) {
        next(error);
    }
};

// Delete availability
const deleteAvailability = async (req, res, next) => {
    try {
        const availability = await Availability.findByIdAndDelete(req.params.id)
            .populate('therapistId', 'name email role')

        if (!availability) {
            return res.status(404).json(ApiResponse.error('Availability not found'));
        }

        res.status(200).json(ApiResponse.success({ availability }, 'Availability deleted successfully'));
    } catch (error) {
        next(error);
    }
};

// Bulk update availability for a month
const bulkUpdateAvailability = async (req, res, next) => {
    try {
        const { therapistId, month, year, timeSlots } = req.body;

        // Validate required fields
        if (!therapistId || month === undefined || year === undefined) {
            return res.status(400).json(ApiResponse.error('Missing required fields: therapistId, month, and year'));
        }

        // Validate therapist exists
        console.log('Looking for therapistId:', therapistId);
        console.log('TherapistId type:', typeof therapistId);

        const therapist = await User.findById(therapistId);
        console.log('Therapist found:', therapist);

        if (!therapist) {
            console.log('No therapist found with ID:', therapistId);
            return res.status(404).json(ApiResponse.error(`Therapist not found with ID: ${therapistId}`));
        }

        // Check if user has appropriate role
        if (!therapist.role) {
            return res.status(403).json(ApiResponse.error('Insufficient permissions'));
        }

        // Validate month and year - accept both numeric and string formats
        const monthNum = parseInt(month);
        const yearNum = parseInt(year);
        if (isNaN(monthNum) || monthNum < 1 || monthNum > 12 || isNaN(yearNum) || yearNum < 1970) {
            return res.status(400).json(ApiResponse.error('Invalid month or year'));
        }

        // Calculate the number of days in the specified month
        const daysInMonth = new Date(yearNum, monthNum, 0).getDate();

        // Generate all dates for the month
        const datesToUpdate = [];
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${yearNum}-${monthNum.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            datesToUpdate.push(dateStr);
        }

        // Update or create availability records for each date
        const updatedAvailabilities = [];
        for (const date of datesToUpdate) {
            let availability = await Availability.findOne({ therapistId, date });

            if (availability) {
                // Update existing availability
                if (timeSlots !== undefined) {
                    // Validate time slots format and add default duration/bookingType if not provided
                    const validatedTimeSlots = timeSlots.map(slot => {
                        // Set default duration to 45 min and bookingType to regular if not provided
                        return {
                            start: slot.start,
                            end: slot.end,
                            status: slot.status || 'available',
                            duration: slot.duration || 45, // Default to 45 min
                            bookingType: slot.bookingType || 'regular' // Default to regular
                        };
                    });
                    availability.timeSlots = validatedTimeSlots;
                }
                await availability.save();
            } else {
                // Create new availability
                let validatedTimeSlots = [];
                if (timeSlots && Array.isArray(timeSlots)) {
                    // Validate time slots format and add default duration/bookingType if not provided
                    validatedTimeSlots = timeSlots.map(slot => {
                        // Set default duration to 45 min and bookingType to regular if not provided
                        return {
                            start: slot.start,
                            end: slot.end,
                            status: slot.status || 'available',
                            duration: slot.duration || 45, // Default to 45 min
                            bookingType: slot.bookingType || 'regular' // Default to regular
                        };
                    });
                }
                availability = new Availability({
                    therapistId,
                    date,
                    timeSlots: validatedTimeSlots
                });
                await availability.save();
            }

            await availability.populate('therapistId', 'name specialty');
            updatedAvailabilities.push(availability);
        }

        res.status(200).json(ApiResponse.success({
            count: updatedAvailabilities.length,
            availabilities: updatedAvailabilities
        }, `Availability updated for ${updatedAvailabilities.length} days in ${monthNum}/${yearNum}`));
    } catch (error) {
        // Log the error for debugging
        console.error('Bulk update availability error:', error);
        next(error);
    }
};

module.exports = {
    getAvailability,
    getAvailabilityByTherapist,
    createAvailability,
    updateAvailability,
    deleteAvailability,
    bulkUpdateAvailability
};
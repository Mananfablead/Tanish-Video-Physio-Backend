const Availability = require('../models/Availability.model');
const User = require('../models/User.model');
const ApiResponse = require('../utils/apiResponse');

/**
 * Convert admin's local time to client's local time
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} time - Time in HH:MM format (admin's local time)
 * @param {string} adminTimezone - Admin's timezone
 * @param {string} clientTimezone - Client's timezone
 * @returns {string} - Time in HH:MM format (client's local time)
 */
const convertAdminTimeToClientTime = (date, time, adminTimezone, clientTimezone) => {
    try {
        // If same timezone or either is missing, return as is
        if (!adminTimezone || !clientTimezone || adminTimezone === clientTimezone) {
            return time;
        }

        console.log(`\n[Timezone Conversion] Converting ${time} (${adminTimezone}) to ${clientTimezone}`);

        // Step 1: Create date object with admin's local time
        const [hours, minutes] = time.split(':').map(Number);
        const adminDateTime = new Date(`${date}T${time}:00`);
        console.log(`[Step 1] Admin datetime: ${adminDateTime.toISOString()} (local: ${adminDateTime})`);

        // Step 2: Get UTC time from admin's timezone
        const utcString = adminDateTime.toLocaleString('en-US', { timeZone: adminTimezone });
        const utcDate = new Date(utcString);
        console.log(`[Step 2] UTC equivalent: ${utcDate.toISOString()}`);

        // Step 3: Convert UTC to client's timezone
        const clientString = utcDate.toLocaleString('en-US', { timeZone: clientTimezone });
        const clientDate = new Date(clientString);
        console.log(`[Step 3] Client datetime: ${clientDate.toISOString()} (local: ${clientDate})`);

        // Step 4: Format as HH:MM
        const clientHours = String(clientDate.getHours()).padStart(2, '0');
        const clientMinutes = String(clientDate.getMinutes()).padStart(2, '0');
        const result = `${clientHours}:${clientMinutes}`;

        console.log(`[Result] ${time} ${adminTimezone} = ${result} ${clientTimezone}`);
        console.log(`[Verification] Time difference: ${(clientDate.getTime() - adminDateTime.getTime()) / (1000 * 60 * 60)} hours\n`);

        return result;

    } catch (error) {
        console.error('[Timezone Conversion] Error:', error);
        return time; // Fallback to original time
    }
};

/**
 * Helper function to get UTC time from local time (for internal calculations)
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} time - Time in HH:MM format (local)
 * @param {string} timezone - Source timezone
 * @returns {Date} - UTC Date object
 */
const getUTCFromLocal = (date, time, timezone) => {
    if (!timezone || timezone === 'UTC') {
        const [h, m] = time.split(':');
        return new Date(`${date}T${time}:00Z`);
    }

    const localDate = new Date(`${date}T${time}:00`);
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    const parts = formatter.formatToParts(localDate);
    const partMap = {};
    parts.forEach(part => {
        if (part.type !== 'literal') {
            partMap[part.type] = part.value;
        }
    });

    const interpretedDate = new Date(Date.UTC(
        parseInt(partMap.year),
        parseInt(partMap.month) - 1,
        parseInt(partMap.day),
        parseInt(partMap.hour),
        parseInt(partMap.minute)
    ));

    const diffMs = localDate.getTime() - interpretedDate.getTime();
    return new Date(localDate.getTime() - diffMs);
};

// Get all availability - Convert to client's timezone automatically
const getAvailability = async (req, res, next) => {
    try {
        // Get client timezone from header (set by axios interceptor)
        const clientTimezone = req.headers['x-timezone'] || 'UTC';

        // DEBUG LOG - Check what timezone is being received
        console.log('\n' + '='.repeat(60));
        console.log('[Availability API] Request received');
        console.log('='.repeat(60));
        console.log('Client Timezone from header:', clientTimezone);
        console.log('All headers:', JSON.stringify(req.headers, null, 2));
        console.log('='.repeat(60) + '\n');

        const availability = await Availability.find()
            .populate('therapistId', 'name email role')

        // Convert admin's local time to client's local time for display
        const availabilityWithClientTime = availability.map(avail => {
            const convertedTimeSlots = avail.timeSlots.map(slot => {
                const clientTime = convertAdminTimeToClientTime(
                    avail.date,
                    slot.start,
                    avail.adminTimezone,
                    clientTimezone
                );

                // Calculate end time proportionally
                const [startHour, startMin] = slot.start.split(':').map(Number);
                const [endHour, endMin] = slot.end.split(':').map(Number);
                const durationMin = (endHour * 60 + endMin) - (startHour * 60 + startMin);

                const [clientStartHour, clientStartMin] = clientTime.split(':').map(Number);
                const clientEndTotalMin = (clientStartHour * 60 + clientStartMin) + durationMin;
                const clientEndHour = Math.floor(clientEndTotalMin / 60) % 24;
                const clientEndMin = clientEndTotalMin % 60;
                const clientEndTime = `${String(clientEndHour).padStart(2, '0')}:${String(clientEndMin).padStart(2, '0')}`;

                return {
                    ...slot.toObject(),
                    start: clientTime,      // Converted to client's timezone
                    end: clientEndTime,     // Adjusted end time
                    originalStart: slot.start,  // Keep admin's time for reference
                    originalEnd: slot.end,      // Keep admin's time for reference
                    adminTimezone: avail.adminTimezone,
                    clientTimezone: clientTimezone
                };
            });

            return {
                ...avail.toObject(),
                timeSlots: convertedTimeSlots,
                clientTimezone,
                adminTimezone: avail.adminTimezone
            };
        });

        res.status(200).json(ApiResponse.success({
            availability: availabilityWithClientTime,
            clientTimezone,
            adminTimezone: availability[0]?.adminTimezone || 'Not set',
            note: `Times are shown in your local timezone (${clientTimezone}). Admin's timezone: ${availability[0]?.adminTimezone}`
        }, 'Availability retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Get availability by therapist - Convert to client's timezone automatically
const getAvailabilityByTherapist = async (req, res, next) => {
    try {
        const { therapistId } = req.params;
        // Get client timezone from header (set by axios interceptor)
        const clientTimezone = req.headers['x-timezone'] || 'UTC';

        // Validate therapist exists
        const therapist = await User.findById(therapistId);
        if (!therapist || (therapist.role !== 'admin' && therapist.role !== 'therapist')) {
            return res.status(404).json(ApiResponse.error('Therapist not found'));
        }

        const availability = await Availability.find({ therapistId })
            .populate('therapistId', 'name email role')

        // Convert admin's local time to client's local time for display
        const availabilityWithClientTime = availability.map(avail => {
            const convertedTimeSlots = avail.timeSlots.map(slot => {
                const clientTime = convertAdminTimeToClientTime(
                    avail.date,
                    slot.start,
                    avail.adminTimezone,
                    clientTimezone
                );

                // Calculate end time proportionally
                const [startHour, startMin] = slot.start.split(':').map(Number);
                const [endHour, endMin] = slot.end.split(':').map(Number);
                const durationMin = (endHour * 60 + endMin) - (startHour * 60 + startMin);

                const [clientStartHour, clientStartMin] = clientTime.split(':').map(Number);
                const clientEndTotalMin = (clientStartHour * 60 + clientStartMin) + durationMin;
                const clientEndHour = Math.floor(clientEndTotalMin / 60) % 24;
                const clientEndMin = clientEndTotalMin % 60;
                const clientEndTime = `${String(clientEndHour).padStart(2, '0')}:${String(clientEndMin).padStart(2, '0')}`;

                return {
                    ...slot.toObject(),
                    start: clientTime,      // Converted to client's timezone
                    end: clientEndTime,     // Adjusted end time
                    originalStart: slot.start,  // Keep admin's time for reference
                    originalEnd: slot.end,      // Keep admin's time for reference
                    adminTimezone: avail.adminTimezone,
                    clientTimezone: clientTimezone
                };
            });

            return {
                ...avail.toObject(),
                timeSlots: convertedTimeSlots,
                clientTimezone,
                adminTimezone: avail.adminTimezone
            };
        });

        res.status(200).json(ApiResponse.success({
            availability: availabilityWithClientTime,
            clientTimezone,
            adminTimezone: availability[0]?.adminTimezone || 'Not set',
            note: `Times are shown in your local timezone (${clientTimezone}). Admin's timezone: ${availability[0]?.adminTimezone}`
        }, 'Therapist availability retrieved successfully'));
    } catch (error) {
        next(error);
    }
};

// Debug endpoint to check what timezone is being received
const debugTimezone = async (req, res, next) => {
    try {
        const clientTimezone = req.query.timezone || req.headers['x-timezone'] || 'UTC';
        const now = new Date();

        res.status(200).json(ApiResponse.success({
            clientTimezone,
            queryTimezone: req.query.timezone,
            headerTimezone: req.headers['x-timezone'],
            serverTime: now.toISOString(),
            serverLocalTime: now.toLocaleString('en-US'),
            allHeaders: {
                'x-timezone': req.headers['x-timezone'],
                'user-agent': req.headers['user-agent']
            }
        }, 'Timezone debug info'));
    } catch (error) {
        next(error);
    }
};

// Create availability - Store admin's LOCAL time (NOT UTC)
const createAvailability = async (req, res, next) => {
    try {
        const { therapistId, date, timeSlots, timezone } = req.body;

        // Validate therapist exists
        const therapist = await User.findById(therapistId);
        if (!therapist || (therapist.role !== 'admin' && therapist.role !== 'therapist')) {
            return res.status(404).json(ApiResponse.error('Therapist not found'));
        }

        // Validate timezone is provided
        if (!timezone) {
            return res.status(400).json(ApiResponse.error('Admin timezone is required'));
        }
        

        // Store time slots AS IS (admin's local time) - NO conversion needed
        const validatedTimeSlots = timeSlots.map(slot => ({
            start: slot.start,  // Store as-is
            end: slot.end,      // Store as-is
            status: slot.status || 'available',
            duration: slot.duration || 45,
            bookingType: slot.bookingType || 'regular',
            sessionType: slot.sessionType || 'one-to-one',
            maxParticipants: slot.maxParticipants || (slot.sessionType === 'group' ? 5 : 1),
            bookedParticipants: typeof slot.bookedParticipants === 'number' ? slot.bookedParticipants : 0
        }));

        // Check if availability already exists for the same therapist and date
        const existingAvailability = await Availability.findOne({ therapistId, date });
        if (existingAvailability) {
            return res.status(409).json(ApiResponse.error('Availability already exists for this date and therapist'));
        }

        const availability = new Availability({
            therapistId,
            date,
            timeSlots: validatedTimeSlots,
            adminTimezone: timezone  // Store admin's timezone
        });

        await availability.save();

        await availability.populate('therapistId', 'name specialty');

        res.status(201).json(ApiResponse.success({ availability }, 'Availability created successfully'));
    } catch (error) {
        next(error);
    }
};

// Update availability - Store admin's LOCAL time (NOT UTC)
const updateAvailability = async (req, res, next) => {
    try {
        const { timeSlots, timezone, minimumNoticePeriod } = req.body;

        // Get existing availability to determine the date and admin timezone
        const existingAvailability = await Availability.findById(req.params.id);
        if (!existingAvailability) {
            return res.status(404).json(ApiResponse.error('Availability not found'));
        }

        // Store time slots AS IS (admin's local time) - NO conversion needed
        const validatedTimeSlots = timeSlots.map(slot => ({
            start: slot.start,  // Store as-is
            end: slot.end,      // Store as-is
            status: slot.status || 'available',
            duration: slot.duration || 45,
            bookingType: slot.bookingType || 'regular',
            sessionType: slot.sessionType || 'one-to-one',
            maxParticipants: slot.maxParticipants || (slot.sessionType === 'group' ? 5 : 1),
            bookedParticipants: typeof slot.bookedParticipants === 'number' ? slot.bookedParticipants : 0
        }));

        const availability = await Availability.findByIdAndUpdate(
            req.params.id,
            {
                timeSlots: validatedTimeSlots,
                adminTimezone: timezone || existingAvailability.adminTimezone,
                minimumNoticePeriod: minimumNoticePeriod !== undefined ? minimumNoticePeriod : existingAvailability.minimumNoticePeriod
            },
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

// Bulk update availability - Store admin's LOCAL time (NOT UTC)
const bulkUpdateAvailability = async (req, res, next) => {
    try {
        const { therapistId, month, year, timeSlots, timezone, minimumNoticePeriod } = req.body;

        // Validate required fields
        if (!therapistId || month === undefined || year === undefined) {
            return res.status(400).json(ApiResponse.error('Missing required fields: therapistId, month, and year'));
        }

        // Validate timezone is provided
        if (!timezone) {
            return res.status(400).json(ApiResponse.error('Admin timezone is required'));
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
                    // Store time slots AS IS (admin's local time) - NO conversion
                    const validatedTimeSlots = timeSlots.map(slot => ({
                        start: slot.start,  // Store as-is
                        end: slot.end,      // Store as-is
                        status: slot.status || 'available',
                        duration: slot.duration || 45,
                        bookingType: slot.bookingType || 'regular',
                        sessionType: slot.sessionType || 'one-to-one',
                        maxParticipants: slot.maxParticipants || (slot.sessionType === 'group' ? 5 : 1),
                        bookedParticipants: typeof slot.bookedParticipants === 'number' ? slot.bookedParticipants : 0
                    }));
                    availability.timeSlots = validatedTimeSlots;
                }
                // Update minimumNoticePeriod if provided
                if (minimumNoticePeriod !== undefined) {
                    availability.minimumNoticePeriod = minimumNoticePeriod;
                }
                availability.adminTimezone = timezone || availability.adminTimezone;
                await availability.save();
            } else {
                // Create new availability
                let validatedTimeSlots = [];
                if (timeSlots && Array.isArray(timeSlots)) {
                    // Store time slots AS IS (admin's local time)
                    validatedTimeSlots = timeSlots.map(slot => ({
                        start: slot.start,  // Store as-is
                        end: slot.end,      // Store as-is
                        status: slot.status || 'available',
                        duration: slot.duration || 45,
                        bookingType: slot.bookingType || 'regular',
                        sessionType: slot.sessionType || 'one-to-one',
                        maxParticipants: slot.maxParticipants || (slot.sessionType === 'group' ? 5 : 1),
                        bookedParticipants: typeof slot.bookedParticipants === 'number' ? slot.bookedParticipants : 0
                    }));
                }
                availability = new Availability({
                    therapistId,
                    date,
                    timeSlots: validatedTimeSlots,
                    adminTimezone: timezone,
                    minimumNoticePeriod: minimumNoticePeriod || 15 // Default 15 minutes
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
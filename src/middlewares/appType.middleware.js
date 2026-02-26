const ApiResponse = require('../utils/apiResponse');

// Middleware to detect and validate application type
const detectAppType = (req, res, next) => {
    try {
        // Check if appType is already provided in request body
        if (req.body.appType) {
            // Validate appType
            const validAppTypes = ['client', 'admin'];
            if (!validAppTypes.includes(req.body.appType)) {
                return res.status(400).json(
                    ApiResponse.error('Invalid appType. Must be "client" or "admin"', 400)
                );
            }
            next();
            return;
        }

        // Auto-detect appType based on request origin/headers
        const origin = req.get('Origin') || req.get('Referer');
        const userAgent = req.get('User-Agent') || '';

        // Default to client if not detected
        let detectedAppType = 'client';

        if (origin) {
            // Check if request is from admin domain/port
            if (origin.includes('localhost:5174') ||
                origin.includes('admin.') ||
                origin.includes(':5174') ||
                origin.includes('tanish-physio-admin')) {
                detectedAppType = 'admin';
            }
            // Check if request is from client domain/port
            else if (origin.includes('localhost:5173') ||
                origin.includes('client.') ||
                origin.includes(':5173') ||
                origin.includes('tanish-physio-client')) {
                detectedAppType = 'client';
            }
        }

        // Set detected appType in request body
        req.body.appType = detectedAppType;

        console.log(`Detected appType: ${detectedAppType} for user: ${req.body.email || 'unknown'}`);

        next();
    } catch (error) {
        console.error('Error in appType detection middleware:', error);
        // Default to client if detection fails
        req.body.appType = 'client';
        next();
    }
};

// Middleware to enforce strict app type validation
const enforceAppType = (allowedAppTypes) => {
    return (req, res, next) => {
        const appType = req.body.appType;

        if (!appType) {
            return res.status(400).json(
                ApiResponse.error('appType is required for this operation', 400)
            );
        }

        if (!allowedAppTypes.includes(appType)) {
            return res.status(403).json(
                ApiResponse.error(`Operation not allowed for ${appType} application`, 403)
            );
        }

        next();
    };
};

module.exports = {
    detectAppType,
    enforceAppType
};
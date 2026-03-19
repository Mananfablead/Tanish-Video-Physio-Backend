const express = require('express');
const router = express.Router();
const axios = require('axios');

/**
 * @route   GET /api/ip-location
 * @desc    Get user's location based on IP address
 * @access  Public
 */
router.get('/', async (req, res) => {
    try {
        // Get IP from request headers or use check-ip endpoint
        const clientIP = req.headers['x-forwarded-for']?.split(',')[0] ||
            req.headers['x-real-ip'] ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress;

        console.log(`🌍 Detecting location for IP: ${clientIP}`);

        // Multiple fallback APIs for reliability
        const apis = [
            {
                name: 'ip-api.com',
                url: 'http://ip-api.com/json/',
                extract: (data) => ({
                    status: data.status || 'success',
                    country: data.country,
                    countryCode: data.countryCode,
                    region: data.region,
                    regionName: data.regionName,
                    city: data.city,
                    zip: data.zip,
                    lat: data.lat,
                    lon: data.lon,
                    timezone: data.timezone,
                    isp: data.isp,
                    org: data.org,
                    as: data.as,
                    query: data.query,
                    // Additional compatibility fields
                    country_code: data.countryCode,
                    country_name: data.country,
                    latitude: data.lat,
                    longitude: data.lon,
                    currency: null, // ip-api doesn't provide currency
                })
            },
            {
                name: 'ipapi.co',
                url: 'http://ipapi.co/json/',
                extract: (data) => ({
                    status: 'success',
                    country: data.country_name,
                    countryCode: data.country_code,
                    region: data.region_code,
                    regionName: data.region,
                    city: data.city,
                    zip: data.postal,
                    lat: data.latitude,
                    lon: data.longitude,
                    timezone: data.timezone,
                    isp: data.org,
                    org: data.org,
                    as: data.asn,
                    query: data.ip,
                    // Additional compatibility fields
                    country_code: data.country_code,
                    country_name: data.country_name,
                    latitude: data.latitude,
                    longitude: data.longitude,
                    currency: data.currency,
                })
            },
            {
                name: 'ipwho.is',
                url: 'https://ipwho.is/',
                extract: (data) => ({
                    status: data.success ? 'success' : 'fail',
                    country: data.country,
                    countryCode: data.country_code,
                    region: data.region?.code,
                    regionName: data.region?.name,
                    city: data.city,
                    zip: data.connection?.zip,
                    lat: data.latitude,
                    lon: data.longitude,
                    timezone: data.time_zone?.id || data.time_zone?.utc_offset,
                    isp: data.connection?.isp,
                    org: data.connection?.organization,
                    as: data.connection?.asn,
                    query: data.ip,
                    // Additional compatibility fields
                    country_code: data.country_code,
                    country_name: data.country,
                    latitude: data.latitude,
                    longitude: data.longitude,
                    currency: data.currency?.code,
                })
            }
        ];

        let locationData = null;

        // Try each API until one succeeds
        for (const api of apis) {
            try {
                console.log(`🔄 Trying IP API: ${api.url}`);
                const response = await axios.get(api.url, {
                    timeout: 5000,
                    headers: { 'Accept': 'application/json' }
                });

                if (response.status === 200 && response.data) {
                    locationData = api.extract(response.data);
                    console.log(`✅ Success with API: ${api.name} (${api.url})`, {
                        city: locationData.city,
                        region: locationData.regionName,
                        country: locationData.country,
                        countryCode: locationData.countryCode,
                        lat: locationData.lat,
                        lon: locationData.lon,
                        timezone: locationData.timezone,
                        isp: locationData.isp,
                        org: locationData.org,
                    });
                    break;
                }
            } catch (error) {
                console.warn(`⚠️ API failed: ${api.url}`, error.message);
                continue;
            }
        }

        if (!locationData) {
            return res.status(503).json({
                success: false,
                message: 'Unable to detect location from all available APIs',
                data: null
            });
        }

        return res.json({
            success: true,
            message: 'Location detected successfully',
            data: locationData
        });

    } catch (error) {
        console.error('❌ Error in IP location detection:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while detecting location',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/ip-location/country
 * @desc    Get only country code from IP
 * @access  Public
 */
router.get('/country', async (req, res) => {
    try {
        const clientIP = req.headers['x-forwarded-for']?.split(',')[0] ||
            req.headers['x-real-ip'] ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress;

        console.log(`🏳️ Detecting country for IP: ${clientIP}`);

        const apis = [
            'http://ipapi.co/json/',
            'https://ipwho.is/',
            'https://ip-api.com/json/'
        ];

        let countryCode = null;

        for (const apiUrl of apis) {
            try {
                const response = await axios.get(apiUrl, {
                    timeout: 5000,
                    headers: { 'Accept': 'application/json' }
                });

                if (response.status === 200 && response.data) {
                    countryCode = response.data.country_code || response.data.countryCode || null;
                    if (countryCode) {
                        console.log(`✅ Country detected: ${countryCode} via ${apiUrl}`);
                        break;
                    }
                }
            } catch (error) {
                console.warn(`⚠️ API failed: ${apiUrl}`, error.message);
                continue;
            }
        }

        if (!countryCode) {
            return res.status(503).json({
                success: false,
                message: 'Unable to detect country from all available APIs',
                data: null
            });
        }

        return res.json({
            success: true,
            message: 'Country detected successfully',
            data: { country_code: countryCode }
        });

    } catch (error) {
        console.error('❌ Error in country detection:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while detecting country',
            error: error.message
        });
    }
});

module.exports = router;

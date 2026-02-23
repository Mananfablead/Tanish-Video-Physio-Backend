const Razorpay = require('razorpay');
const { getRazorpayCredentials } = require('../utils/credentialsManager');

// Create a dynamic Razorpay instance that fetches credentials from database
let razorpayInstance = null;
let lastCredentialsFetch = 0;
const CREDENTIAL_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache duration

const getRazorpayInstance = async () => {
    const now = Date.now();

    // If we have a cached instance and it's still valid, return it
    if (razorpayInstance && (now - lastCredentialsFetch) < CREDENTIAL_CACHE_DURATION) {
        return razorpayInstance;
    }

    // Fetch fresh credentials from database
    const credentials = await getRazorpayCredentials();

    if (!credentials || !credentials.keyId || !credentials.keySecret) {
        console.warn('WARNING: Razorpay credentials not found in database! Payment functionality will be disabled.');

    // Create a mock razorpay object with stub methods for development
        return {
            orders: {
                create: () => Promise.reject(new Error('Razorpay not configured')),
            },
            payments: {
                fetch: () => Promise.reject(new Error('Razorpay not configured')),
            }
        };
    }

    // Create new Razorpay instance with fresh credentials
    razorpayInstance = new Razorpay({
        key_id: credentials.keyId,
        key_secret: credentials.keySecret,
    });

    lastCredentialsFetch = now;
    console.log('Razorpay instance created with credentials from database');

    return razorpayInstance;
};

// Export the dynamic getter function and wrap the API methods
const dynamicRazorpay = {
    orders: {
        create: async (options) => {
            const instance = await getRazorpayInstance();
            return instance.orders.create(options);
        },
        fetch: async (orderId) => {
            const instance = await getRazorpayInstance();
            return instance.orders.fetch(orderId);
        },
        edit: async (orderId, options) => {
            const instance = await getRazorpayInstance();
            return instance.orders.edit(orderId, options);
        },
        fetchPayments: async (orderId) => {
            const instance = await getRazorpayInstance();
            return instance.orders.fetchPayments(orderId);
        },
    },
    payments: {
        fetch: async (paymentId) => {
            const instance = await getRazorpayInstance();
            return instance.payments.fetch(paymentId);
        },
        capture: async (paymentId, amount, currency) => {
            const instance = await getRazorpayInstance();
            return instance.payments.capture(paymentId, amount, currency);
        },
        refund: async (paymentId, options) => {
            const instance = await getRazorpayInstance();
            return instance.payments.refund(paymentId, options);
        },
    },
    refunds: {
        create: async (options) => {
            const instance = await getRazorpayInstance();
            return instance.refunds.create(options);
        },
        fetch: async (refundId) => {
            const instance = await getRazorpayInstance();
            return instance.refunds.fetch(refundId);
        },
    },
};

module.exports = dynamicRazorpay;
const winston = require('winston');
const config = require('../config/env');

// Create logger instance
const logger = winston.createLogger({
    level: config.NODE_ENV === 'production' ? 'warn' : 'debug', // Reduced logging in production
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
    ),
    defaultMeta: { service: 'tanish-physio-backend' },
    transports: [
        // Write errors to console in production, all logs in development
        new winston.transports.Console({
            level: config.NODE_ENV === 'production' ? 'error' : 'debug',
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),
        // Write all logs error (and below) to error.log
        new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error'
        }),
        // Write warnings and above to combined.log in production, all logs in development
        new winston.transports.File({
            filename: 'logs/combined.log',
            level: config.NODE_ENV === 'production' ? 'warn' : 'info'
        })
    ]
});

// If we're not in production, log to the console as well
if (config.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple()
    }));
}

module.exports = logger;
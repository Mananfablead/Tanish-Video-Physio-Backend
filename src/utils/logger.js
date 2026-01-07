const winston = require('winston');
const config = require('../config/env');

// Create logger instance
const logger = winston.createLogger({
    level: config.NODE_ENV === 'production' ? 'info' : 'debug',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
    ),
    defaultMeta: { service: 'tanish-physio-backend' },
    transports: [
        // Write all logs with level 'info' and below to console
        new winston.transports.Console({
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
        // Write all logs info (and below) to combined.log
        new winston.transports.File({
            filename: 'logs/combined.log'
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
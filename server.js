const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./src/config/db');
const config = require('./src/config/env');
const routes = require('./src/routes');
const errorHandler = require('./src/middlewares/error.middleware');
const fs = require('fs');
const logger = require('./src/utils/logger');
const { initializeServices } = require('./src/utils/serviceInitializer.utils');

// Server restart trigger
const app = express();
// Security middleware
app.use(
    helmet({
        crossOriginResourcePolicy: {
            policy: "cross-origin",
        },
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                imgSrc: [
                    "'self'",
                    "data:",
                    "blob:",
                    "http://localhost:5000",
                    "http://localhost:8080",
                    "http://localhost:8081",
                    "https://tanishvideo.fableadtech.in",
                    "https://apitanishvideo.fableadtech.in",
                    "https://tanishphysiofitness.in/physio-admin"
                ],
                mediaSrc: [
                    "'self'",
                    "data:",
                    "blob:",
                    "http://localhost:5000",
                    "http://localhost:8080",
                    "http://localhost:8081",
                    "https://tanishvideo.fableadtech.in",
                    "https://tanishvideo.fableadtech.in/admin",
                    "https://apitanishvideo.fableadtech.in",
                    "https://tanishphysiofitness.in/physio-admin"
                ],
            },
        },
    })
);

// CORS configuration
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        // In development, allow specific frontend origin
        if (config.NODE_ENV === 'development') {
            const allowedOrigins = config.ALLOWED_ORIGINS;
            if (Array.isArray(allowedOrigins) && allowedOrigins.includes(origin)) {
                callback(null, true);
            } else if (typeof allowedOrigins === 'string' && allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                // Check if origin matches localhost:8080 specifically for development
                if (
                    origin === 'http://localhost:8080' ||
                    origin === 'http://localhost:8081' ||
                    origin === 'https://tanishvideo.fableadtech.in' ||
                    origin === 'https://tanishphysiofitness.in/physio-admin' ||
                    origin === 'https://tanishphysiofitness.in' ||
                    origin === 'https://tanishphysiofitness.in/physio-admin'
                ) {
                    callback(null, true);
                } else {
                    callback(null, Error('Not allowed by CORS'));
                }
            }
        } else {
            // In production, check if origin is in allowed list
            if (config.ALLOWED_ORIGINS.indexOf(origin) !== -1) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        }
    },
    credentials: true,
    optionsSuccessStatus: 200, // For legacy browser support
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization']
};

app.use(cors(corsOptions));

// Logging
if (config.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Debug: Log requests

// // WWW to non-WWW redirect (301 permanent redirect)
// // This helps with SEO by having a single canonical domain
// app.use((req, res, next) => {
//     const host = req.get('Host');

//     // Check if request is coming to www version
//     if (host && host.startsWith('www.')) {
//         const newHost = host.replace('www.', '');
//         const newUrl = `${req.protocol}://${newHost}${req.originalUrl}`;

//         console.log(`Redirecting from ${host} to ${newHost}`);

//         // Send 301 redirect
//         return res.redirect(301, newUrl);
//     }

//     // For non-www versions, or if already on correct host, continue
//     next();
// });

// // Enforce HTTPS redirect (301)
// app.use((req, res, next) => {
//     if (config.NODE_ENV === 'production' && !req.secure && req.get('X-Forwarded-Proto') !== 'https') {
//         const httpsUrl = `https://${req.get('Host')}${req.url}`;
//         console.log(`Redirecting to HTTPS: ${httpsUrl}`);
//         return res.redirect(301, httpsUrl);
//     }
//     next();
// });

// Static file serving (must be before 404 handler)
const UPLOADS_DIR = config.UPLOAD_PATH || path.join(__dirname, '..', 'public', 'uploads');
// const UPLOADS_DIR = config.UPLOAD_PATH || path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

app.use(
    '/uploads',
    express.static(UPLOADS_DIR, {
        setHeaders: (res) => {
            res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        },
    })
);

// Routes
app.use('/api', routes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler (must be last)
app.use('*', (req, res) => {
    console.log('404 Handler hit for path:', req.originalUrl);
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

const startServer = async () => {
    try {
        await connectDB();
        console.log(`Database connected successfully`);

        // Initialize external services
        await initializeServices();

        const PORT = config.PORT || 5001;

        // Create HTTP server
        const server = http.createServer(app);

        // Initialize Socket.IO server
        const io = new Server(server, {
            cors: {
                origin: config.ALLOWED_ORIGINS,
                methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
                credentials: true
            },
            transports: ['websocket', 'polling']
        });

        // Middleware to authenticate socket connections
        io.use(async (socket, next) => {
            try {
                // Extract token from handshake auth
                const token = socket.handshake.auth.token || socket.handshake.query.token;

                if (!token) {
                    console.error('❌ Socket authentication error: No token provided');
                    return next(new Error('Authentication error: No token provided'));
                }

                // Verify JWT token
                const jwt = require('jsonwebtoken');

                const decoded = jwt.verify(token, config.JWT_SECRET);

                // Validate required fields in token
                if (!decoded.userId) {
                    console.error('❌ Socket authentication error: Token missing userId');
                    console.error('Token payload:', decoded);
                    return next(new Error('Authentication error: Invalid token payload'));
                }

                if (!decoded.role) {
                    console.error('❌ Socket authentication error: Token missing role');
                    return next(new Error('Authentication error: Invalid token payload'));
                }

                // Attach user info to socket
                // For now, we'll just use the info from the token since we don't have DB lookup here
                const constructedName = `User ${decoded.userId.substring(0, 5)}`;
                
                socket.user = {
                    userId: decoded.userId.toString(), // Ensure string format
                    role: decoded.role,
                    sessionId: decoded.sessionId,
                    name: constructedName,
                    firstName: null,
                    lastName: null,
                    displayName: null,
                    email: null
                };

                console.log(`✅ Socket ${socket.id} authenticated:`, {
                    userId: socket.user.userId,
                    role: socket.user.role
                });

                next();
            } catch (error) {
                console.error('❌ Socket authentication error:', error);
                console.error('Token provided:', socket.handshake.auth.token || socket.handshake.query.token);
                next(new Error('Authentication error'));
            }
        });

        // Socket connection handler
        io.on('connection', (socket) => {
            console.log('New client connected:', socket.id);

            // Load chat, video call, notification, and admin handlers
            const setupChatHandlers = require('./src/sockets/chat.socket');
            const setupVideoCallHandlers = require('./src/sockets/videoCall.socket');
            const { setupNotificationHandlers } = require('./src/sockets/notification.socket');
            const { setupAdminHandlers } = require('./src/sockets/admin.socket');

            setupChatHandlers(io, socket);
            setupVideoCallHandlers(io, socket);
            setupNotificationHandlers(io, socket);
            setupAdminHandlers(io, socket);

            socket.on('disconnect', () => {
                console.log('Client disconnected:', socket.id);
            });
        });

        server.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Environment: ${config.NODE_ENV}`);
            console.log(`WebSocket server running on port ${PORT}`);
        });

        // Export io instance for use in controllers
        module.exports = { ...app, io };
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

module.exports = app;
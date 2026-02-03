const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const config = require('./config/env');
const routes = require('./routes');
const errorHandler = require('./middlewares/error.middleware');
const fs = require('fs');

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
          "http://localhost:5000", // backend
            "http://localhost:8080",
          "http://localhost:8081", // frontend
        ],
        mediaSrc: [
          "'self'",
          "data:",
          "blob:",
          "http://localhost:5000",
            "http://localhost:8080",
          "http://localhost:8081",
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
                if (origin === 'http://localhost:8080' || origin === 'http://localhost:8081') {
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

// // Serve static files
// Serve static files from uploads directory
// const PUBLIC_UPLOADS_DIR = path.join(__dirname, '..', 'public', 'uploads');

// if (!fs.existsSync(PUBLIC_UPLOADS_DIR)) {
//     fs.mkdirSync(PUBLIC_UPLOADS_DIR, { recursive: true });
// }

// // Serve static files from public uploads directory
// app.use(
//     '/uploads',
//     express.static(PUBLIC_UPLOADS_DIR, {
//         setHeaders: (res) => {
//             res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
//         },
//     })
// );

const UPLOADS_DIR = path.resolve('/home/u378554361/domains/apitanishvideo.fableadtech.in/uploads');

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

console.log('📂 Serving uploads from:', UPLOADS_DIR);

// Routes
app.use('/api', routes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

const startServer = async () => {
    try {
        await connectDB();
        console.log(`Database connected successfully`);

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
                const config = require('./config/env');
                
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
                socket.user = {
                    userId: decoded.userId.toString(), // Ensure string format
                    role: decoded.role,
                    sessionId: decoded.sessionId
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
            
            // Load chat and video call handlers
            const setupChatHandlers = require('./sockets/chat.socket');
            const setupVideoCallHandlers = require('./sockets/videoCall.socket');
            
            setupChatHandlers(io, socket);
            setupVideoCallHandlers(io, socket);
            
            socket.on('disconnect', () => {
                console.log('Client disconnected:', socket.id);
            });
        });

        server.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Environment: ${config.NODE_ENV}`);
            console.log(`WebSocket server running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

module.exports = app;
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
          "http://localhost:8081", // frontend
        ],
        mediaSrc: [
          "'self'",
          "data:",
          "blob:",
          "http://localhost:5000",
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
                if (origin === 'http://localhost:8080') {
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

// Rate limiting
// const limiter = rateLimit({
//     windowMs: 15 * 60 * 1000, // 15 minutes
//     max: 100 // limit each IP to 100 requests per windowMs
// });
// app.use(limiter);

// Logging
if (config.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(
  "/uploads",
  express.static(path.join(__dirname, "..", "public", "uploads"), {
    setHeaders: (res) => {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  })
);


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
                methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
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
                    return next(new Error('Authentication error: No token provided'));
                }
                
                // Verify JWT token
                const jwt = require('jsonwebtoken');
                const config = require('./config/env');
                
                const decoded = jwt.verify(token, config.JWT_SECRET);
                
                // Attach user info to socket
                socket.user = {
                    userId: decoded.userId,
                    role: decoded.role,
                    sessionId: decoded.sessionId
                };
                
                next();
            } catch (error) {
                console.error('Socket authentication error:', error);
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
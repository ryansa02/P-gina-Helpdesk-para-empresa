import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import useragent from 'express-useragent';
import statusMonitor from 'express-status-monitor';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import winston from 'winston';
import { createServer } from 'http';
import { Server } from 'socket.io';

import { authenticateRouter, requireAuthMiddleware, requireRoleMiddleware } from './auth/sso.js';
import { createDatabasePool, ensureSchema } from './database/storage.js';
import { apiRouter } from './api/tickets.js';
import { adminRouter } from './api/admin.js';
import { notificationRouter } from './api/notifications.js';
import { reportRouter } from './api/reports.js';
import { setupWebSocket } from './websocket/socket.js';
import { setupCronJobs } from './cron/jobs.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestLogger, securityMiddleware } from './middleware/security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure logging
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'csc-georgia' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

const app = express();
const server = createServer(app);
const io = new Server(server);

const port = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "ws:"]
    }
  }
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // allow 50 requests per 15 minutes, then...
  delayMs: 500 // begin adding 500ms of delay per request above 50
});

app.use(limiter);
app.use(speedLimiter);

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// User agent parsing
app.use(useragent.express());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'change_this_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  },
  name: 'csc-session'
}));

// Status monitoring
app.use(statusMonitor());

// Swagger documentation
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CSC Geórgia Contábil API',
      version: '1.0.0',
      description: 'API documentation for the CSC system'
    },
    servers: [
      {
        url: `http://localhost:${port}`,
        description: 'Development server'
      }
    ]
  },
  apis: ['./src/api/*.js']
};

const specs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Database initialization
let dbPool;
try {
  dbPool = await createDatabasePool();
  await ensureSchema(dbPool);
  logger.info('Database connection established');
} catch (error) {
  logger.error('Database connection failed:', error);
  process.exit(1);
}

// Attach database to request
app.use((req, res, next) => {
  req.db = dbPool;
  req.logger = logger;
  next();
});

// Request logging
app.use(requestLogger);

// Security middleware
app.use(securityMiddleware);

// Auth routes
app.use('/auth', authenticateRouter);

// API routes
app.use('/api/tickets', requireAuthMiddleware, apiRouter);
app.use('/api/admin', requireAuthMiddleware, requireRoleMiddleware(['ADMIN', 'SUPER_ADMIN']), adminRouter);
app.use('/api/notifications', requireAuthMiddleware, notificationRouter);
app.use('/api/reports', requireAuthMiddleware, requireRoleMiddleware(['ADMIN', 'SUPER_ADMIN']), reportRouter);

// Static files
const rootDir = path.resolve(__dirname, '..');
app.use(express.static(path.join(rootDir, 'public')));
app.use('/uploads', express.static(path.join(rootDir, 'uploads')));

// WebSocket setup
setupWebSocket(io, dbPool);

// SPA entry point
app.get('*', (req, res) => {
  res.sendFile(path.join(rootDir, 'index.html'));
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
server.listen(port, () => {
  logger.info(`🚀 CSC Server running on http://localhost:${port}`);
  logger.info(`📚 API Documentation: http://localhost:${port}/api-docs`);
  logger.info(`📊 Status Monitor: http://localhost:${port}/status`);
});

// Setup cron jobs
setupCronJobs(dbPool, logger);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

export { app, server, io };


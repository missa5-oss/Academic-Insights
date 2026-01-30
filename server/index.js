import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { initializeDatabase } from './db.js';
import projectsRouter from './routes/projects.js';
import resultsRouter from './routes/results.js';
import geminiRouter from './routes/gemini.js';
import conversationsRouter from './routes/conversations.js';
import adminRouter from './routes/admin.js';
import batchRouter from './routes/batch.js';
import { apiLoggerMiddleware } from './middleware/apiLogger.js';
import { APP_VERSION, PORT as SERVER_PORT, getCorsOrigins, RATE_LIMITS } from './config.js';
import logger from './utils/logger.js';
import { optimizeJsonResponse } from './utils/jsonOptimizer.js';

const app = express();
const PORT = SERVER_PORT;

// CORS configuration for internal network
const corsOptions = {
  origin: getCorsOrigins(),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Rate limiting for Gemini API endpoints (more restrictive due to cost)
const geminiLimiter = rateLimit({
  windowMs: RATE_LIMITS.GEMINI.windowMs,
  max: RATE_LIMITS.GEMINI.max,
  message: RATE_LIMITS.GEMINI.message,
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limiting
const apiLimiter = rateLimit({
  windowMs: RATE_LIMITS.GENERAL.windowMs,
  max: RATE_LIMITS.GENERAL.max,
  message: RATE_LIMITS.GENERAL.message,
  standardHeaders: true,
  legacyHeaders: false,
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://generativelanguage.googleapis.com", "https://vertexaisearch.cloud.google.com"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow embedding for development
}));

// Compression middleware with tuning (Sprint 7: Response compression optimization)
app.use(compression({
  // Only compress responses larger than 1KB (smaller responses add overhead)
  threshold: 1024,

  // Compression level: 6 = balanced speed/ratio (default is 6, range 0-9)
  // Lower = faster but less compression, Higher = slower but more compression
  level: 6,

  // Filter function - only compress text-based content
  filter: (req, res) => {
    // Don't compress if client doesn't support it
    if (req.headers['x-no-compression']) {
      return false;
    }

    // Use compression for JSON, text, and other compressible types
    const contentType = res.getHeader('Content-Type');
    if (!contentType) return false;

    // Compress JSON API responses (our primary use case)
    if (contentType.includes('application/json')) return true;

    // Compress text-based content
    if (contentType.includes('text/')) return true;

    // Skip images, videos, and already-compressed content
    return false;
  },

  // Memory level: 8 = balanced memory/speed (default is 8, range 1-9)
  memLevel: 8,

  // Strategy: Z_DEFAULT_STRATEGY for general purpose
  // Could use Z_FILTERED for JSON (slightly better), but default is fine
  strategy: 0 // Z_DEFAULT_STRATEGY
}));

// CORS and JSON parsing
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' })); // Increase limit for bulk operations

// Add version header to all responses
app.use((req, res, next) => {
  res.setHeader('X-App-Version', APP_VERSION);
  next();
});

// API request logging middleware (Sprint 3: Observability)
app.use('/api', apiLoggerMiddleware);

// JSON payload optimization (Sprint 7: Remove null/undefined values)
app.use('/api', optimizeJsonResponse);

// Health check (simple - for backwards compatibility)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: APP_VERSION, message: 'Academic-Insights API is running' });
});

// Routes with rate limiting
app.use('/api/batch', apiLimiter, batchRouter); // Sprint 7: Request batching
app.use('/api/projects', apiLimiter, projectsRouter);
app.use('/api/results', apiLimiter, resultsRouter);
app.use('/api/gemini', geminiLimiter, geminiRouter); // Stricter limits for AI endpoints
app.use('/api/conversations', apiLimiter, conversationsRouter); // Sprint 2: Chat persistence
app.use('/api/admin', apiLimiter, adminRouter); // Sprint 3: Admin observability

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize database and start server
async function startServer() {
  try {
    await initializeDatabase();

    app.listen(PORT, () => {
      logger.info(`Academic-Insights API Server v${APP_VERSION} running on http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

startServer();

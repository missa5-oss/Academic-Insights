import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { initializeDatabase } from './db.js';
import projectsRouter from './routes/projects.js';
import resultsRouter from './routes/results.js';
import geminiRouter from './routes/gemini.js';
import { APP_VERSION, PORT as SERVER_PORT, getCorsOrigins, RATE_LIMITS } from './config.js';
import logger from './utils/logger.js';

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

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' })); // Increase limit for bulk operations

// Add version header to all responses
app.use((req, res, next) => {
  res.setHeader('X-App-Version', APP_VERSION);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: APP_VERSION, message: 'Academic-Insights API is running' });
});

// Routes with rate limiting
app.use('/api/projects', apiLimiter, projectsRouter);
app.use('/api/results', apiLimiter, resultsRouter);
app.use('/api/gemini', geminiLimiter, geminiRouter); // Stricter limits for AI endpoints

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

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { initializeDatabase } from './db.js';
import projectsRouter from './routes/projects.js';
import resultsRouter from './routes/results.js';
import geminiRouter from './routes/gemini.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration for internal network
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Rate limiting for Gemini API endpoints (more restrictive due to cost)
const geminiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many AI requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' })); // Increase limit for bulk operations

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Academic-Insights API is running' });
});

// Routes with rate limiting
app.use('/api/projects', apiLimiter, projectsRouter);
app.use('/api/results', apiLimiter, resultsRouter);
app.use('/api/gemini', geminiLimiter, geminiRouter); // Stricter limits for AI endpoints

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize database and start server
async function startServer() {
  try {
    await initializeDatabase();

    app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════╗
║   Academic-Insights API Server         ║
║   Running on http://localhost:${PORT}   ║
╚════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

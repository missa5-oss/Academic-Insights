import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeDatabase } from './db.js';
import projectsRouter from './routes/projects.js';
import resultsRouter from './routes/results.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increase limit for bulk operations

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Academic-Insights API is running' });
});

// Routes
app.use('/api/projects', projectsRouter);
app.use('/api/results', resultsRouter);

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

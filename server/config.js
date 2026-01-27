/**
 * Server Configuration
 *
 * Centralized configuration for the Academic-Insights backend.
 * All environment-dependent values should be defined here.
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the directory of this config file (server/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from the server directory, override existing env vars
dotenv.config({ path: join(__dirname, '.env'), override: true });

// Application version - keep in sync with package.json
export const APP_VERSION = '1.4.0';

// Server port
export const PORT = process.env.PORT || 3001;

// Gemini AI Configuration
export const GEMINI_CONFIG = {
  API_KEY: process.env.GEMINI_API_KEY,
  MODEL: 'gemini-2.5-flash',
  TEMPERATURE: 1.0, // Google recommends 1.0 for grounding tools (optimal search query generation)
  MAX_TOKENS: 4096,
};

// Rate Limiting Configuration
export const RATE_LIMITS = {
  GENERAL: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // 500 requests per window
    message: 'Too many requests, please try again later.',
  },
  GEMINI: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: 'Too many AI requests, please try again later.',
  },
};

// CORS Configuration
export const DEFAULT_CORS_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

export const getCorsOrigins = () => {
  if (process.env.ALLOWED_ORIGINS) {
    return process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim());
  }
  return DEFAULT_CORS_ORIGINS;
};

// Database Configuration
export const DATABASE_URL = process.env.DATABASE_URL;

// Validation Limits
export const VALIDATION = {
  PROJECT_NAME_MAX_LENGTH: 255,
  DESCRIPTION_MAX_LENGTH: 2000,
  SCHOOL_NAME_MAX_LENGTH: 500,
  PROGRAM_NAME_MAX_LENGTH: 500,
  BULK_BATCH_SIZE: 100,
  RAW_CONTENT_MAX_LENGTH: 10000,
};

// Logging Configuration
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
export const IS_PRODUCTION = process.env.NODE_ENV === 'production';

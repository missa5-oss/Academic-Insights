/**
 * Application Configuration
 *
 * Centralized configuration for the Academic-Insights frontend.
 * All environment-dependent values should be defined here.
 */

// Application version - keep in sync with package.json
export const APP_VERSION = '1.0.0';

// Application name
export const APP_NAME = 'Academic-Insights';

// Internal product name
export const PRODUCT_NAME = 'Academica';

// API Configuration
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Pagination defaults
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_BULK_OPERATIONS = 100;

// Search debounce delay (ms)
export const SEARCH_DEBOUNCE_MS = 300;

// Confidence score thresholds
export const CONFIDENCE_SCORES = {
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
} as const;

// Extraction statuses
export const EXTRACTION_STATUS = {
  PENDING: 'Pending',
  SUCCESS: 'Success',
  NOT_FOUND: 'Not Found',
  FAILED: 'Failed',
} as const;

// Project statuses
export const PROJECT_STATUS = {
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  IDLE: 'Idle',
} as const;

// User roles
export const USER_ROLES = {
  ADMIN: 'Admin',
  ANALYST: 'Analyst',
} as const;

// Local storage keys
export const STORAGE_KEYS = {
  USER: 'user',
  THEME: 'theme',
  SORT_PREFERENCE: 'sortPreference',
} as const;

// Export formats
export const EXPORT_FORMATS = {
  CSV: 'csv',
  JSON: 'json',
} as const;

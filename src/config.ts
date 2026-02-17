/**
 * Application Configuration
 *
 * Centralized configuration for the Academic-Insights frontend.
 * All environment-dependent values should be defined here.
 */

// Application version - keep in sync with package.json
export const APP_VERSION = '1.4.0';

// Application name
export const APP_NAME = 'Academic-Insights';

// Internal product name
export const PRODUCT_NAME = 'JHU Carey Tuition Intelligence';

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
  SORT_PREFERENCE: 'academica_sort_preference',
} as const;

// Export formats
export const EXPORT_FORMATS = {
  CSV: 'csv',
  JSON: 'json',
} as const;

// UI Configuration
export const UI_CONFIG = {
  // String truncation lengths
  SCHOOL_NAME_MAX_DISPLAY: 20,
  PROGRAM_NAME_MAX_DISPLAY: 15,
  CHART_LABEL_MAX_DISPLAY: 25,

  // Toast notification durations (ms)
  TOAST_DEFAULT_DURATION: 5000,
  TOAST_ERROR_DURATION: 8000,

  // Chart configuration
  CHART_TOP_ITEMS: 10,

  // Confidence thresholds (percentage)
  CONFIDENCE_HIGH_THRESHOLD: 85,
  CONFIDENCE_MEDIUM_THRESHOLD: 60,
} as const;

// Color scheme for charts
export const CHART_COLORS = {
  PRIMARY: '#002D72',     // JHU Heritage Blue
  SECONDARY: '#68ACE5',   // JHU Spirit Blue
  SUCCESS: '#007567',     // Carey Teal
  WARNING: '#A19261',     // JHU Gold
  DANGER: '#CF4520',      // Alert Red
  ACCENT: '#D0DA48',      // Electric Lime

  // Status colors
  STATUS_SUCCESS: '#22c55e',
  STATUS_PENDING: '#f59e0b',
  STATUS_NOT_FOUND: '#ef4444',
  STATUS_FAILED: '#6b7280',

  // STEM colors
  STEM: '#3b82f6',
  NON_STEM: '#8b5cf6',

  // Confidence colors
  CONFIDENCE_HIGH: '#007567',
  CONFIDENCE_MEDIUM: '#A19261',
  CONFIDENCE_LOW: '#CF4520',
} as const;

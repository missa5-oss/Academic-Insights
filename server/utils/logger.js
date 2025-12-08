/**
 * Logger Utility
 *
 * Provides consistent logging with conditional output based on environment.
 * In production, only errors and warnings are logged.
 * In development, all logs are output.
 */

import { IS_PRODUCTION, LOG_LEVEL } from '../config.js';

// Log levels in order of severity
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = LOG_LEVELS[LOG_LEVEL] || LOG_LEVELS.info;

/**
 * Format log message with timestamp
 */
const formatMessage = (level, message, meta = {}) => {
  const timestamp = new Date().toISOString();
  const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
};

/**
 * Logger object with methods for each log level
 */
const logger = {
  /**
   * Debug level - only in development
   */
  debug: (message, meta = {}) => {
    if (!IS_PRODUCTION && currentLevel <= LOG_LEVELS.debug) {
      console.log(formatMessage('debug', message, meta));
    }
  },

  /**
   * Info level - general information
   */
  info: (message, meta = {}) => {
    if (!IS_PRODUCTION && currentLevel <= LOG_LEVELS.info) {
      console.log(formatMessage('info', message, meta));
    }
  },

  /**
   * Warning level - potential issues
   */
  warn: (message, meta = {}) => {
    if (currentLevel <= LOG_LEVELS.warn) {
      console.warn(formatMessage('warn', message, meta));
    }
  },

  /**
   * Error level - always logged
   */
  error: (message, error = null, meta = {}) => {
    if (currentLevel <= LOG_LEVELS.error) {
      const errorMeta = error
        ? { ...meta, errorMessage: error.message, stack: error.stack }
        : meta;
      console.error(formatMessage('error', message, errorMeta));
    }
  },

  /**
   * Log API request (info level)
   */
  request: (method, path, statusCode, duration) => {
    if (!IS_PRODUCTION) {
      console.log(
        formatMessage('info', `${method} ${path} ${statusCode} ${duration}ms`)
      );
    }
  },

  /**
   * Log database operation
   */
  db: (operation, table, meta = {}) => {
    if (!IS_PRODUCTION && currentLevel <= LOG_LEVELS.debug) {
      console.log(formatMessage('debug', `DB: ${operation} on ${table}`, meta));
    }
  },
};

export default logger;

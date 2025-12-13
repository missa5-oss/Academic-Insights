/**
 * API Logger Middleware
 *
 * Tracks all API requests to the database for observability and analytics.
 * Sprint 3: Admin Observability & Monitoring (US3.1)
 */

import { sql } from '../db.js';
import logger from '../utils/logger.js';

/**
 * Generate unique ID for log entries
 */
const generateLogId = () => {
  return `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Middleware to log API requests to database
 * Captures: method, path, status code, duration, IP, user agent
 */
export const apiLoggerMiddleware = (req, res, next) => {
  const startTime = Date.now();

  // Store original end function
  const originalEnd = res.end;

  // Override end function to capture response
  res.end = function(chunk, encoding) {
    // Calculate duration
    const duration = Date.now() - startTime;

    // Get request details
    const logEntry = {
      id: generateLogId(),
      method: req.method,
      path: req.originalUrl || req.url,
      statusCode: res.statusCode,
      duration,
      ipAddress: req.ip || req.connection?.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      // Only log body for non-GET requests (avoid logging sensitive data)
      requestBody: req.method !== 'GET' ? sanitizeBody(req.body) : null,
      errorMessage: res.statusCode >= 400 ? res.statusMessage : null
    };

    // Log to console
    logger.request(logEntry.method, logEntry.path, logEntry.statusCode, logEntry.duration);

    // Async save to database (non-blocking)
    saveLogEntry(logEntry).catch(err => {
      logger.warn('Failed to save API log', { error: err.message });
    });

    // Call original end
    return originalEnd.call(this, chunk, encoding);
  };

  next();
};

/**
 * Sanitize request body to remove sensitive data
 */
function sanitizeBody(body) {
  if (!body || typeof body !== 'object') return null;

  // Create shallow copy
  const sanitized = { ...body };

  // Remove potentially sensitive fields
  const sensitiveFields = ['password', 'token', 'apiKey', 'api_key', 'secret', 'credentials'];
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });

  // Truncate large fields (like contextData for chat)
  if (sanitized.contextData && Array.isArray(sanitized.contextData)) {
    sanitized.contextData = `[Array of ${sanitized.contextData.length} items]`;
  }
  if (sanitized.data && Array.isArray(sanitized.data)) {
    sanitized.data = `[Array of ${sanitized.data.length} items]`;
  }
  if (sanitized.history && Array.isArray(sanitized.history)) {
    sanitized.history = `[Array of ${sanitized.history.length} items]`;
  }

  return sanitized;
}

/**
 * Save log entry to database
 */
async function saveLogEntry(entry) {
  try {
    await sql`
      INSERT INTO api_logs (id, method, path, status_code, duration_ms, ip_address, user_agent, request_body, error_message)
      VALUES (
        ${entry.id},
        ${entry.method},
        ${entry.path},
        ${entry.statusCode},
        ${entry.duration},
        ${entry.ipAddress},
        ${entry.userAgent},
        ${entry.requestBody ? JSON.stringify(entry.requestBody) : null},
        ${entry.errorMessage}
      )
    `;
  } catch (error) {
    // Log but don't throw - logging should never break the API
    logger.debug('API log save failed', { error: error.message });
  }
}

/**
 * Get API analytics for admin dashboard
 */
export async function getApiAnalytics(days = 7) {
  try {
    // Get request counts by endpoint
    const endpointStats = await sql`
      SELECT
        path,
        COUNT(*) as request_count,
        AVG(duration_ms)::INTEGER as avg_duration,
        COUNT(*) FILTER (WHERE status_code >= 400) as error_count
      FROM api_logs
      WHERE created_at > NOW() - INTERVAL '${days} days'
      GROUP BY path
      ORDER BY request_count DESC
      LIMIT 20
    `;

    // Get daily request counts
    const dailyStats = await sql`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as total_requests,
        COUNT(*) FILTER (WHERE status_code >= 400) as errors,
        AVG(duration_ms)::INTEGER as avg_duration
      FROM api_logs
      WHERE created_at > NOW() - INTERVAL '${days} days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;

    // Get status code distribution
    const statusStats = await sql`
      SELECT
        CASE
          WHEN status_code >= 500 THEN '5xx'
          WHEN status_code >= 400 THEN '4xx'
          WHEN status_code >= 300 THEN '3xx'
          WHEN status_code >= 200 THEN '2xx'
          ELSE 'other'
        END as status_group,
        COUNT(*) as count
      FROM api_logs
      WHERE created_at > NOW() - INTERVAL '${days} days'
      GROUP BY status_group
      ORDER BY status_group
    `;

    // Get recent errors
    const recentErrors = await sql`
      SELECT id, method, path, status_code, duration_ms, error_message, created_at
      FROM api_logs
      WHERE status_code >= 400
        AND created_at > NOW() - INTERVAL '${days} days'
      ORDER BY created_at DESC
      LIMIT 10
    `;

    return {
      endpointStats,
      dailyStats,
      statusStats,
      recentErrors,
      period: `${days} days`
    };
  } catch (error) {
    logger.error('Failed to get API analytics', error);
    throw error;
  }
}

export default apiLoggerMiddleware;

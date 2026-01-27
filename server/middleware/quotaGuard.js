/**
 * Quota Guard Middleware
 * Blocks requests when Google Search quota is exceeded or critically low
 * Phase 3: Quota Management
 */

import { getQuotaStatus } from '../utils/quotaTracker.js';
import logger from '../utils/logger.js';

const CRITICAL_THRESHOLD = 0.98; // 98% - leave 2% buffer for critical operations

/**
 * Middleware to check quota before expensive operations
 * Blocks requests if quota exceeded or critically low
 */
export async function quotaGuard(req, res, next) {
  try {
    const status = await getQuotaStatus();

    if (!status) {
      // Quota tracking unavailable - allow request but log warning
      logger.warn('Quota tracking unavailable, proceeding with request');
      return next();
    }

    // Block if exceeded
    if (status.isExceeded) {
      logger.error('Request blocked: Google Search quota exceeded', {
        used: status.used,
        limit: status.limit
      });

      return res.status(429).json({
        error: 'Daily Google Search quota exceeded',
        message: 'API quota limit reached. Service will resume tomorrow at midnight UTC.',
        quotaStatus: {
          used: status.used,
          limit: status.limit,
          resetTime: 'Tomorrow at 00:00 UTC'
        }
      });
    }

    // Warn if critically low (but still allow)
    if (status.usagePercent >= CRITICAL_THRESHOLD * 100) {
      logger.warn('Request allowed but quota critically low', {
        remaining: status.remaining,
        percent: status.usagePercent.toFixed(1)
      });

      // Add warning headers for monitoring
      res.set('X-Quota-Warning', 'Google Search quota critically low');
      res.set('X-Quota-Remaining', status.remaining.toString());
      res.set('X-Quota-Percent', status.usagePercent.toFixed(1));
    }

    next();
  } catch (error) {
    logger.error('Quota guard middleware error', error);
    // Don't block on errors - allow request to proceed
    next();
  }
}

export default quotaGuard;

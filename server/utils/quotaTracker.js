/**
 * Google Search Quota Tracker
 * Tracks daily Google Search grounding usage against 1M/day limit
 * Phase 3: Quota Management
 */

import { sql } from '../db.js';
import logger from './logger.js';

const DAILY_QUOTA_LIMIT = 1_000_000; // 1 million queries per day
const WARNING_THRESHOLD = 0.80; // 80% usage - warn
const CRITICAL_THRESHOLD = 0.95; // 95% usage - critical alert

/**
 * Increment daily query count
 * @returns {Promise<Object>} Current quota status
 */
export async function incrementQuotaUsage() {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const quotaId = `quota-${today}`;

    // Upsert: increment if exists, create if not
    await sql`
      INSERT INTO google_search_quota_tracking (id, date, queries_used, quota_limit)
      VALUES (${quotaId}, ${today}, 1, ${DAILY_QUOTA_LIMIT})
      ON CONFLICT (date) DO UPDATE
      SET queries_used = google_search_quota_tracking.queries_used + 1,
          last_query_at = CURRENT_TIMESTAMP
    `;

    // Get current status
    const [status] = await sql`
      SELECT queries_used, quota_limit
      FROM google_search_quota_tracking
      WHERE date = ${today}
    `;

    const usagePercent = (status.queries_used / status.quota_limit) * 100;

    // Log warnings at thresholds
    if (usagePercent >= CRITICAL_THRESHOLD * 100) {
      logger.error(`CRITICAL: Google Search quota at ${usagePercent.toFixed(1)}%`, {
        used: status.queries_used,
        limit: status.quota_limit,
        remaining: status.quota_limit - status.queries_used
      });
    } else if (usagePercent >= WARNING_THRESHOLD * 100) {
      logger.warn(`WARNING: Google Search quota at ${usagePercent.toFixed(1)}%`, {
        used: status.queries_used,
        limit: status.quota_limit,
        remaining: status.quota_limit - status.queries_used
      });
    }

    return {
      used: status.queries_used,
      limit: status.quota_limit,
      remaining: status.quota_limit - status.queries_used,
      usagePercent: usagePercent
    };
  } catch (error) {
    logger.error('Failed to track quota usage', error);
    return null;
  }
}

/**
 * Get current daily quota status
 * @returns {Promise<Object>} Quota status
 */
export async function getQuotaStatus() {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [status] = await sql`
      SELECT queries_used, quota_limit, last_query_at
      FROM google_search_quota_tracking
      WHERE date = ${today}
    `;

    if (!status) {
      // No usage today yet
      return {
        used: 0,
        limit: DAILY_QUOTA_LIMIT,
        remaining: DAILY_QUOTA_LIMIT,
        usagePercent: 0,
        isExceeded: false,
        lastQueryAt: null
      };
    }

    const remaining = status.quota_limit - status.queries_used;
    const usagePercent = (status.queries_used / status.quota_limit) * 100;

    return {
      used: status.queries_used,
      limit: status.quota_limit,
      remaining: Math.max(0, remaining),
      usagePercent: usagePercent,
      isExceeded: remaining <= 0,
      lastQueryAt: status.last_query_at
    };
  } catch (error) {
    logger.error('Failed to get quota status', error);
    return null;
  }
}

/**
 * Check if quota is available for new requests
 * @param {number} count - Number of queries needed (default: 1)
 * @returns {Promise<boolean>} True if quota available
 */
export async function isQuotaAvailable(count = 1) {
  const status = await getQuotaStatus();
  return status && !status.isExceeded && status.remaining >= count;
}

/**
 * Get quota history for the last N days
 * @param {number} days - Number of days to retrieve (default: 30)
 * @returns {Promise<Array>} Quota history
 */
export async function getQuotaHistory(days = 30) {
  try {
    const history = await sql`
      SELECT
        date::text as date,
        queries_used,
        quota_limit,
        ROUND((queries_used::float / quota_limit::float) * 100, 2) as usage_percent,
        last_query_at
      FROM google_search_quota_tracking
      WHERE date >= CURRENT_DATE - INTERVAL '${days} days'
      ORDER BY date DESC
    `;

    return history;
  } catch (error) {
    logger.error('Failed to get quota history', error);
    return [];
  }
}

/**
 * Reset daily quota (for testing purposes)
 * WARNING: Only use in development/testing
 * @param {string} date - Date to reset (YYYY-MM-DD, default: today)
 */
export async function resetQuota(date = null) {
  try {
    const targetDate = date || new Date().toISOString().split('T')[0];

    await sql`
      DELETE FROM google_search_quota_tracking
      WHERE date = ${targetDate}
    `;

    logger.info(`Quota reset for date: ${targetDate}`);
    return true;
  } catch (error) {
    logger.error('Failed to reset quota', error);
    return false;
  }
}

export default {
  incrementQuotaUsage,
  getQuotaStatus,
  isQuotaAvailable,
  getQuotaHistory,
  resetQuota
};

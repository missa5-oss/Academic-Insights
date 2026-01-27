/**
 * Materialized View Utilities
 * 
 * Utilities for refreshing materialized views used for performance optimization.
 * 
 * Sprint 5: Performance Optimization
 */

import { sql } from '../db.js';
import logger from './logger.js';

/**
 * Refresh the project_analytics materialized view
 * Uses CONCURRENTLY to avoid locking the view during refresh
 * @returns {Promise<void>}
 */
export async function refreshProjectAnalytics() {
  try {
    await sql`REFRESH MATERIALIZED VIEW CONCURRENTLY project_analytics`;
    logger.debug('Materialized view project_analytics refreshed');
  } catch (error) {
    // If CONCURRENTLY fails (e.g., no unique index), fall back to regular refresh
    logger.warn('Concurrent refresh failed, using regular refresh', { error: error.message });
    try {
      await sql`REFRESH MATERIALIZED VIEW project_analytics`;
      logger.debug('Materialized view project_analytics refreshed (non-concurrent)');
    } catch (fallbackError) {
      logger.error('Failed to refresh materialized view project_analytics', fallbackError);
      throw fallbackError;
    }
  }
}

/**
 * Refresh materialized view for a specific project (partial refresh)
 * Note: PostgreSQL doesn't support partial refresh, so we refresh the entire view
 * For better performance, consider using incremental updates or scheduled full refreshes
 * @param {string} projectId - Project ID (currently not used, but kept for future optimization)
 * @returns {Promise<void>}
 */
export async function refreshProjectAnalyticsForProject(projectId) {
  // For now, refresh the entire view
  // Future optimization: Could implement incremental updates or batch refreshes
  await refreshProjectAnalytics();
}


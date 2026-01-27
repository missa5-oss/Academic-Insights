/**
 * Query Performance Monitoring
 * 
 * Tracks database query performance and identifies slow queries.
 * 
 * Sprint 5: Performance Optimization
 */

import { sql as originalSql } from '../db.js';
import logger from './logger.js';

// Configuration
const SLOW_QUERY_THRESHOLD_MS = 100; // Log queries slower than 100ms
const MAX_LOG_ENTRIES = 1000; // Keep last 1000 slow queries in memory

/**
 * In-memory store for slow queries (last N entries)
 * @type {Array<{query: string, duration: number, timestamp: Date, params?: any}>}
 */
const slowQueries = [];

/**
 * Query performance statistics
 */
const stats = {
  totalQueries: 0,
  slowQueries: 0,
  totalDuration: 0,
  minDuration: Infinity,
  maxDuration: 0,
  averageDuration: 0,
  queriesByTable: new Map(),
};

/**
 * Track a query execution
 * @param {string} queryText - Query text (sanitized)
 * @param {number} duration - Query duration in milliseconds
 * @param {any} params - Query parameters (optional, for debugging)
 */
export function trackQuery(queryText, duration, params = null) {
  stats.totalQueries++;
  stats.totalDuration += duration;
  stats.minDuration = Math.min(stats.minDuration, duration);
  stats.maxDuration = Math.max(stats.maxDuration, duration);
  stats.averageDuration = stats.totalDuration / stats.totalQueries;

  // Extract table name from query (simple regex)
  const tableMatch = queryText.match(/FROM\s+(\w+)|INTO\s+(\w+)|UPDATE\s+(\w+)/i);
  if (tableMatch) {
    const tableName = tableMatch[1] || tableMatch[2] || tableMatch[3];
    const tableStats = stats.queriesByTable.get(tableName) || {
      count: 0,
      totalDuration: 0,
      slowQueries: 0,
    };
    tableStats.count++;
    tableStats.totalDuration += duration;
    if (duration > SLOW_QUERY_THRESHOLD_MS) {
      tableStats.slowQueries++;
    }
    stats.queriesByTable.set(tableName, tableStats);
  }

  // Log slow queries
  if (duration > SLOW_QUERY_THRESHOLD_MS) {
    stats.slowQueries++;
    
    const slowQuery = {
      query: queryText.substring(0, 500), // Limit query text length
      duration,
      timestamp: new Date(),
      params: params ? JSON.stringify(params).substring(0, 200) : null, // Limit params length
    };

    slowQueries.push(slowQuery);
    
    // Keep only last N entries
    if (slowQueries.length > MAX_LOG_ENTRIES) {
      slowQueries.shift();
    }

    logger.warn('Slow query detected', {
      duration: `${duration}ms`,
      query: queryText.substring(0, 200),
      threshold: `${SLOW_QUERY_THRESHOLD_MS}ms`,
    });
  }
}

/**
 * Get query performance statistics
 * @returns {Object} Performance stats
 */
export function getQueryStats() {
  const tableStats = Array.from(stats.queriesByTable.entries()).map(([table, data]) => ({
    table,
    count: data.count,
    averageDuration: data.count > 0 ? Math.round(data.totalDuration / data.count) : 0,
    slowQueries: data.slowQueries,
  })).sort((a, b) => b.count - a.count);

  return {
    totalQueries: stats.totalQueries,
    slowQueries: stats.slowQueries,
    slowQueryPercentage: stats.totalQueries > 0 
      ? Math.round((stats.slowQueries / stats.totalQueries) * 100 * 100) / 100 
      : 0,
    averageDuration: Math.round(stats.averageDuration),
    minDuration: stats.minDuration === Infinity ? 0 : Math.round(stats.minDuration),
    maxDuration: Math.round(stats.maxDuration),
    slowQueryThreshold: SLOW_QUERY_THRESHOLD_MS,
    queriesByTable: tableStats,
  };
}

/**
 * Get recent slow queries
 * @param {number} limit - Maximum number of queries to return
 * @returns {Array} Array of slow query entries
 */
export function getSlowQueries(limit = 50) {
  return slowQueries
    .slice(-limit)
    .reverse() // Most recent first
    .map(q => ({
      ...q,
      timestamp: q.timestamp.toISOString(),
    }));
}

/**
 * Reset query statistics
 */
export function resetStats() {
  stats.totalQueries = 0;
  stats.slowQueries = 0;
  stats.totalDuration = 0;
  stats.minDuration = Infinity;
  stats.maxDuration = 0;
  stats.averageDuration = 0;
  stats.queriesByTable.clear();
  slowQueries.length = 0;
  logger.info('Query performance statistics reset');
}

/**
 * Wrapper for sql function that tracks performance
 * This wraps the original sql function to automatically track query performance
 * 
 * Note: This is a simplified wrapper. For production, consider using a more
 * sophisticated query interceptor or database driver hooks.
 */
export function createTrackedSql(originalSqlFn) {
  return async function trackedSql(strings, ...values) {
    const startTime = Date.now();
    let queryText = '';
    
    try {
      // Reconstruct query text for logging (simplified)
      if (typeof strings === 'string') {
        queryText = strings;
      } else if (Array.isArray(strings)) {
        queryText = strings.join('?'); // Simplified - actual query may differ
      }

      // Execute the query
      const result = await originalSqlFn(strings, ...values);
      
      const duration = Date.now() - startTime;
      trackQuery(queryText || 'Unknown query', duration, values.length > 0 ? values : null);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      trackQuery(queryText || 'Unknown query (error)', duration, { error: error.message });
      throw error;
    }
  };
}


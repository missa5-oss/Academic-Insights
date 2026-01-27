/**
 * In-Memory Cache Utility
 * 
 * Provides simple in-memory caching for API responses.
 * Used for caching analytics and other expensive queries.
 * 
 * Sprint 5: Performance Optimization
 */

import logger from './logger.js';

/**
 * Cache entry structure
 * @typedef {Object} CacheEntry
 * @property {any} data - Cached data
 * @property {number} expiresAt - Timestamp when cache expires
 */

class SimpleCache {
  constructor() {
    /** @type {Map<string, CacheEntry>} */
    this.cache = new Map();
    
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Get cached value if it exists and hasn't expired
   * @param {string} key - Cache key
   * @returns {any|null} Cached value or null if not found/expired
   */
  get(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set a value in cache with TTL
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttlMs - Time to live in milliseconds (default: 5 minutes)
   */
  set(key, value, ttlMs = 5 * 60 * 1000) {
    const expiresAt = Date.now() + ttlMs;
    this.cache.set(key, { data: value, expiresAt });
  }

  /**
   * Delete a specific cache entry
   * @param {string} key - Cache key
   */
  delete(key) {
    this.cache.delete(key);
  }

  /**
   * Delete all cache entries matching a pattern (prefix)
   * @param {string} pattern - Prefix pattern to match
   */
  deleteByPattern(pattern) {
    let deletedCount = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(pattern)) {
        this.cache.delete(key);
        deletedCount++;
      }
    }
    logger.debug(`Cache: Deleted ${deletedCount} entries matching pattern "${pattern}"`);
    return deletedCount;
  }

  /**
   * Clear all cache entries
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    logger.info(`Cache: Cleared ${size} entries`);
  }

  /**
   * Remove expired entries
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`Cache: Cleaned up ${cleaned} expired entries`);
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getStats() {
    const now = Date.now();
    let expired = 0;
    
    for (const entry of this.cache.values()) {
      if (now > entry.expiresAt) {
        expired++;
      }
    }

    return {
      totalEntries: this.cache.size,
      expiredEntries: expired,
      activeEntries: this.cache.size - expired,
    };
  }
}

// Export singleton instance
export const cache = new SimpleCache();

/**
 * Generate cache key for analytics endpoint
 * @param {string} projectId - Project ID
 * @param {string} dataHash - Optional hash of data to detect changes
 * @returns {string} Cache key
 */
export function getAnalyticsCacheKey(projectId, dataHash = null) {
  if (dataHash) {
    return `analytics:${projectId}:${dataHash}`;
  }
  return `analytics:${projectId}`;
}

/**
 * Invalidate analytics cache for a project
 * @param {string} projectId - Project ID
 */
export function invalidateAnalyticsCache(projectId) {
  const pattern = `analytics:${projectId}`;
  return cache.deleteByPattern(pattern);
}

/**
 * Middleware to add cache headers to response
 * @param {Object} res - Express response object
 * @param {number} maxAge - Cache max age in seconds
 */
export function setCacheHeaders(res, maxAge = 300) {
  res.set('Cache-Control', `public, max-age=${maxAge}`);
  res.set('X-Cache-Status', 'MISS'); // Will be updated by cache middleware
}


/**
 * JSON payload optimization utility (Sprint 7)
 * Reduces response sizes by removing null/undefined values and compacting data
 *
 * Benefits:
 * - Smaller payloads = faster network transfer
 * - Reduced bandwidth costs
 * - Better mobile performance
 * - Lower memory usage on client
 */

/**
 * Remove null and undefined values from an object
 * @param {Object} obj - Object to clean
 * @param {boolean} deep - Recursively clean nested objects
 * @returns {Object} Object with null/undefined values removed
 */
export function removeNullValues(obj, deep = true) {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => deep && typeof item === 'object' ? removeNullValues(item, deep) : item);
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip null and undefined values
    if (value === null || value === undefined) {
      continue;
    }

    // Recursively clean nested objects if deep=true
    if (deep && typeof value === 'object' && !Array.isArray(value)) {
      const cleanedNested = removeNullValues(value, deep);
      // Only include if nested object has properties
      if (Object.keys(cleanedNested).length > 0) {
        cleaned[key] = cleanedNested;
      }
    } else if (Array.isArray(value)) {
      // Clean arrays
      cleaned[key] = value.map(item =>
        typeof item === 'object' ? removeNullValues(item, deep) : item
      );
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

/**
 * Express middleware to optimize JSON responses
 * Automatically removes null/undefined values before sending
 *
 * Usage:
 * ```js
 * app.use(optimizeJsonResponse);
 * ```
 */
export function optimizeJsonResponse(req, res, next) {
  const originalJson = res.json.bind(res);

  res.json = function(data) {
    // Clean null/undefined values
    const optimized = removeNullValues(data, true);

    // Use compact JSON (no extra whitespace)
    // Express does this by default, but we ensure it here
    originalJson(optimized);
  };

  next();
}

/**
 * Calculate payload size reduction
 * @param {any} original - Original data
 * @param {any} optimized - Optimized data
 * @returns {Object} Size comparison { original, optimized, reduction, reductionPercent }
 */
export function calculateSizeReduction(original, optimized) {
  const originalSize = JSON.stringify(original).length;
  const optimizedSize = JSON.stringify(optimized).length;
  const reduction = originalSize - optimizedSize;
  const reductionPercent = Math.round((reduction / originalSize) * 100);

  return {
    original: originalSize,
    optimized: optimizedSize,
    reduction,
    reductionPercent
  };
}

/**
 * Remove empty strings in addition to null/undefined
 * @param {Object} obj - Object to clean
 * @returns {Object} Object with empty values removed
 */
export function removeEmptyValues(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj
      .map(item => typeof item === 'object' ? removeEmptyValues(item) : item)
      .filter(item => item !== null && item !== undefined && item !== '');
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip null, undefined, and empty strings
    if (value === null || value === undefined || value === '') {
      continue;
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
      const cleanedNested = removeEmptyValues(value);
      if (Object.keys(cleanedNested).length > 0) {
        cleaned[key] = cleanedNested;
      }
    } else if (Array.isArray(value)) {
      const cleanedArray = value
        .map(item => typeof item === 'object' ? removeEmptyValues(item) : item)
        .filter(item => item !== null && item !== undefined && item !== '');

      if (cleanedArray.length > 0) {
        cleaned[key] = cleanedArray;
      }
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

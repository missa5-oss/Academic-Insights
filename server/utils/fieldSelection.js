/**
 * Field selection utility for API responses (Sprint 7)
 * Allows clients to request only specific fields to reduce payload size
 *
 * Example: GET /api/results?fields=id,school_name,tuition_amount
 */

/**
 * Parse fields query parameter into array
 * @param {string|undefined} fieldsParam - Comma-separated field names
 * @returns {string[]|null} Array of field names or null (all fields)
 */
export function parseFields(fieldsParam) {
  if (!fieldsParam || typeof fieldsParam !== 'string') {
    return null;
  }

  return fieldsParam
    .split(',')
    .map(f => f.trim())
    .filter(f => f.length > 0);
}

/**
 * Project only selected fields from an object
 * @param {Object} obj - Source object
 * @param {string[]|null} fields - Fields to include (null = all fields)
 * @returns {Object} Object with only selected fields
 */
export function projectFields(obj, fields) {
  if (!fields || fields.length === 0) {
    return obj;
  }

  const result = {};
  for (const field of fields) {
    if (obj.hasOwnProperty(field)) {
      result[field] = obj[field];
    }
  }
  return result;
}

/**
 * Project fields for an array of objects
 * @param {Array} arr - Array of objects
 * @param {string[]|null} fields - Fields to include
 * @returns {Array} Array with projected objects
 */
export function projectFieldsArray(arr, fields) {
  if (!fields || fields.length === 0) {
    return arr;
  }

  return arr.map(obj => projectFields(obj, fields));
}

/**
 * Build SQL SELECT clause from fields array
 * @param {string[]|null} fields - Fields to select
 * @param {string} tableName - Table name for prefixing
 * @returns {string} SQL SELECT clause
 */
export function buildSelectClause(fields, tableName = '') {
  if (!fields || fields.length === 0) {
    return '*';
  }

  const prefix = tableName ? `${tableName}.` : '';
  return fields.map(f => `${prefix}${f}`).join(', ');
}

/**
 * Validate field names against allowed fields
 * @param {string[]} fields - Requested fields
 * @param {string[]} allowedFields - Allowed field names
 * @returns {boolean} True if all fields are allowed
 */
export function validateFields(fields, allowedFields) {
  if (!fields || fields.length === 0) {
    return true;
  }

  return fields.every(f => allowedFields.includes(f));
}

/**
 * Get payload size reduction percentage
 * @param {number} originalSize - Original payload size
 * @param {number} reducedSize - Reduced payload size
 * @returns {number} Percentage reduction
 */
export function calculateReduction(originalSize, reducedSize) {
  if (originalSize === 0) return 0;
  return Math.round(((originalSize - reducedSize) / originalSize) * 100);
}

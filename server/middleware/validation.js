/**
 * Input Validation Middleware
 *
 * Provides validation for API endpoints to ensure data integrity
 * and prevent malformed requests.
 */

import { VALIDATION } from '../config.js';

/**
 * Validates a string field against max length
 */
const validateStringLength = (value, fieldName, maxLength) => {
  if (value && typeof value === 'string' && value.length > maxLength) {
    return `${fieldName} must be ${maxLength} characters or less`;
  }
  return null;
};

/**
 * Validates required string field
 */
const validateRequired = (value, fieldName) => {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    return `${fieldName} is required`;
  }
  return null;
};

/**
 * Standard error response format
 */
const errorResponse = (res, code, message, details = {}) => {
  return res.status(400).json({
    error: true,
    code,
    message,
    details,
  });
};

/**
 * Validate project creation/update
 */
export const validateProject = (req, res, next) => {
  const { name, description } = req.body;
  const errors = [];

  // Required fields for POST
  if (req.method === 'POST') {
    const nameRequired = validateRequired(name, 'Project name');
    if (nameRequired) errors.push(nameRequired);
    // Description is optional
  }

  // Length validation
  const nameLength = validateStringLength(name, 'Project name', VALIDATION.PROJECT_NAME_MAX_LENGTH);
  if (nameLength) errors.push(nameLength);

  const descLength = validateStringLength(description, 'Description', VALIDATION.DESCRIPTION_MAX_LENGTH);
  if (descLength) errors.push(descLength);

  if (errors.length > 0) {
    return errorResponse(res, 'VALIDATION_ERROR', errors[0], { errors });
  }

  next();
};

/**
 * Validate single result creation/update
 */
export const validateResult = (req, res, next) => {
  const { school_name, program_name, project_id } = req.body;
  const errors = [];

  // Required fields for POST
  if (req.method === 'POST') {
    const projectRequired = validateRequired(project_id, 'Project ID');
    if (projectRequired) errors.push(projectRequired);

    const schoolRequired = validateRequired(school_name, 'School name');
    if (schoolRequired) errors.push(schoolRequired);

    const programRequired = validateRequired(program_name, 'Program name');
    if (programRequired) errors.push(programRequired);
  }

  // Length validation
  const schoolLength = validateStringLength(school_name, 'School name', VALIDATION.SCHOOL_NAME_MAX_LENGTH);
  if (schoolLength) errors.push(schoolLength);

  const programLength = validateStringLength(program_name, 'Program name', VALIDATION.PROGRAM_NAME_MAX_LENGTH);
  if (programLength) errors.push(programLength);

  if (errors.length > 0) {
    return errorResponse(res, 'VALIDATION_ERROR', errors[0], { errors });
  }

  next();
};

/**
 * Validate bulk results creation
 */
export const validateBulkResults = (req, res, next) => {
  const { results } = req.body;
  const errors = [];

  if (!Array.isArray(results)) {
    return errorResponse(res, 'VALIDATION_ERROR', 'Results must be an array');
  }

  if (results.length === 0) {
    return errorResponse(res, 'VALIDATION_ERROR', 'Results array cannot be empty');
  }

  if (results.length > VALIDATION.BULK_BATCH_SIZE) {
    return errorResponse(
      res,
      'BATCH_SIZE_EXCEEDED',
      `Batch size exceeds maximum of ${VALIDATION.BULK_BATCH_SIZE}. Please split into smaller batches.`,
      { maxBatchSize: VALIDATION.BULK_BATCH_SIZE, receivedSize: results.length }
    );
  }

  // Validate each result in the batch
  for (let i = 0; i < results.length; i++) {
    const result = results[i];

    if (!result.school_name || !result.program_name) {
      errors.push(`Result at index ${i}: school_name and program_name are required`);
      continue;
    }

    const schoolLength = validateStringLength(
      result.school_name,
      `Result ${i} school_name`,
      VALIDATION.SCHOOL_NAME_MAX_LENGTH
    );
    if (schoolLength) errors.push(schoolLength);

    const programLength = validateStringLength(
      result.program_name,
      `Result ${i} program_name`,
      VALIDATION.PROGRAM_NAME_MAX_LENGTH
    );
    if (programLength) errors.push(programLength);
  }

  if (errors.length > 0) {
    return errorResponse(res, 'VALIDATION_ERROR', errors[0], { errors: errors.slice(0, 10) }); // Limit to first 10 errors
  }

  next();
};

/**
 * Validate bulk delete request
 */
export const validateBulkDelete = (req, res, next) => {
  const { ids } = req.body;

  if (!Array.isArray(ids)) {
    return errorResponse(res, 'VALIDATION_ERROR', 'IDs must be an array');
  }

  if (ids.length === 0) {
    return errorResponse(res, 'VALIDATION_ERROR', 'IDs array cannot be empty');
  }

  if (ids.length > VALIDATION.BULK_BATCH_SIZE) {
    return errorResponse(
      res,
      'BATCH_SIZE_EXCEEDED',
      `Cannot delete more than ${VALIDATION.BULK_BATCH_SIZE} items at once`,
      { maxBatchSize: VALIDATION.BULK_BATCH_SIZE, receivedSize: ids.length }
    );
  }

  next();
};

/**
 * Validate Gemini extraction request
 */
export const validateExtraction = (req, res, next) => {
  const { school, program } = req.body;
  const errors = [];

  const schoolRequired = validateRequired(school, 'School name');
  if (schoolRequired) errors.push(schoolRequired);

  const programRequired = validateRequired(program, 'Program name');
  if (programRequired) errors.push(programRequired);

  const schoolLength = validateStringLength(school, 'School name', VALIDATION.SCHOOL_NAME_MAX_LENGTH);
  if (schoolLength) errors.push(schoolLength);

  const programLength = validateStringLength(program, 'Program name', VALIDATION.PROGRAM_NAME_MAX_LENGTH);
  if (programLength) errors.push(programLength);

  if (errors.length > 0) {
    return errorResponse(res, 'VALIDATION_ERROR', errors[0], { errors });
  }

  next();
};

/**
 * Validate chat request
 */
export const validateChat = (req, res, next) => {
  const { message, contextData, history } = req.body;

  if (!message || typeof message !== 'string' || message.trim() === '') {
    return errorResponse(res, 'VALIDATION_ERROR', 'Message is required');
  }

  if (message.length > 10000) {
    return errorResponse(res, 'VALIDATION_ERROR', 'Message must be 10000 characters or less');
  }

  if (contextData && !Array.isArray(contextData)) {
    return errorResponse(res, 'VALIDATION_ERROR', 'ContextData must be an array');
  }

  if (history && !Array.isArray(history)) {
    return errorResponse(res, 'VALIDATION_ERROR', 'History must be an array');
  }

  next();
};

/**
 * Validate summary request
 * Enhanced validation to prevent prompt injection and DoS attacks (Sprint 8 audit)
 */
export const validateSummary = (req, res, next) => {
  const { data, projectId, forceRefresh } = req.body;

  // Basic type validation
  if (!Array.isArray(data)) {
    return errorResponse(res, 'VALIDATION_ERROR', 'Data must be an array');
  }

  if (data.length === 0) {
    return errorResponse(res, 'VALIDATION_ERROR', 'Data array cannot be empty');
  }

  // Enforce maximum array size to prevent DoS
  if (data.length > VALIDATION.SUMMARY_MAX_ITEMS) {
    return errorResponse(
      res,
      'BATCH_SIZE_EXCEEDED',
      `Data array exceeds maximum of ${VALIDATION.SUMMARY_MAX_ITEMS} items`,
      { maxItems: VALIDATION.SUMMARY_MAX_ITEMS, receivedItems: data.length }
    );
  }

  // Validate projectId if provided
  if (projectId !== undefined && projectId !== null) {
    if (typeof projectId !== 'string' || projectId.length > 100) {
      return errorResponse(res, 'VALIDATION_ERROR', 'Invalid projectId format');
    }
  }

  // Validate forceRefresh if provided
  if (forceRefresh !== undefined && typeof forceRefresh !== 'boolean') {
    return errorResponse(res, 'VALIDATION_ERROR', 'forceRefresh must be a boolean');
  }

  // Validate each item in the data array
  const errors = [];
  const allowedKeys = new Set([
    'id', 'school_name', 'program_name', 'tuition_amount', 'cost_per_credit',
    'total_credits', 'program_length_months', 'program_length', 'academic_year', 'tuition_period',
    'is_stem', 'status', 'confidence_score', 'remarks', 'source_url',
    'raw_content', 'validated_sources', 'verification_data', 'verification_status',
    'location_data', 'stated_tuition', 'calculated_total_cost', 'additional_fees',
    'actual_program_name', 'project_id', 'extracted_at', 'updated_at',
    'extraction_version', 'is_flagged', 'user_comments', 'retry_count',
    'extraction_date', 'confidence_details', 'source_validation', 'verification'
  ]);

  for (let i = 0; i < data.length; i++) {
    const item = data[i];

    // Must be an object
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(`Item at index ${i}: must be an object`);
      continue;
    }

    // Check for unknown keys (potential injection vectors)
    const itemKeys = Object.keys(item);
    const unknownKeys = itemKeys.filter(k => !allowedKeys.has(k));
    if (unknownKeys.length > 0) {
      errors.push(`Item at index ${i}: unknown fields: ${unknownKeys.join(', ')}`);
    }

    // Required fields
    if (!item.school_name || typeof item.school_name !== 'string') {
      errors.push(`Item at index ${i}: school_name is required and must be a string`);
    } else if (item.school_name.length > VALIDATION.SCHOOL_NAME_MAX_LENGTH) {
      errors.push(`Item at index ${i}: school_name exceeds ${VALIDATION.SCHOOL_NAME_MAX_LENGTH} characters`);
    }

    if (!item.program_name || typeof item.program_name !== 'string') {
      errors.push(`Item at index ${i}: program_name is required and must be a string`);
    } else if (item.program_name.length > VALIDATION.PROGRAM_NAME_MAX_LENGTH) {
      errors.push(`Item at index ${i}: program_name exceeds ${VALIDATION.PROGRAM_NAME_MAX_LENGTH} characters`);
    }

    // Optional field length validation
    if (item.remarks && typeof item.remarks === 'string' && item.remarks.length > VALIDATION.REMARKS_MAX_LENGTH) {
      errors.push(`Item at index ${i}: remarks exceeds ${VALIDATION.REMARKS_MAX_LENGTH} characters`);
    }

    if (item.raw_content && typeof item.raw_content === 'string' && item.raw_content.length > VALIDATION.RAW_CONTENT_MAX_LENGTH) {
      errors.push(`Item at index ${i}: raw_content exceeds ${VALIDATION.RAW_CONTENT_MAX_LENGTH} characters`);
    }

    // Stop after 10 errors to avoid overwhelming response
    if (errors.length >= 10) {
      errors.push('...and more errors. Please fix the above issues first.');
      break;
    }
  }

  if (errors.length > 0) {
    return errorResponse(res, 'VALIDATION_ERROR', errors[0], { errors });
  }

  next();
};

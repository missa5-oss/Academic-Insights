/**
 * Prompt Sanitization Utilities
 * Prevents prompt injection attacks by sanitizing user inputs before including in AI prompts.
 * Created as part of Executive Summary Agent audit (Sprint 8).
 */

/**
 * Characters that could be used for prompt injection or markdown manipulation
 */
const DANGEROUS_PATTERNS = [
  /#{1,6}\s/g,           // Markdown headers
  /\*{1,2}[^*]+\*{1,2}/g, // Bold/italic (leave content, remove markers)
  /```[\s\S]*?```/g,      // Code blocks
  /`[^`]+`/g,             // Inline code
  /\[([^\]]+)\]\([^)]+\)/g, // Links
  /!\[([^\]]*)\]\([^)]+\)/g, // Images
  /^>\s/gm,               // Blockquotes
  /^[-*+]\s/gm,           // Unordered lists
  /^\d+\.\s/gm,           // Ordered lists
  /\n{3,}/g,              // Multiple newlines (collapse to 2)
  /^\s*[-=]{3,}\s*$/gm,   // Horizontal rules
];

/**
 * Patterns that indicate potential prompt injection attempts
 */
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|rules?|guidelines?)/i,
  /disregard\s+(all\s+)?(previous|above|prior)/i,
  /new\s+instructions?:/i,
  /system\s*:?\s*prompt/i,
  /you\s+are\s+(now|a)\s+/i,
  /act\s+as\s+(if|a)\s+/i,
  /pretend\s+(you|to\s+be)/i,
  /roleplay\s+as/i,
  /from\s+now\s+on/i,
  /forget\s+(everything|all|your)/i,
];

/**
 * Sanitizes text for safe inclusion in AI prompts.
 * Strips markdown formatting, limits length, and detects injection attempts.
 *
 * @param {string} text - The text to sanitize
 * @param {Object} options - Sanitization options
 * @param {number} options.maxLength - Maximum allowed length (default: 500)
 * @param {boolean} options.allowNewlines - Whether to allow newlines (default: false)
 * @param {boolean} options.detectInjection - Whether to check for injection patterns (default: true)
 * @returns {Object} { sanitized: string, wasModified: boolean, injectionDetected: boolean }
 */
export function sanitizeForPrompt(text, options = {}) {
  const {
    maxLength = 500,
    allowNewlines = false,
    detectInjection = true
  } = options;

  if (!text || typeof text !== 'string') {
    return { sanitized: '', wasModified: false, injectionDetected: false };
  }

  let sanitized = text;
  let wasModified = false;
  let injectionDetected = false;

  // Check for injection patterns before sanitization
  if (detectInjection) {
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(sanitized)) {
        injectionDetected = true;
        // Replace the injection attempt with [FILTERED]
        sanitized = sanitized.replace(pattern, '[FILTERED]');
        wasModified = true;
      }
    }
  }

  // Remove dangerous markdown patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    const before = sanitized;
    // For link patterns, keep the text but remove the URL
    if (pattern.source.includes('\\[') && pattern.source.includes('\\]')) {
      sanitized = sanitized.replace(pattern, '$1');
    } else {
      sanitized = sanitized.replace(pattern, ' ');
    }
    if (sanitized !== before) wasModified = true;
  }

  // Handle newlines
  if (!allowNewlines) {
    const before = sanitized;
    sanitized = sanitized.replace(/[\r\n]+/g, ' ');
    if (sanitized !== before) wasModified = true;
  } else {
    // Collapse multiple newlines to max 2
    const before = sanitized;
    sanitized = sanitized.replace(/\n{3,}/g, '\n\n');
    if (sanitized !== before) wasModified = true;
  }

  // Remove pipe characters (could break markdown tables)
  const beforePipe = sanitized;
  sanitized = sanitized.replace(/\|/g, '-');
  if (sanitized !== beforePipe) wasModified = true;

  // Collapse multiple spaces
  const beforeSpaces = sanitized;
  sanitized = sanitized.replace(/\s{2,}/g, ' ').trim();
  if (sanitized !== beforeSpaces) wasModified = true;

  // Truncate if too long
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength - 3) + '...';
    wasModified = true;
  }

  return { sanitized, wasModified, injectionDetected };
}

/**
 * Sanitizes a school name for prompt inclusion.
 * More restrictive than general sanitization.
 *
 * @param {string} name - School name to sanitize
 * @returns {string} Sanitized school name
 */
export function sanitizeSchoolName(name) {
  const { sanitized } = sanitizeForPrompt(name, {
    maxLength: 200,
    allowNewlines: false,
    detectInjection: true
  });
  return sanitized;
}

/**
 * Sanitizes a program name for prompt inclusion.
 *
 * @param {string} name - Program name to sanitize
 * @returns {string} Sanitized program name
 */
export function sanitizeProgramName(name) {
  const { sanitized } = sanitizeForPrompt(name, {
    maxLength: 150,
    allowNewlines: false,
    detectInjection: true
  });
  return sanitized;
}

/**
 * Sanitizes remarks/comments for prompt inclusion.
 * Allows slightly more content but still filters dangerous patterns.
 *
 * @param {string} remarks - Remarks to sanitize
 * @returns {string} Sanitized remarks
 */
export function sanitizeRemarks(remarks) {
  const { sanitized } = sanitizeForPrompt(remarks, {
    maxLength: 500,
    allowNewlines: false,
    detectInjection: true
  });
  return sanitized;
}

/**
 * Sanitizes raw content snippets for prompt inclusion.
 * This is web-scraped content that needs extra care.
 *
 * @param {string} content - Raw content to sanitize
 * @param {number} maxLength - Maximum length (default: 300)
 * @returns {string} Sanitized content
 */
export function sanitizeRawContent(content, maxLength = 300) {
  const { sanitized } = sanitizeForPrompt(content, {
    maxLength,
    allowNewlines: false,
    detectInjection: true
  });
  return sanitized;
}

/**
 * Truncates a data array to a maximum size, summarizing what was removed.
 *
 * @param {Array} data - Array of extraction results
 * @param {number} maxItems - Maximum items to keep (default: 50)
 * @returns {Object} { data: Array, wasTruncated: boolean, originalCount: number, summary: string }
 */
export function truncateResults(data, maxItems = 50) {
  if (!Array.isArray(data)) {
    return { data: [], wasTruncated: false, originalCount: 0, summary: '' };
  }

  const originalCount = data.length;

  if (data.length <= maxItems) {
    return { data, wasTruncated: false, originalCount, summary: '' };
  }

  // Sort by status priority (Success first) then by tuition amount
  const sorted = [...data].sort((a, b) => {
    // Priority: Success > Pending > Not Found > Failed
    const statusOrder = { 'Success': 0, 'Pending': 1, 'Not Found': 2, 'Failed': 3 };
    const statusDiff = (statusOrder[a.status] || 4) - (statusOrder[b.status] || 4);
    if (statusDiff !== 0) return statusDiff;

    // Then by tuition amount (higher first)
    const aAmount = parseFloat((a.tuition_amount || '0').replace(/[^0-9.-]/g, '')) || 0;
    const bAmount = parseFloat((b.tuition_amount || '0').replace(/[^0-9.-]/g, '')) || 0;
    return bAmount - aAmount;
  });

  const truncated = sorted.slice(0, maxItems);
  const removed = originalCount - maxItems;

  // Count what was removed
  const removedItems = sorted.slice(maxItems);
  const removedByStatus = removedItems.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});

  const summary = `Note: ${removed} additional programs were excluded from this analysis. ` +
    `Excluded: ${Object.entries(removedByStatus).map(([s, c]) => `${c} ${s}`).join(', ')}.`;

  return {
    data: truncated,
    wasTruncated: true,
    originalCount,
    summary
  };
}

/**
 * Estimates token count for a string (rough approximation).
 * Uses ~4 characters per token as a rough estimate for English text.
 *
 * @param {string} text - Text to estimate tokens for
 * @returns {number} Estimated token count
 */
export function estimateTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  // Rough estimate: ~4 characters per token for English
  return Math.ceil(text.length / 4);
}

/**
 * Validates and sanitizes an entire extraction result object for prompt inclusion.
 *
 * @param {Object} result - Extraction result to sanitize
 * @returns {Object} Sanitized result with injection detection flag
 */
export function sanitizeExtractionResult(result) {
  if (!result || typeof result !== 'object') {
    return { sanitized: {}, injectionDetected: false };
  }

  let injectionDetected = false;

  const sanitized = {
    ...result,
    school_name: (() => {
      const { sanitized: s, injectionDetected: d } = sanitizeForPrompt(result.school_name, { maxLength: 200 });
      if (d) injectionDetected = true;
      return s;
    })(),
    program_name: (() => {
      const { sanitized: s, injectionDetected: d } = sanitizeForPrompt(result.program_name, { maxLength: 150 });
      if (d) injectionDetected = true;
      return s;
    })(),
    remarks: result.remarks ? (() => {
      const { sanitized: s, injectionDetected: d } = sanitizeForPrompt(result.remarks, { maxLength: 500 });
      if (d) injectionDetected = true;
      return s;
    })() : null,
    raw_content: result.raw_content ? (() => {
      const { sanitized: s, injectionDetected: d } = sanitizeForPrompt(result.raw_content, { maxLength: 300 });
      if (d) injectionDetected = true;
      return s;
    })() : null
  };

  return { sanitized, injectionDetected };
}

export default {
  sanitizeForPrompt,
  sanitizeSchoolName,
  sanitizeProgramName,
  sanitizeRemarks,
  sanitizeRawContent,
  truncateResults,
  estimateTokens,
  sanitizeExtractionResult
};

import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';
import crypto from 'crypto';
import { validateExtraction, validateChat, validateSummary } from '../middleware/validation.js';
import { GEMINI_CONFIG } from '../config.js';
import logger from '../utils/logger.js';
import { sql } from '../db.js';
import { logAiUsage } from '../utils/aiLogger.js';
import { verifyExtraction } from '../agents/verifierAgent.js';

const router = Router();

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  retryableErrors: ['RESOURCE_EXHAUSTED', 'UNAVAILABLE', 'DEADLINE_EXCEEDED', 'INTERNAL']
};

/**
 * Sleep for a specified duration
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Calculate exponential backoff delay with jitter
 */
const getRetryDelay = (attempt) => {
  const exponentialDelay = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * 1000;
  return Math.min(exponentialDelay + jitter, RETRY_CONFIG.maxDelayMs);
};

/**
 * Check if an error is retryable
 */
const isRetryableError = (error) => {
  const errorMessage = error.message || '';
  const errorCode = error.code || '';

  // Check for rate limiting or transient errors
  if (errorMessage.includes('429') || errorMessage.includes('quota')) return true;
  if (errorMessage.includes('503') || errorMessage.includes('unavailable')) return true;
  if (errorMessage.includes('500') || errorMessage.includes('internal')) return true;
  if (errorMessage.includes('timeout')) return true;

  return RETRY_CONFIG.retryableErrors.some(code =>
    errorCode.includes(code) || errorMessage.toUpperCase().includes(code)
  );
};

/**
 * Execute a function with retry logic
 */
const withRetry = async (fn, context = 'operation') => {
  let lastError;

  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < RETRY_CONFIG.maxRetries && isRetryableError(error)) {
        const delay = getRetryDelay(attempt);
        logger.warn(`Retry ${attempt + 1}/${RETRY_CONFIG.maxRetries} for ${context} after ${Math.round(delay)}ms`, {
          error: error.message
        });
        await sleep(delay);
      } else {
        break;
      }
    }
  }

  throw lastError;
};

// Helper function to sanitize text for database storage
function sanitizeForDatabase(text) {
    if (!text) return text;
    return text
        // Remove null characters (PostgreSQL can't handle these)
        .replace(/\u0000/g, '')
        // Remove other problematic control characters
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        // Remove any binary-looking content (PDF streams, etc.)
        .replace(/stream[\s\S]*?endstream/gi, '[binary content removed]')
        .replace(/%PDF[\s\S]*?%%EOF/gi, '[PDF content removed]')
        // Clean up excessive whitespace that might result
        .replace(/\s+/g, ' ')
        .trim();
}

// Helper function to safely parse JSON from LLM responses
function safeParseJSON(text, context = 'extraction') {
    if (!text || typeof text !== 'string') {
        logger.warn(`Invalid JSON input for ${context}: not a string`);
        return null;
    }

    // Try direct parse first (most common case)
    try {
        return JSON.parse(text);
    } catch (e) {
        // LLM may have wrapped JSON in markdown code blocks
        const markdownMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (markdownMatch) {
            try {
                return JSON.parse(markdownMatch[1]);
            } catch (innerError) {
                logger.warn(`Failed to parse JSON from markdown for ${context}`, { error: innerError.message });
            }
        }

        // Try extracting raw JSON object (handles nested braces better)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[0]);
            } catch (objectError) {
                logger.warn(`Failed to parse extracted JSON object for ${context}`, { error: objectError.message });
            }
        }

        logger.error(`Unable to parse JSON for ${context}. Response: ${text.substring(0, 500)}`);
        return null;
    }
}

// Helper function to validate URL format
function isValidUrl(urlString) {
    if (!urlString || typeof urlString !== 'string') {
        return false;
    }
    try {
        new URL(urlString);
        return true;
    } catch (e) {
        return false;
    }
}

// Helper function to format currency values with $ prefix
function formatCurrency(value) {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const strValue = String(value).trim();

    // If already starts with $, return as-is (it's already formatted)
    if (strValue.startsWith('$')) {
        return strValue;
    }

    // Check if it looks like a number or currency string (allows $ later in string for non-numeric values)
    if (/^[\d\s,.-]+$/.test(strValue) || /^\$?[\d\s,.-]+$/.test(strValue)) {
        // Remove any existing currency symbols and extract numeric part
        const numericPart = strValue.replace(/[^\d.-]/g, '');

        // Validate it's a valid number
        if (numericPart === '' || numericPart === '-' || numericPart === '.') {
            return '$' + strValue; // Fallback: prepend $ to original value
        }

        // Prepend $
        return '$' + strValue;
    }

    // For non-numeric strings, just prepend $
    return '$' + strValue;
}

/**
 * Extract actual URL from Google redirect
 * Handles: google.com/url?q=TARGET&sa=...
 * Phase 1 Improvement: Resolve ~20% of grounding chunks that return redirects
 */
function resolveGoogleRedirect(url) {
    if (!url || !url.includes('google.com/url')) {
        return url;
    }

    try {
        const urlObj = new URL(url);
        const targetUrl = urlObj.searchParams.get('q');
        if (targetUrl && isValidUrl(targetUrl)) {
            logger.debug(`Resolved redirect: ${url} → ${targetUrl}`);
            return targetUrl;
        }
    } catch (e) {
        logger.warn(`Failed to resolve redirect: ${url}`, { error: e.message });
    }

    return url;
}

// Initialize Gemini client
const getClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured in server environment');
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Program name variations mapping for retry logic
 * When initial extraction returns "Not Found" or low confidence,
 * we can retry with alternative program names
 */
const PROGRAM_VARIATIONS = {
  'part-time mba': ['Professional MBA', 'Weekend MBA', 'Evening MBA', 'Flex MBA', 'Working Professional MBA', 'Part-Time MBA'],
  'professional mba': ['Part-Time MBA', 'Weekend MBA', 'Evening MBA', 'Flex MBA', 'Working Professional MBA'],
  'weekend mba': ['Part-Time MBA', 'Professional MBA', 'Evening MBA', 'Flex MBA'],
  'evening mba': ['Part-Time MBA', 'Professional MBA', 'Weekend MBA', 'Flex MBA'],
  'flex mba': ['Part-Time MBA', 'Professional MBA', 'Flexible MBA', 'Evening MBA'],
  'executive mba': ['EMBA', 'Exec MBA', 'Executive MBA Program'],
  'emba': ['Executive MBA', 'Exec MBA', 'Executive MBA Program'],
  'full-time mba': ['Two-Year MBA', 'Residential MBA', 'Traditional MBA', 'Full-Time MBA Program', 'MBA'],
  'two-year mba': ['Full-Time MBA', 'Residential MBA', 'Traditional MBA', 'MBA'],
  'mba': ['Full-Time MBA', 'Two-Year MBA', 'MBA Program'],
  'online mba': ['Distance MBA', 'Remote MBA', 'Virtual MBA', 'Online MBA Program'],
  'ms finance': ['Master of Science in Finance', 'MSF', 'MS in Finance', 'Master in Finance'],
  'msf': ['MS Finance', 'Master of Science in Finance', 'MS in Finance'],
  'ms accounting': ['Master of Science in Accounting', 'MSA', 'MAcc', 'Master of Accountancy'],
  'ms marketing': ['Master of Science in Marketing', 'MSM', 'MS in Marketing'],
  'ms business analytics': ['MSBA', 'Master of Business Analytics', 'MS Analytics', 'Master of Science in Business Analytics'],
  'msba': ['MS Business Analytics', 'Master of Business Analytics', 'MS Analytics'],
  'ms information systems': ['MSIS', 'MS in Information Systems', 'Master of Information Systems', 'MS IT'],
  'msis': ['MS Information Systems', 'Master of Information Systems', 'MS in IS']
};

/**
 * Get alternative program names to try if initial extraction fails
 */
function getProgramVariations(program) {
  const normalizedProgram = program.toLowerCase().trim();

  // Direct match
  if (PROGRAM_VARIATIONS[normalizedProgram]) {
    return PROGRAM_VARIATIONS[normalizedProgram];
  }

  // Partial match - check if program contains any key
  for (const [key, variations] of Object.entries(PROGRAM_VARIATIONS)) {
    if (normalizedProgram.includes(key) || key.includes(normalizedProgram)) {
      return variations;
    }
  }

  return [];
}

/**
 * Extract complete tuition and program information in a single API call
 * Combines tuition, fees, credits, and program details for efficiency
 */
async function extractProgramInfo(ai, school, program) {
  const prompt = `
Search for "${school}" "${program}" tuition and fees on the official .edu website.

SEARCH STRATEGY:
1. First, find the official business school website (e.g., wharton.upenn.edu, kellogg.northwestern.edu, haas.berkeley.edu)
2. Look for the "Tuition & Fees", "Cost", or "Financial Aid" page for the specific program
3. ONLY use data from official .edu university/business school websites

IGNORE these sources completely: clearadmit, poets&quants, shiksha, collegechoice, usnews, bloomberg, fortune, any non-.edu site

PROGRAM NAME VARIATIONS:
- "Part-Time MBA" may be called: Professional MBA, Weekend MBA, Evening MBA, Flex MBA, Working Professional MBA
- "Executive MBA" may be called: EMBA, Exec MBA
- "Full-Time MBA" may be called: Two-Year MBA, Residential MBA, Traditional MBA

EXTRACTION RULES:
- tuition_amount = TOTAL PROGRAM TUITION (cost_per_credit × total_credits, or stated total)
- Do NOT include "total" word in tuition_amount - just "$XX,XXX"
- TUITION ONLY - exclude fees (technology, student services, health) from tuition_amount
- Put fees in additional_fees field separately
- For private schools, there is no in-state/out-of-state distinction
- academic_year = Use 2025-2026 rates if available, otherwise most current year
- program_length_months = MUST be a NUMBER of months (e.g., "2 years" → 24, "18 months" → 18, "1.5 years" → 18, "21 months" → 21)
- If program not found on official .edu site, set status="Not Found"

OUTPUT - Return ONLY valid JSON, no markdown, no explanation:
{"tuition_amount":"$XX,XXX","tuition_period":"full program","academic_year":"2025-2026","cost_per_credit":"$X,XXX","total_credits":"XX","program_length_months":24,"actual_program_name":"exact name from website","is_stem":false,"additional_fees":"$X,XXX or null","remarks":"any notable info","status":"Success"}
  `;

  const response = await withRetry(
    () => ai.models.generateContent({
      model: GEMINI_CONFIG.MODEL,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    }),
    `extract:${school}`
  );

  // Log response structure for debugging
  logger.debug(`Raw response structure for extraction`, {
    hasText: !!response.text,
    textLength: response.text?.length || 0,
    hasCandidates: !!response.candidates,
    candidateCount: response.candidates?.length || 0,
    firstCandidateKeys: Object.keys(response.candidates?.[0] || {}),
    hasGroundingMetadata: !!response.candidates?.[0]?.groundingMetadata,
    groundingMetadataKeys: Object.keys(response.candidates?.[0]?.groundingMetadata || {})
  });

  const parsedData = safeParseJSON(response.text, `extract:${school}:${program}`);

  if (!parsedData) {
    throw new Error('Failed to parse extraction response as JSON');
  }

  // Phase 2: Capture search query for transparency
  const searchQuery = `"${school}" "${program}" tuition fees site:.edu`;

  return {
    data: parsedData,
    response: response,
    searchQuery: searchQuery
  };
}

/**
 * Extract inline citations from grounding supports
 * Maps response text segments to source indices for attribution
 * Phase 2: Enhanced Attribution
 */
function extractInlineCitations(response, validatedSources) {
  const citations = [];
  const groundingSupports = response.candidates?.[0]?.groundingMetadata?.groundingSupports || [];

  if (groundingSupports.length === 0 || validatedSources.length === 0) {
    return null;
  }

  groundingSupports.forEach(support => {
    const sourceIndices = support.groundingChunkIndices || [];
    const text = support.segment?.text || support.text || '';

    if (text && sourceIndices.length > 0) {
      // Map chunk indices to validated source indices
      const mappedSources = sourceIndices
        .filter(idx => idx < validatedSources.length)
        .map(idx => idx);

      if (mappedSources.length > 0) {
        citations.push({
          text: text.substring(0, 200), // Limit snippet length
          sourceIndices: mappedSources,
          startIndex: support.segment?.startIndex || null,
          endIndex: support.segment?.endIndex || null
        });
      }
    }
  });

  return citations.length > 0 ? citations : null;
}

// --- TUITION EXTRACTION ENDPOINT ---
router.post('/extract', validateExtraction, async (req, res) => {
  const aiStartTime = Date.now();
  let retryCount = 0;
  const { school, program } = req.body;

  try {
    logger.info(`Starting extraction for: ${school} - ${program}`);

    const ai = getClient();

    // Single extraction call for all program information
    let extractionResult;
    try {
      // Track retries by wrapping the call
      const originalWithRetry = withRetry;
      extractionResult = await withRetry(
        async () => {
          retryCount++;
          return await extractProgramInfo(ai, school, program);
        },
        `extract:${school}`
      );
      retryCount = Math.max(0, retryCount - 1); // Subtract 1 (first attempt not a retry)
    } catch (error) {
      logger.error('Extraction failed', error);
      const aiResponseTime = Date.now() - aiStartTime;
      
      // Log AI usage failure
      await logAiUsage({
        endpoint: '/api/gemini/extract',
        model: GEMINI_CONFIG.MODEL,
        operationType: 'extraction',
        aiResponseTime: aiResponseTime,
        retryCount: retryCount,
        success: false,
        error: error,
        requestMetadata: { school, program }
      });

      return res.status(200).json({
        status: 'Failed',
        raw_content: `Failed to extract data: ${error.message}`
      });
    }

    let extractedData = extractionResult.data;
    let usedProgramVariation = null;

    // If program not found or low confidence, try alternative program names
    // Limit to MAX_VARIATION_RETRIES to avoid wasting API credits
    const MAX_VARIATION_RETRIES = 3;

    if (extractedData.status === 'Not Found' || !extractedData.tuition_amount) {
      const allVariations = getProgramVariations(program);
      const variations = allVariations.slice(0, MAX_VARIATION_RETRIES); // Limit retries

      if (variations.length > 0) {
        logger.info(`Program "${program}" not found, trying up to ${variations.length} variations (of ${allVariations.length} available) for: ${school}`);

        for (const variation of variations) {
          try {
            logger.info(`Trying variation: ${school} - ${variation}`);
            const retryResult = await extractProgramInfo(ai, school, variation);

            if (retryResult.data.status === 'Success' && retryResult.data.tuition_amount) {
              logger.info(`Found data using variation "${variation}" for: ${school}`);
              extractionResult = retryResult;
              extractedData = retryResult.data;
              usedProgramVariation = variation;
              // Add note about the variation used
              extractedData.remarks = extractedData.remarks
                ? `${extractedData.remarks}. Found as "${variation}"`
                : `Program found as "${variation}" instead of "${program}"`;
              break;
            }
          } catch (varError) {
            logger.warn(`Variation "${variation}" failed for ${school}`, { error: varError.message });
          }
        }
      }
    }

    // If still not found after variations, return Not Found
    if (extractedData.status === 'Not Found' || !extractedData.tuition_amount) {
      const triedVariations = getProgramVariations(program);
      const variationsNote = triedVariations.length > 0
        ? ` Tried variations: ${triedVariations.slice(0, 3).join(', ')}${triedVariations.length > 3 ? '...' : ''}`
        : '';

      return res.json({
        tuition_amount: null,
        tuition_period: 'N/A',
        academic_year: '2025-2026',
        cost_per_credit: null,
        total_credits: null,
        program_length: null,
        program_length_months: null,
        actual_program_name: null,
        is_stem: false,
        additional_fees: null,
        remarks: `Program not found at this school.${variationsNote}`,
        confidence_score: 'Low',
        status: 'Not Found',
        source_url: `https://www.google.com/search?q=${encodeURIComponent(school + ' ' + program + ' tuition')}`,
        validated_sources: [],
        raw_content: 'Program not found at this school.'
      });
    }

    // --- Source URL Logic ---
    let validatedSources = [];
    let primarySourceUrl = '';

    // Get grounding chunks from extraction response
    const response = extractionResult.response;

    // Debug: Log full response structure to understand grounding metadata
    logger.info(`Extraction response structure for ${school} - ${program}`, {
      hasCandidates: !!response.candidates,
      candidateCount: response.candidates?.length || 0,
      hasGroundingMetadata: !!response.candidates?.[0]?.groundingMetadata,
      groundingMetadataKeys: Object.keys(response.candidates?.[0]?.groundingMetadata || {}),
      groundingChunksCount: response.candidates?.[0]?.groundingMetadata?.groundingChunks?.length || 0,
      groundingSupportsCount: response.candidates?.[0]?.groundingMetadata?.groundingSupports?.length || 0
    });

    let groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    let supportingChunks = response.candidates?.[0]?.groundingMetadata?.groundingSupports || [];

    // Retry once if no grounding chunks returned (Google API sometimes returns empty)
    if (groundingChunks.length === 0 && extractedData.status === 'Success') {
      logger.info(`Retrying extraction for sources: ${school} - ${program}`);
      try {
        const retryResult = await extractProgramInfo(ai, school, program);
        const retryGrounding = retryResult.response.candidates?.[0]?.groundingMetadata;
        if (retryGrounding?.groundingChunks?.length > 0) {
          groundingChunks = retryGrounding.groundingChunks;
          supportingChunks = retryGrounding.groundingSupports || [];
          logger.info(`Retry succeeded - got ${groundingChunks.length} sources for: ${school} - ${program}`);
        }
      } catch (retryError) {
        logger.warn(`Retry for sources failed: ${school} - ${program}`, { error: retryError.message });
      }
    }

    if (groundingChunks && groundingChunks.length > 0) {
        logger.info(`Grounding sources for ${school} - ${program}`, {
          sources: groundingChunks
            .filter(c => c.web?.uri)
            .map(c => ({ title: c.web?.title || '', url: c.web?.uri }))
        });
        logger.info(`Grounding snippets for ${school} - ${program}`, {
          snippets: groundingChunks
            .filter(c => c.segment?.text || c.web?.text)
            .map(c => ({
              url: c.web?.uri || '',
              text: (c.segment?.text || c.web?.text || '').trim().substring(0, 500)
            }))
        });

        // Create a map of original groundingChunks indices for proper lookup
        const groundingChunkIndexMap = new Map();
        groundingChunks.forEach((chunk, originalIndex) => {
            if (chunk.web?.uri) {
                groundingChunkIndexMap.set(chunk.web.uri, originalIndex);
            }
        });

        const webChunks = groundingChunks
            .filter((c) => c.web?.uri)
            .map((c) => {
                // Get the original index from the full groundingChunks array
                const originalIndex = groundingChunkIndexMap.get(c.web.uri);

                // Extract actual page text content with prioritized sources
                // Phase 1 Improvement: Prioritize groundingSupports for better quality
                let rawContent = '';

                // Priority 1: groundingSupports segments (best quality - actual page content)
                if (supportingChunks && supportingChunks.length > 0) {
                    const relevantSupports = supportingChunks.filter(s =>
                        s.groundingChunkIndices?.includes(originalIndex)
                    );
                    if (relevantSupports.length > 0) {
                        const pageText = relevantSupports
                            .map(s => s.segment?.text || s.text || '')
                            .filter(text => text && text.trim().length > 0)
                            .join('\n\n')
                            .trim();

                        if (pageText && pageText.length > 10) {
                            rawContent = pageText;
                            logger.debug(`Using groundingSupports (${pageText.length} chars) for ${c.web.uri}`);
                        }
                    }
                }

                // Priority 2: Fallback to segment.text if available
                if (!rawContent && c.segment?.text && c.segment.text.trim().length > 10) {
                    rawContent = c.segment.text.trim();
                    logger.debug(`Using segment.text fallback for ${c.web.uri}`);
                }

                // Priority 3: Last resort - web.text (least reliable)
                if (!rawContent && c.web?.text && c.web.text.trim().length > 10) {
                    rawContent = c.web.text.trim();
                    logger.warn(`Using web.text fallback (may be incomplete) for ${c.web.uri}`);
                }

                // Limit content length (reserve space for truncation message)
                const MAX_CONTENT_LENGTH = 9950;
                if (rawContent.length > MAX_CONTENT_LENGTH) {
                    rawContent = rawContent.substring(0, MAX_CONTENT_LENGTH) + '\n\n... [content truncated - showing first 9,950 characters]';
                }

                // Sanitize for database
                rawContent = sanitizeForDatabase(rawContent);

                return {
                    title: c.web.title || 'Official Source',
                    url: resolveGoogleRedirect(c.web.uri), // Phase 1: Resolve Google redirects to actual .edu URLs
                    raw_content: rawContent || `No extractable text content found from ${c.web.uri}. Please visit the URL directly to verify the data.`
                };
            });

        // Deduplication by URL and content
        const uniqueUrls = new Set();
        const uniqueContent = new Set();
        validatedSources = webChunks.filter((item) => {
            // Skip duplicate URLs
            if (uniqueUrls.has(item.url)) return false;

            // Skip duplicate content (normalize by trimming and lowercasing)
            const normalizedContent = item.raw_content?.trim().toLowerCase().substring(0, 200) || '';
            if (normalizedContent.length > 20 && uniqueContent.has(normalizedContent)) {
                return false;
            }

            uniqueUrls.add(item.url);
            if (normalizedContent.length > 20) {
                uniqueContent.add(normalizedContent);
            }
            return true;
        }).slice(0, 3); // Keep top 3 unique sources
        
        logger.info(`Validated sources for ${school} - ${program}`, {
          sources: validatedSources.map(s => ({ title: s.title, url: s.url }))
        });
    } else {
        logger.warn(`No grounding chunks returned from Google Search for: ${school} - ${program}`);
    }

    // Set primary source
    if (validatedSources.length > 0) {
        primarySourceUrl = validatedSources[0].url;
    } else {
        // Better fallback: construct a search URL with school/program context
        primarySourceUrl = `https://www.google.com/search?q=${encodeURIComponent(school + ' ' + program + ' tuition')}`;
        logger.warn(`Using fallback search URL for: ${school} - ${program}`, { url: primarySourceUrl });
    }

    // Confidence scoring: prioritize "Not Found" status, then check data completeness
    let confidenceScore = 'Medium';
    if (extractedData.status === 'Not Found') {
        confidenceScore = 'Low';
    } else if (extractedData.tuition_amount && extractedData.cost_per_credit && extractedData.total_credits) {
        confidenceScore = 'High';
    } else if (!extractedData.tuition_amount) {
        confidenceScore = 'Low';
    }

    // Use the tuition amount, but sanitize to remove "total" suffix
    let tuitionAmount = extractedData.tuition_amount || null;
    if (tuitionAmount) {
      // Remove " total" or "total" from the tuition amount
      tuitionAmount = tuitionAmount.replace(/\s*total\s*$/i, '').trim();
    }
    let tuitionPeriod = extractedData.tuition_period || 'N/A';

    // Extract raw_content from grounding chunks (actual page content)
    let rawContentSummary = '';
    if (validatedSources.length > 0) {
      // Aggregate content from all sources
      const contentPieces = validatedSources
        .filter(source => source.raw_content &&
                source.raw_content.length > 50 &&
                !source.raw_content.includes('No extractable text content found'))
        .map(source => source.raw_content);

      if (contentPieces.length > 0) {
        rawContentSummary = contentPieces.join('\n\n---\n\n');
        // Truncate if too long (reserve space for message)
        const MAX_RAW_CONTENT = 9900;
        if (rawContentSummary.length > MAX_RAW_CONTENT) {
          rawContentSummary = rawContentSummary.substring(0, MAX_RAW_CONTENT) +
            '\n\n... [content truncated - showing first 9,900 characters from ' + contentPieces.length + ' source(s)]';
        }
      }
    }

    // Fallback: if no content from sources, create a summary from extracted data
    if (!rawContentSummary || rawContentSummary.length < 50) {
      rawContentSummary = `Extracted from ${school}:\n` +
        `Program: ${extractedData.actual_program_name || program}\n` +
        `Tuition: ${tuitionAmount || 'Not found'}\n` +
        `Credits: ${extractedData.total_credits || 'Not specified'}\n` +
        `Cost per credit: ${extractedData.cost_per_credit || 'Not specified'}\n` +
        `Program length: ${extractedData.program_length || 'Not specified'}\n` +
        `STEM: ${extractedData.is_stem ? 'Yes' : 'No'}\n` +
        (extractedData.remarks ? `\nNotes: ${extractedData.remarks}` : '');
    }

    // Sanitize raw_content for database storage
    const sanitizedRawContent = sanitizeForDatabase(rawContentSummary) || 'No content summary provided.';

    // Handle program_length_months - ensure it's a number or null
    let programLengthMonths = null;
    if (extractedData.program_length_months !== null && extractedData.program_length_months !== undefined) {
      const parsed = parseInt(extractedData.program_length_months, 10);
      programLengthMonths = isNaN(parsed) ? null : parsed;
    }
    // Fallback: try to parse from old program_length field if it exists
    if (programLengthMonths === null && extractedData.program_length) {
      const lengthStr = String(extractedData.program_length).toLowerCase();
      const yearsMatch = lengthStr.match(/([\d.]+)\s*years?/);
      const monthsMatch = lengthStr.match(/([\d.]+)\s*months?/);
      if (monthsMatch) {
        programLengthMonths = Math.round(parseFloat(monthsMatch[1]));
      } else if (yearsMatch) {
        programLengthMonths = Math.round(parseFloat(yearsMatch[1]) * 12);
      }
    }

    // Phase 2: Extract inline citations from grounding supports
    const inlineCitations = extractInlineCitations(extractionResult.response, validatedSources);

    const result = {
      tuition_amount: formatCurrency(tuitionAmount),
      tuition_period: tuitionPeriod,
      academic_year: extractedData.academic_year || '2025-2026',
      cost_per_credit: formatCurrency(extractedData.cost_per_credit) || null,
      total_credits: extractedData.total_credits || null,
      program_length: extractedData.program_length || null, // Keep for backward compatibility
      program_length_months: programLengthMonths, // New numeric field for analysis
      actual_program_name: extractedData.actual_program_name || null,
      is_stem: extractedData.is_stem === true ? true : false, // Default to false if not explicitly true
      additional_fees: formatCurrency(extractedData.additional_fees) || null,
      remarks: sanitizeForDatabase(extractedData.remarks) || null,
      confidence_score: confidenceScore,
      status: extractedData.status === 'Not Found' ? 'Not Found' : 'Success',
      source_url: primarySourceUrl,
      validated_sources: validatedSources,
      raw_content: sanitizedRawContent,
      // Phase 2: Enhanced Attribution
      search_query: extractionResult.searchQuery || null,
      inline_citations: inlineCitations
    };

    // --- VERIFICATION AGENT ---
    // Run verification to validate extraction accuracy
    logger.info(`Running verification agent for: ${school} - ${program}`);
    let verification = null;
    try {
      verification = await verifyExtraction(ai, result, school, program, { useAIVerification: true });

      // Update confidence score based on verification
      if (verification) {
        result.confidence_score = verification.confidence;
        result.verification = {
          status: verification.status,
          issues: verification.issues,
          validations: verification.validations,
          reasoning: verification.reasoning,
          completenessScore: verification.completenessScore,
          retryRecommended: verification.retryRecommended
        };

        // Add verification notes to remarks if there are issues
        if (verification.issues.length > 0 && verification.status !== 'verified') {
          const verificationNote = `[Verification: ${verification.issues.length} issue(s) found]`;
          result.remarks = result.remarks
            ? `${result.remarks} ${verificationNote}`
            : verificationNote;
        }

        logger.info(`Verification complete for: ${school} - ${program}`, {
          verificationStatus: verification.status,
          originalConfidence: confidenceScore,
          adjustedConfidence: verification.confidence,
          issueCount: verification.issues.length,
          retryRecommended: verification.retryRecommended
        });
      }
    } catch (verificationError) {
      logger.warn(`Verification agent failed for: ${school} - ${program}`, {
        error: verificationError.message
      });
      // Continue without verification - don't fail the extraction
    }

    logger.info(`Extraction success for: ${school} - ${program}`, {
      tuition: result.tuition_amount,
      program: result.actual_program_name,
      stem: result.is_stem,
      confidence: result.confidence_score,
      status: result.status,
      verified: verification?.status || 'skipped'
    });

    // Log AI usage success
    const aiResponseTime = Date.now() - aiStartTime;
    await logAiUsage({
      endpoint: '/api/gemini/extract',
      model: GEMINI_CONFIG.MODEL,
      operationType: 'extraction',
      response: extractionResult.response,
      aiResponseTime: aiResponseTime,
      retryCount: retryCount,
      success: true,
      requestMetadata: { school, program },
      responseMetadata: {
        status: result.status,
        confidence_score: result.confidence_score,
        has_tuition: !!result.tuition_amount,
        sources_count: validatedSources.length,
        verification_status: verification?.status || 'skipped',
        verification_issues: verification?.issues?.length || 0
      }
    });

    res.json(result);

  } catch (error) {
    logger.error('Extraction Error', error, { school, program });
    
    // Log AI usage failure for unexpected errors
    const aiResponseTime = Date.now() - aiStartTime;
    await logAiUsage({
      endpoint: '/api/gemini/extract',
      model: GEMINI_CONFIG.MODEL,
      operationType: 'extraction',
      aiResponseTime: aiResponseTime,
      retryCount: retryCount,
      success: false,
      error: error,
      requestMetadata: { school, program }
    });

    res.status(500).json({
      status: 'Failed',
      raw_content: 'Agent failed to retrieve data due to system error.',
      error: error.message
    });
  }
});

// --- LOCATION EXTRACTION ENDPOINT ---
router.post('/location', async (req, res) => {
  const aiStartTime = Date.now();
  let retryCount = 0;
  const { school, program } = req.body;

  try {
    if (!school || !program) {
      return res.status(400).json({ error: 'Missing required fields: school, program' });
    }

    const ai = getClient();

    const prompt = `Find the main campus address for ${school} offering the ${program}.`;

    // Execute with retry logic for transient failures
    let response;
    try {
      response = await withRetry(
        async () => {
          retryCount++;
          return await ai.models.generateContent({
            model: GEMINI_CONFIG.MODEL,
            contents: prompt,
            config: {
              tools: [{ googleMaps: {} }]
            }
          });
        },
        `location:${school}`
      );
      retryCount = Math.max(0, retryCount - 1); // Subtract 1 (first attempt not a retry)
    } catch (error) {
      const aiResponseTime = Date.now() - aiStartTime;
      
      // Log AI usage failure
      await logAiUsage({
        endpoint: '/api/gemini/location',
        model: GEMINI_CONFIG.MODEL,
        operationType: 'location',
        aiResponseTime: aiResponseTime,
        retryCount: retryCount,
        success: false,
        error: error,
        requestMetadata: { school, program }
      });

      logger.error('Maps Extraction Error', error);
      return res.json(null);
    }

    const candidate = response.candidates?.[0];
    const groundingChunks = candidate?.groundingMetadata?.groundingChunks;

    // Extract map data from grounding chunks
    let locationData = null;
    if (groundingChunks && groundingChunks.length > 0) {
      const firstMap = groundingChunks.find((c) => c.web?.uri);

      if (firstMap) {
        locationData = {
          address: firstMap.web?.title || 'Address Found via Google Maps',
          map_url: firstMap.web?.uri || '',
          latitude: null,
          longitude: null
        };
      }
    }

    // Log AI usage
    const aiResponseTime = Date.now() - aiStartTime;
    await logAiUsage({
      endpoint: '/api/gemini/location',
      model: GEMINI_CONFIG.MODEL,
      operationType: 'location',
      response: response,
      aiResponseTime: aiResponseTime,
      retryCount: retryCount,
      success: locationData !== null,
      requestMetadata: { school, program },
      responseMetadata: {
        found: locationData !== null,
        has_map_url: locationData?.map_url ? true : false
      }
    });

    res.json(locationData);

  } catch (error) {
    logger.error('Maps Extraction Error', error);
    
    // Log AI usage failure for unexpected errors
    const aiResponseTime = Date.now() - aiStartTime;
    await logAiUsage({
      endpoint: '/api/gemini/location',
      model: GEMINI_CONFIG.MODEL,
      operationType: 'location',
      aiResponseTime: aiResponseTime,
      retryCount: retryCount,
      success: false,
      error: error,
      requestMetadata: { school, program }
    });

    res.json(null);
  }
});

// --- EXECUTIVE SUMMARY ENDPOINT ---
router.post('/summary', validateSummary, async (req, res) => {
  const aiStartTime = Date.now();
  let retryCount = 0;
  let wasCached = false;

  try {
    const { data, projectId, forceRefresh } = req.body;

    // Generate hash of data to detect changes (includes projectId for isolation)
    const dataHash = crypto
      .createHash('md5')
      .update(JSON.stringify({
        projectId: projectId,
        results: data.map(r => ({
          id: r.id,
          tuition: r.tuition_amount,
          status: r.status,
          confidence: r.confidence_score
        }))
      }))
      .digest('hex');

    // Check cache if projectId provided and not forcing refresh
    if (projectId && !forceRefresh) {
      try {
        const [cached] = await sql`
          SELECT response, created_at
          FROM project_summaries
          WHERE project_id = ${projectId}
            AND data_hash = ${dataHash}
            AND expires_at > CURRENT_TIMESTAMP
          ORDER BY created_at DESC
          LIMIT 1
        `;

        if (cached) {
          logger.info(`Returning cached summary for project ${projectId}`);
          wasCached = true;
          // Log cached response (no AI call made)
          await logAiUsage({
            endpoint: '/api/gemini/summary',
            model: GEMINI_CONFIG.MODEL,
            operationType: 'summary',
            inputTokens: 0,
            outputTokens: 0,
            aiResponseTime: 0,
            retryCount: 0,
            success: true,
            requestMetadata: { projectId, dataCount: data.length },
            responseMetadata: { cached: true }
          });
          return res.json({
            ...cached.response,
            cached: true,
            cachedAt: cached.created_at
          });
        }
      } catch (cacheError) {
        logger.warn('Cache lookup failed, generating fresh summary', { error: cacheError.message });
      }
    }

    const ai = getClient();

    // Calculate quantitative metrics for the summary
    const successfulResults = data.filter(r => r.status === 'Success' && r.tuition_amount);
    const tuitionAmounts = successfulResults
      .map(r => {
        const amount = r.tuition_amount?.replace(/[^0-9.-]/g, '');
        return amount ? parseFloat(amount) : null;
      })
      .filter(a => a !== null && !isNaN(a));

    const metrics = {
      totalPrograms: data.length,
      successfulExtractions: successfulResults.length,
      avgTuition: tuitionAmounts.length > 0
        ? Math.round(tuitionAmounts.reduce((a, b) => a + b, 0) / tuitionAmounts.length)
        : 0,
      minTuition: tuitionAmounts.length > 0 ? Math.min(...tuitionAmounts) : 0,
      maxTuition: tuitionAmounts.length > 0 ? Math.max(...tuitionAmounts) : 0,
      medianTuition: tuitionAmounts.length > 0
        ? tuitionAmounts.sort((a, b) => a - b)[Math.floor(tuitionAmounts.length / 2)]
        : 0,
      stemPrograms: successfulResults.filter(r => r.is_stem === true).length,
      nonStemPrograms: successfulResults.filter(r => r.is_stem !== true).length,
      highConfidence: successfulResults.filter(r => r.confidence_score === 'High').length,
      mediumConfidence: successfulResults.filter(r => r.confidence_score === 'Medium').length,
      lowConfidence: successfulResults.filter(r => r.confidence_score === 'Low').length
    };

    // Find highest and lowest tuition schools
    const sortedByTuition = successfulResults
      .filter(r => {
        const amount = r.tuition_amount?.replace(/[^0-9.-]/g, '');
        return amount && !isNaN(parseFloat(amount));
      })
      .sort((a, b) => {
        const aAmount = parseFloat(a.tuition_amount.replace(/[^0-9.-]/g, ''));
        const bAmount = parseFloat(b.tuition_amount.replace(/[^0-9.-]/g, ''));
        return bAmount - aAmount;
      });

    const highestTuition = sortedByTuition[0];
    const lowestTuition = sortedByTuition[sortedByTuition.length - 1];

    // Format data for the prompt - include remarks and content snippets for qualitative analysis
    const dataContext = data.map(r => {
      const parts = [
        `**${r.school_name}** - ${r.program_name}`,
        `  Tuition: ${r.tuition_amount || 'Not Found'} (${r.academic_year})`,
        r.cost_per_credit ? `  Cost per Credit: ${r.cost_per_credit}` : null,
        r.total_credits ? `  Total Credits: ${r.total_credits}` : null,
        r.is_stem ? `  STEM Designated: Yes` : null,
        r.confidence_score ? `  Data Confidence: ${r.confidence_score}` : null,
        r.remarks ? `  Remarks: ${r.remarks}` : null,
        r.source_url ? `  Source: ${r.source_url}` : null,
        r.raw_content ? `  Content Snippet: ${r.raw_content.substring(0, 300)}` : null
      ].filter(Boolean);
      return parts.join('\n');
    }).join('\n\n');

    const prompt = `
      You are a strategic market analyst preparing a concise executive summary for management review.
      Output should use markdown formatting for professional presentation with clean, readable tables.

      ## QUANTITATIVE METRICS
      - Total Programs Analyzed: ${metrics.totalPrograms}
      - Successful Data Extractions: ${metrics.successfulExtractions}
      - Average Tuition: $${metrics.avgTuition.toLocaleString()}
      - Median Tuition: $${metrics.medianTuition.toLocaleString()}
      - Tuition Range: $${metrics.minTuition.toLocaleString()} - $${metrics.maxTuition.toLocaleString()}
      - STEM Programs: ${metrics.stemPrograms} | Non-STEM: ${metrics.nonStemPrograms}
      - Data Quality: ${metrics.highConfidence} High / ${metrics.mediumConfidence} Medium / ${metrics.lowConfidence} Low confidence
      ${highestTuition ? `- Highest Tuition: ${highestTuition.school_name} (${highestTuition.tuition_amount})` : ''}
      ${lowestTuition ? `- Lowest Tuition: ${lowestTuition.school_name} (${lowestTuition.tuition_amount})` : ''}

      ## DETAILED PROGRAM DATA
      ${dataContext}

      ## INSTRUCTIONS - EXECUTIVE SUMMARY FORMAT

      Create a concise executive summary following this structure exactly. Use markdown formatting for tables and headers.

      # Executive Summary

      ## The Situation
      Write 2-3 sentences explaining what was analyzed and the main market insight about program segmentation.

      ## Market Segments
      Organize programs into 2-4 market tiers by tuition range and characteristics. For EACH segment:

      ### Segment Name (Tuition Range)
      Create a markdown table with these columns (NO alignment colons):
      | School | Tuition | Credits | $/Credit | Key Positioning |
      | --- | --- | --- | --- | --- |

      Add rows with data. After each table, add:

      **KEY TAKEAWAY:** [1-2 sentences explaining competitive implications]

      ## Key Metrics at a Glance
      Create a markdown table with rows (NO alignment colons):
      | Metric | Value | Implication |
      | --- | --- | --- |

      Include: Average Tuition, Tuition Range, Median Tuition, STEM %, Data Quality/Confidence. Keep implications to 1 sentence each.

      ## Market Themes
      Create a markdown table with rows (NO alignment colons):
      | Theme | Schools | Implication |
      | --- | --- | --- |

      Identify 4-6 repeating patterns (e.g., tuition lock, automatic scholarships, program flexibility, STEM designation, specialization).
      One sentence implications only.

      ## Bottom Line
      Write 3-4 sentences for senior leadership summarizing key findings and end with ONE strategic question for consideration.

      ## FORMATTING REQUIREMENTS - CRITICAL INSTRUCTIONS FOR MARKDOWN TABLES

      ⚠️ CRITICAL: Your markdown tables MUST follow this EXACT format. No exceptions.

      CORRECT TABLE FORMAT (use this):
      | Column A | Column B | Column C |
      | --- | --- | --- |
      | data | data | data |

      INCORRECT FORMATS TO AVOID (never use these):
      ❌ WRONG: | :--- | :--- | :--- |
      ❌ WRONG: | :---: | :---: | :---: |
      ❌ WRONG: | ---: | ---: | ---: |
      ❌ WRONG: | :------------ | :--------- | :---------- |

      The separator row MUST be: | --- | --- | --- | (one dash between pipes, NO colons)

      ADDITIONAL FORMATTING REQUIREMENTS:
      - Use proper markdown syntax for tables (pipe separators, headers with simple dashes only)
      - Use ## for section headers (they will render as HTML headers)
      - Use ### for subsection headers (segment names)
      - Use **bold** for emphasis (e.g., "KEY TAKEAWAY:", segment names)
      - Create clean, well-formatted markdown tables with SIMPLE SEPARATORS (just ---, no colons)
      - Use specific school names and actual numbers in all data points
      - One-sentence implications throughout
      - Data Quality: Describe as "High reliability" or "Medium reliability"
      - Output suitable for copying to business documents after markdown rendering
      - NO recommendations section - focus on analysis only
    `;

    // Execute with retry logic for transient failures
    let response;
    try {
      response = await withRetry(
        async () => {
          retryCount++;
          return await ai.models.generateContent({
            model: GEMINI_CONFIG.MODEL,
            contents: prompt,
          });
        },
        'summary'
      );
      retryCount = Math.max(0, retryCount - 1); // Subtract 1 (first attempt not a retry)
    } catch (error) {
      const aiResponseTime = Date.now() - aiStartTime;
      
      // Log AI usage failure
      await logAiUsage({
        endpoint: '/api/gemini/summary',
        model: GEMINI_CONFIG.MODEL,
        operationType: 'summary',
        aiResponseTime: aiResponseTime,
        retryCount: retryCount,
        success: false,
        error: error,
        requestMetadata: { projectId, dataCount: data.length }
      });

      throw error;
    }

    // Helper function to sanitize markdown table alignment colons
    const sanitizeMarkdownTables = (markdown) => {
      // Replace table separator rows with alignment colons with simple dashes
      // Changes | :--- | to | --- | and | :---: | to | --- | etc.
      return markdown.replace(/\|\s*:?-+:?\s*\|/g, '| --- |')
                     .replace(/\|\s*:?-+:?\s*$/gm, '| --- |');
    };

    const summary = sanitizeMarkdownTables(response.text || 'No analysis generated.');

    // Build the response object
    const responseData = {
      summary,
      metrics: {
        totalPrograms: metrics.totalPrograms,
        successfulExtractions: metrics.successfulExtractions,
        avgTuition: metrics.avgTuition,
        medianTuition: metrics.medianTuition,
        minTuition: metrics.minTuition,
        maxTuition: metrics.maxTuition,
        stemPrograms: metrics.stemPrograms,
        nonStemPrograms: metrics.nonStemPrograms,
        dataQuality: {
          high: metrics.highConfidence,
          medium: metrics.mediumConfidence,
          low: metrics.lowConfidence
        }
      }
    };

    // Cache the response if projectId provided
    if (projectId) {
      try {
        const cacheId = `summary-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        await sql`
          INSERT INTO project_summaries (id, project_id, data_hash, response)
          VALUES (${cacheId}, ${projectId}, ${dataHash}, ${JSON.stringify(responseData)})
          ON CONFLICT (project_id, data_hash) DO UPDATE
          SET response = ${JSON.stringify(responseData)},
              created_at = CURRENT_TIMESTAMP,
              expires_at = CURRENT_TIMESTAMP + interval '24 hours'
        `;
        logger.info(`Cached summary for project ${projectId}`);
      } catch (cacheError) {
        logger.warn('Failed to cache summary', { error: cacheError.message });
      }

      // Save to analysis history for audit trail (NEW: US2.5 enhancement)
      try {
        const historyId = `analysis-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        await sql`
          INSERT INTO project_analysis_history (id, project_id, analysis_content, metrics, data_hash, cached)
          VALUES (${historyId}, ${projectId}, ${summary}, ${JSON.stringify(responseData.metrics)}, ${dataHash}, ${wasCached})
        `;
        logger.info(`Saved analysis history for project ${projectId}`);
      } catch (historyError) {
        logger.warn('Failed to save analysis history', { error: historyError.message });
        // Don't fail the request if history save fails - it's a secondary feature
      }
    }

    // Log AI usage success
    const aiResponseTime = Date.now() - aiStartTime;
    await logAiUsage({
      endpoint: '/api/gemini/summary',
      model: GEMINI_CONFIG.MODEL,
      operationType: 'summary',
      response: response,
      aiResponseTime: aiResponseTime,
      retryCount: retryCount,
      success: true,
      requestMetadata: { projectId, dataCount: data.length },
      responseMetadata: {
        summary_length: summary.length,
        programs_analyzed: metrics.totalPrograms
      }
    });

    // Return the response
    res.json(responseData);

  } catch (error) {
    logger.error('Gemini API Error', error);
    
    // Log AI usage failure for unexpected errors (if not already logged)
    if (!wasCached) {
      const aiResponseTime = Date.now() - aiStartTime;
      await logAiUsage({
        endpoint: '/api/gemini/summary',
        model: GEMINI_CONFIG.MODEL,
        operationType: 'summary',
        aiResponseTime: aiResponseTime,
        retryCount: retryCount,
        success: false,
        error: error,
        requestMetadata: { projectId, dataCount: data?.length || 0 }
      });
    }

    res.status(500).json({
      summary: 'Failed to generate analysis. Please try again later.',
      error: error.message
    });
  }
});

// --- CHAT ENDPOINT (Streaming) ---
router.post('/chat', validateChat, async (req, res) => {
  const aiStartTime = Date.now();
  let retryCount = 0;
  let response = null;

  try {
    const { message, contextData, history } = req.body;

    const ai = getClient();

    // Enhanced context data with all relevant fields for Sprint 2
    const enhancedContext = contextData
      ?.filter(r => r.status === 'Success')
      .map(r => ({
        school: r.school_name,
        program: r.program_name,
        actualProgramName: r.actual_program_name || r.program_name,
        tuition: r.tuition_amount,
        statedTuition: r.stated_tuition || r.tuition_amount,
        calculatedTotalCost: r.calculated_total_cost || null,
        costPerCredit: r.cost_per_credit || null,
        totalCredits: r.total_credits || null,
        period: r.tuition_period,
        year: r.academic_year,
        programLength: r.program_length || null,
        isStem: r.is_stem === true,
        additionalFees: r.additional_fees || null,
        confidence: r.confidence_score || 'Medium',
        remarks: r.remarks || null,
        location: r.location_data?.address || 'Unknown',
        sourceUrl: r.source_url || null
      })) || [];

    // Calculate summary statistics for the AI
    const tuitionAmounts = enhancedContext
      .map(r => {
        const amount = r.tuition?.replace(/[^0-9.-]/g, '');
        return amount ? parseFloat(amount) : null;
      })
      .filter(a => a !== null && !isNaN(a));

    const avgTuition = tuitionAmounts.length > 0
      ? Math.round(tuitionAmounts.reduce((a, b) => a + b, 0) / tuitionAmounts.length)
      : 0;
    const minTuition = tuitionAmounts.length > 0 ? Math.min(...tuitionAmounts) : 0;
    const maxTuition = tuitionAmounts.length > 0 ? Math.max(...tuitionAmounts) : 0;
    const stemCount = enhancedContext.filter(r => r.isStem).length;
    const nonStemCount = enhancedContext.filter(r => !r.isStem).length;

    // Build source reference list for citations
    const sourceReferences = enhancedContext
      .filter(r => r.sourceUrl)
      .map((r, i) => `[${i + 1}] ${r.school} - ${r.program}: ${r.sourceUrl}`)
      .join('\n');

    const systemInstruction = `
    You are the "Academica AI Analyst". You are analyzing a specific dataset of university tuition fees with comprehensive data.

    DATASET SUMMARY:
    - Total Programs: ${enhancedContext.length}
    - Average Tuition: $${avgTuition.toLocaleString()}
    - Tuition Range: $${minTuition.toLocaleString()} - $${maxTuition.toLocaleString()}
    - STEM Programs: ${stemCount}
    - Non-STEM Programs: ${nonStemCount}

    DETAILED DATA:
    ${JSON.stringify(enhancedContext, null, 2)}

    SOURCE REFERENCES (use these for citations):
    ${sourceReferences || 'No source URLs available'}

    CAPABILITIES:
    - Answer questions about this specific dataset
    - Compare schools by tuition, program length, cost per credit, STEM status
    - Calculate averages, ranges, and statistics from the data
    - Identify trends and patterns (e.g., STEM vs non-STEM pricing)
    - Cite sources when discussing specific data points

    CITATION FORMAT:
    When mentioning specific data from a school, include a citation reference like this:
    - "Harvard charges $76,000 for their MBA program [Source: harvard.edu]"
    - Include confidence level when relevant: "(High confidence)"
    - If source URL is available, mention the domain

    GUIDELINES:
    - Be concise, professional, and data-driven
    - ALWAYS cite the school name when mentioning specific figures
    - Include confidence level (High/Medium/Low) when discussing data quality
    - If data has remarks, include relevant notes in parentheses
    - If asked about a school not in the list, say it is not in the current project scope
    - For comparisons, consider all available fields (tuition, credits, program length, STEM status)
    - End responses with a "Sources" section listing relevant source URLs when applicable
  `;

    const chat = ai.chats.create({
      model: GEMINI_CONFIG.MODEL,
      config: {
        systemInstruction
      },
      history: history || []
    });

    // Set up SSE (Server-Sent Events) for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = await chat.sendMessageStream(message);
    let fullResponse = '';

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();

    // Log AI usage success (note: streaming doesn't return usageMetadata in the same way)
    // We'll estimate tokens based on message length
    const aiResponseTime = Date.now() - aiStartTime;
    const estimatedInputTokens = Math.ceil((message.length + (history ? JSON.stringify(history).length : 0)) / 4);
    const estimatedOutputTokens = Math.ceil(fullResponse.length / 4);
    
    await logAiUsage({
      endpoint: '/api/gemini/chat',
      model: GEMINI_CONFIG.MODEL,
      operationType: 'chat',
      inputTokens: estimatedInputTokens,
      outputTokens: estimatedOutputTokens,
      aiResponseTime: aiResponseTime,
      retryCount: retryCount,
      success: true,
      requestMetadata: { 
        messageLength: message.length,
        contextDataCount: contextData?.length || 0,
        historyLength: history?.length || 0
      },
      responseMetadata: {
        responseLength: fullResponse.length
      }
    });

  } catch (error) {
    logger.error('Chat Error', error);

    // Log AI usage failure
    const aiResponseTime = Date.now() - aiStartTime;
    await logAiUsage({
      endpoint: '/api/gemini/chat',
      model: GEMINI_CONFIG.MODEL,
      operationType: 'chat',
      aiResponseTime: aiResponseTime,
      retryCount: retryCount,
      success: false,
      error: error,
      requestMetadata: { 
        messageLength: req.body?.message?.length || 0,
        contextDataCount: req.body?.contextData?.length || 0
      }
    });

    if (!res.headersSent) {
      res.status(500).json({
        error: 'Chat request failed',
        message: error.message
      });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
});

export default router;


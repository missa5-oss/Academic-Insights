import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';
import { validateExtraction, validateChat, validateSummary } from '../middleware/validation.js';
import { GEMINI_CONFIG } from '../config.js';
import logger from '../utils/logger.js';

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

// Initialize Gemini client
const getClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured in server environment');
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Extract complete tuition and program information in a single API call
 * Combines tuition, fees, credits, and program details for efficiency
 */
async function extractProgramInfo(ai, school, program) {
  const prompt = `
Search "${school}" "${program}" tuition site:.edu

CRITICAL: Only use .edu official sources. Ignore clearadmit, poets&quants, shiksha, collegechoice.

PROGRAM NAME VARIATIONS:
- If searching for "Part-Time MBA", also check: Professional MBA, Weekend MBA, Evening MBA, Working Professional MBA
- If searching for "Executive MBA", also check: EMBA, Exec MBA
- Schools may use different names for the same program type

RULES:
- tuition_amount = TOTAL PROGRAM COST (cost_per_credit × total_credits)
- Do NOT include the word "total" in tuition_amount, just the dollar amount
- Use IN-STATE rates, put out-of-state in remarks
- If not found on .edu site, status="Not Found"

OUTPUT - Return ONLY this JSON, no other text:
{"tuition_amount":"$XX,XXX","tuition_period":"full program","academic_year":"2024-2025","cost_per_credit":"$X,XXX","total_credits":"XX","program_length":"X years","actual_program_name":"name","is_stem":false,"additional_fees":null,"remarks":null,"status":"Success"}
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

  return {
    data: parsedData,
    response: response
  };
}

// --- TUITION EXTRACTION ENDPOINT ---
router.post('/extract', validateExtraction, async (req, res) => {
  try {
    const { school, program } = req.body;
    logger.info(`Starting extraction for: ${school} - ${program}`);

    const ai = getClient();

    // Single extraction call for all program information
    let extractionResult;
    try {
      extractionResult = await extractProgramInfo(ai, school, program);
    } catch (error) {
      logger.error('Extraction failed', error);
      return res.status(200).json({
        status: 'Failed',
        raw_content: `Failed to extract data: ${error.message}`
      });
    }

    const extractedData = extractionResult.data;

    // If program not found, return early
    if (extractedData.status === 'Not Found') {
      return res.json({
        tuition_amount: null,
        tuition_period: 'N/A',
        academic_year: '2025-2026',
        cost_per_credit: null,
        total_credits: null,
        program_length: null,
        actual_program_name: null,
        is_stem: false,
        additional_fees: null,
        remarks: null,
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

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const supportingChunks = response.candidates?.[0]?.groundingMetadata?.groundingSupports || [];

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

                // Extract actual page text content from supporting chunks
                let rawContent = '';

                // Method 1: Get text from supporting chunks (actual page content)
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
                        }
                    }
                }

                // Method 2: Fallback to web chunk text if available
                if (!rawContent && c.web?.text && c.web.text.trim().length > 10) {
                    rawContent = c.web.text.trim();
                }

                // Method 3: Fallback to segment text
                if (!rawContent && c.segment?.text && c.segment.text.trim().length > 10) {
                    rawContent = c.segment.text.trim();
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
                    url: c.web.uri,
                    raw_content: rawContent || `No extractable text content found from ${c.web.uri}. Please visit the URL directly to verify the data.`
                };
            });

        // Simple deduplication
        const uniqueUrls = new Set();
        validatedSources = webChunks.filter((item) => {
            if (uniqueUrls.has(item.url)) return false;
            uniqueUrls.add(item.url);
            return true;
        }).slice(0, 3); // Keep top 3 actual sources
        
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

    const result = {
      tuition_amount: formatCurrency(tuitionAmount),
      tuition_period: tuitionPeriod,
      academic_year: extractedData.academic_year || '2025-2026',
      cost_per_credit: formatCurrency(extractedData.cost_per_credit) || null,
      total_credits: extractedData.total_credits || null,
      program_length: extractedData.program_length || null,
      actual_program_name: extractedData.actual_program_name || null,
      is_stem: extractedData.is_stem === true ? true : false, // Default to false if not explicitly true
      additional_fees: formatCurrency(extractedData.additional_fees) || null,
      remarks: sanitizeForDatabase(extractedData.remarks) || null,
      confidence_score: confidenceScore,
      status: extractedData.status === 'Not Found' ? 'Not Found' : 'Success',
      source_url: primarySourceUrl,
      validated_sources: validatedSources,
      raw_content: sanitizedRawContent
    };

    logger.info(`Extraction success for: ${school} - ${program}`, {
      tuition: result.tuition_amount,
      program: result.actual_program_name,
      stem: result.is_stem,
      confidence: result.confidence_score,
      status: result.status
    });
    res.json(result);

  } catch (error) {
    logger.error('Extraction Error', error, { school, program });
    res.status(500).json({
      status: 'Failed',
      raw_content: 'Agent failed to retrieve data due to system error.',
      error: error.message
    });
  }
});

// --- LOCATION EXTRACTION ENDPOINT ---
router.post('/location', async (req, res) => {
  try {
    const { school, program } = req.body;

    if (!school || !program) {
      return res.status(400).json({ error: 'Missing required fields: school, program' });
    }

    const ai = getClient();

    const prompt = `Find the main campus address for ${school} offering the ${program}.`;

    // Execute with retry logic for transient failures
    const response = await withRetry(
      () => ai.models.generateContent({
        model: GEMINI_CONFIG.MODEL,
        contents: prompt,
        config: {
          tools: [{ googleMaps: {} }]
        }
      }),
      `location:${school}`
    );

    const candidate = response.candidates?.[0];
    const groundingChunks = candidate?.groundingMetadata?.groundingChunks;

    // Extract map data from grounding chunks
    if (groundingChunks && groundingChunks.length > 0) {
      const firstMap = groundingChunks.find((c) => c.web?.uri);

      if (firstMap) {
        const locationData = {
          address: firstMap.web?.title || 'Address Found via Google Maps',
          map_url: firstMap.web?.uri || '',
          latitude: null,
          longitude: null
        };
        return res.json(locationData);
      }
    }

    res.json(null);

  } catch (error) {
    logger.error('Maps Extraction Error', error);
    res.json(null);
  }
});

// --- EXECUTIVE SUMMARY ENDPOINT ---
router.post('/summary', validateSummary, async (req, res) => {
  try {
    const { data } = req.body;

    const ai = getClient();

    // Format data for the prompt - include remarks and content snippets for qualitative analysis
    const dataContext = data.map(r => {
      const parts = [
        `**${r.school_name}** - ${r.program_name}`,
        `  Tuition: ${r.tuition_amount || 'Not Found'} (${r.academic_year})`,
        r.remarks ? `  Remarks: ${r.remarks}` : null,
        r.raw_content ? `  Content Snippet: ${r.raw_content.substring(0, 300)}` : null
      ].filter(Boolean);
      return parts.join('\n');
    }).join('\n\n');

    const prompt = `
      You are a strategic market analyst for an educational institution specializing in competitive positioning analysis.

      Your task is to analyze how competitor universities position and differentiate their programs based on the content extracted from their official websites.

      Data from competitor websites:
      ${dataContext}

      Please provide a comprehensive analysis (3-4 paragraphs) focusing on:

      1. **Positioning & Messaging Patterns**: Analyze the remarks and content snippets to identify how schools position their programs. What themes emerge? (e.g., affordability, flexibility, prestige, ROI, career outcomes, specific specializations)

      2. **Similarities & Differences**: What common messaging do you see across programs? Where do schools differentiate themselves? Are there clusters of schools with similar positioning strategies?

      3. **Value Propositions**: Based on the content, what unique value propositions are schools emphasizing? Look for mentions of program features, outcomes, flexibility, support services, or special advantages.

      4. **Competitive Landscape Insights**: What does this tell us about the competitive landscape? Are there gaps or opportunities? Which positioning strategies seem most prevalent?

      Do NOT simply list highest/lowest prices. Focus on qualitative insights from the actual website content and messaging.

      Format the output as professional Markdown with section headers.
    `;

    // Execute with retry logic for transient failures
    const response = await withRetry(
      () => ai.models.generateContent({
        model: GEMINI_CONFIG.MODEL,
        contents: prompt,
      }),
      'summary'
    );

    const summary = response.text || 'No analysis generated.';
    res.json({ summary });

  } catch (error) {
    logger.error('Gemini API Error', error);
    res.status(500).json({
      summary: 'Failed to generate analysis. Please try again later.',
      error: error.message
    });
  }
});

// --- CHAT ENDPOINT (Streaming) ---
router.post('/chat', validateChat, async (req, res) => {
  try {
    const { message, contextData, history } = req.body;

    const ai = getClient();

    // Simplify context data for token efficiency
    const simplifiedContext = contextData
      ?.filter(r => r.status === 'Success')
      .map(r => ({
        school: r.school_name,
        program: r.program_name,
        tuition: r.tuition_amount,
        period: r.tuition_period,
        year: r.academic_year,
        location: r.location_data?.address || 'Unknown'
      })) || [];

    const systemInstruction = `
    You are the "Academica AI Analyst". You are analyzing a specific dataset of university tuition fees.

    CURRENT DATASET:
    ${JSON.stringify(simplifiedContext, null, 2)}

    ROLE:
    - Answer questions about this specific data.
    - Compare schools, prices, and locations.
    - If asked for averages, calculate them based strictly on the provided data.
    - Be concise, professional, and data-driven.
    - If the user asks about a school not in the list, say it is not in the current project scope.
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

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    logger.error('Chat Error', error);

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

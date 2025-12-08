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

// Initialize Gemini client
const getClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured in server environment');
  }
  return new GoogleGenAI({ apiKey });
};

// --- TUITION EXTRACTION ENDPOINT ---
router.post('/extract', validateExtraction, async (req, res) => {
  try {
    const { school, program } = req.body;

    const ai = getClient();

    const prompt = `
      Act as a strict tuition data extraction agent.

      Target: "${school}" "${program}"

      CRITICAL RULES:
      1. SOURCE VERIFICATION: You must ONLY extract data from the OFFICIAL university or business school website (e.g., domains ending in .edu or the official school domain). Do NOT use data from third-party aggregators, news sites, rankings (like US News), or blogs.
      2. MULTI-SOURCE VALIDATION: Attempt to find up to 2 distinct official pages to cross-reference the data (e.g., The "Tuition & Fees" Bursar page AND the "Program Admissions" page).
      3. IN-STATE PREFERENCE: If the website lists both "In-State" (Resident) and "Out-of-State" (Non-Resident) tuition, ALWAYS extract and calculate costs based on the IN-STATE (Resident) rate.
      4. CONFIDENCE SCORING: If you CANNOT find the "total_credits" (number of credits required for the program) in the text, you MUST set "confidence_score" to "Low".
      5. STATUS: If you cannot find the data on the official website, set "status" to "Not Found".

      Task:
      Search for the official tuition and fees for the target program for the latest available academic year (2024-2025 or 2025-2026).

      Output Requirement:
      Return ONLY a valid JSON object.
      Do not include markdown formatting (like \`\`\`json).

      JSON Schema:
      {
        "tuition_amount": "string or null (e.g. $55,000)",
        "tuition_period": "string (e.g. per year, per semester, per credit, full program)",
        "academic_year": "string (e.g. 2025-2026)",
        "cost_per_credit": "string or null (e.g. $1,200/credit)",
        "total_credits": "string or null (e.g. 30 credits)",
        "program_length": "string or null (e.g. 18 months, 2 years)",
        "remarks": "string or null (Any notes about price increases, frozen tuition, or specific disclaimers found)",
        "confidence_score": "High" | "Medium" | "Low",
        "status": "Success" | "Not Found",
        "raw_content": "string (A brief summary of the text found on the OFFICIAL page containing the price)"
      }
    `;

    // Execute with retry logic for transient failures
    const response = await withRetry(
      () => ai.models.generateContent({
        model: GEMINI_CONFIG.MODEL,
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }]
        }
      }),
      `extraction:${school}`
    );

    let jsonStr = response.text || '{}';

    // Improved JSON extraction: find the first { and the last }
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    } else {
      // Fallback cleanup if regex fails but backticks exist
      if (jsonStr.includes('```')) {
        jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '');
      }
    }

    jsonStr = jsonStr.trim();

    let data;
    try {
      data = JSON.parse(jsonStr);
    } catch (e) {
      logger.warn('JSON Parse Failed, falling back to raw text', { jsonStr });
      return res.status(200).json({
        status: 'Failed',
        raw_content: `Failed to parse AI response. Raw output: ${jsonStr}`
      });
    }

    // --- Source URL Logic ---
    // Priority: Grounding Metadata (Real Search Results) > AI JSON Output (Potential Hallucination)

    let validatedSources = [];
    let primarySourceUrl = '';

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;

    if (groundingChunks && groundingChunks.length > 0) {
        const webChunks = groundingChunks
            .filter((c) => c.web?.uri)
            .map((c) => ({
                title: c.web.title || 'Official Source',
                url: c.web.uri
            }));

        // Deduplicate URLs based on the URL string
        const uniqueUrls = new Set();
        validatedSources = webChunks.filter((item) => {
            if (uniqueUrls.has(item.url)) return false;
            uniqueUrls.add(item.url);
            return true;
        }).slice(0, 3); // Keep top 3 actual sources
    }

    // If grounding failed to provide sources (unlikely with search tool), fallback to JSON
    if (validatedSources.length === 0 && data.validated_sources && Array.isArray(data.validated_sources)) {
        validatedSources = data.validated_sources;
    }

    // Set primary source
    if (validatedSources.length > 0) {
        primarySourceUrl = validatedSources[0].url;
    } else {
        primarySourceUrl = 'https://google.com'; // Fallback if absolutely nothing found
    }

    const result = {
      tuition_amount: data.tuition_amount,
      tuition_period: data.tuition_period || 'N/A',
      academic_year: data.academic_year || '2025-2026',
      cost_per_credit: data.cost_per_credit,
      total_credits: data.total_credits,
      program_length: data.program_length,
      remarks: data.remarks,
      confidence_score: data.confidence_score || 'Medium',
      status: data.status === 'Not Found' ? 'Not Found' : 'Success',
      source_url: primarySourceUrl,
      validated_sources: validatedSources,
      raw_content: data.raw_content || 'No content summary provided.'
    };

    res.json(result);

  } catch (error) {
    logger.error('Extraction Error', error);
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

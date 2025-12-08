import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';

const router = Router();

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

// Initialize Gemini client
const getClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured in server environment');
  }
  return new GoogleGenAI({ apiKey });
};

// --- TUITION EXTRACTION ENDPOINT ---
router.post('/extract', async (req, res) => {
  try {
    const { school, program } = req.body;
    console.log(`[Extraction] Starting extraction for: ${school} - ${program}`);

    if (!school || !program) {
      return res.status(400).json({ error: 'Missing required fields: school, program' });
    }

    const ai = getClient();

    // Simplified prompt (hybrid: old structure + new improvements)
    const prompt = `
      Act as a strict tuition data extraction agent.

      Target: "${school}" "${program}"

      CRITICAL RULES:
      1. SOURCE VERIFICATION: You must ONLY extract data from the OFFICIAL university or business school website (e.g., domains ending in .edu or the official school domain). Do NOT use data from third-party aggregators, news sites, rankings (like US News), or blogs.
      2. MULTI-SOURCE VALIDATION: Attempt to find up to 2 distinct official pages to cross-reference the data (e.g., The "Tuition & Fees" Bursar page AND the "Program Admissions" page).
      3. PROGRAM EXISTENCE VERIFICATION: If you cannot find evidence that the program "${program}" actually exists at "${school}", or if the search results show the program does not exist, you MUST set "status" to "Not Found", set "confidence_score" to "Low", and return null values for tuition fields. Do NOT make up or estimate data for programs that don't exist. It is better to return "Not Found" than to provide incorrect data.
      4. IN-STATE TUITION PREFERENCE: If the website lists both "In-State" (Resident) and "Out-of-State" (Non-Resident) tuition, ALWAYS extract and calculate costs based on the IN-STATE (Resident) rate. Put the out-of-state tuition in the "remarks" field (e.g., "Out-of-state tuition: $62,175"). If only one tuition rate is shown, use that rate.
      5. TUITION ONLY (NO FEES): For uniform comparison across schools, calculate "calculated_total_cost" using ONLY tuition (cost_per_credit × total_credits). Do NOT include fees (technology fees, student services fees, etc.) in the total cost calculation. Put any additional fees in the "additional_fees" field separately. This ensures all schools are compared on tuition alone.
      6. CONFIDENCE SCORING: If you CANNOT find the "total_credits" (number of credits required for the program) in the text, you MUST set "confidence_score" to "Low". If you are uncertain about the program's existence or the data quality, also set "confidence_score" to "Low".
      7. STATUS: If you cannot find the data on the official website OR if the program does not appear to exist, set "status" to "Not Found".
      8. PROGRAM NAME: Extract the EXACT official program name as it appears on the school's website (e.g., "Master of Business Administration", "MBA in Finance", "Executive MBA"). If the program doesn't exist, set this to null.
      9. STEM DESIGNATION: Determine if the program is STEM-designated. Look for mentions of "STEM", "STEM-designated", "STEM OPT", "STEM-eligible", or mentions of STEM CIP codes (11.xxxx, 14.xxxx, 27.xxxx, 52.1301, etc.). If explicitly stated as STEM, set is_stem to true. If not explicitly stated, set is_stem to false.

      Task:
      Search for the official tuition and fees for the target program for the latest available academic year (2024-2025 or 2025-2026).

      Output Requirement:
      Return ONLY a valid JSON object.
      Do not include markdown formatting (like \`\`\`json).

      JSON Schema:
      {
        "stated_tuition": "string or null - The EXACT in-state tuition as stated on website (e.g., '$1,850 per credit', '$75,000 total')",
        "tuition_period": "string (e.g. per year, per semester, per credit, full program)",
        "academic_year": "string (e.g. 2025-2026)",
        "cost_per_credit": "string or null (e.g. $1,200/credit) - IN-STATE rate if both shown",
        "total_credits": "string or null (e.g. 30 credits)",
        "calculated_total_cost": "string or null - cost_per_credit × total_credits if both found (e.g., '$99,900'). IMPORTANT: Use TUITION ONLY, do NOT include fees in this calculation.",
        "program_length": "string or null (e.g. 18 months, 2 years)",
        "actual_program_name": "string or null (The EXACT official program name as displayed on the school website)",
        "is_stem": "boolean - true if explicitly stated as STEM-designated, false otherwise",
        "additional_fees": "string or null (Any additional mandatory fees mentioned)",
        "remarks": "string or null (Out-of-state tuition if different, tuition freezes, payment plans, or specific disclaimers found)",
        "confidence_score": "High" | "Medium" | "Low",
        "status": "Success" | "Not Found",
        "raw_content": "string (A brief summary of the text found on the OFFICIAL page containing the price)"
      }
    `;

    console.log(`[Extraction] Calling Gemini API with Google Search...`);
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });
    
    console.log(`[Extraction] Gemini API response received`);

    let data;
    let jsonStr = response.text || '{}';
    
    // Extract JSON from response (may contain markdown or extra text)
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
    
    try {
      data = JSON.parse(jsonStr);
      console.log(`[Extraction] Parsed JSON response successfully`);
    } catch (e) {
      console.error('[Extraction] JSON parsing failed:', e.message);
      console.error('[Extraction] Raw response:', jsonStr.substring(0, 500));
      return res.status(200).json({
        status: 'Failed',
        raw_content: `Failed to parse AI response. Raw output: ${jsonStr.substring(0, 500)}`
      });
    }

    // --- Source URL Logic ---
    // Priority: Grounding Metadata (Real Search Results) > AI JSON Output (Potential Hallucination)

    let validatedSources = [];
    let primarySourceUrl = '';

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const supportingChunks = response.candidates?.[0]?.groundingMetadata?.groundingSupports;

    if (groundingChunks && groundingChunks.length > 0) {
        console.log(`[Extraction] Found ${groundingChunks.length} grounding chunks`);
        
        const webChunks = groundingChunks
            .filter((c) => c.web?.uri)
            .map((c, index) => {
                // Extract actual page text content from supporting chunks
                let rawContent = '';
                
                // Method 1: Get text from supporting chunks (actual page content)
                if (supportingChunks && supportingChunks.length > 0) {
                    const relevantSupports = supportingChunks.filter(s => 
                        s.groundingChunkIndices?.includes(index)
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
                
                // Limit content length
                if (rawContent.length > 10000) {
                    rawContent = rawContent.substring(0, 10000) + '\n\n... [content truncated - showing first 10,000 characters]';
                }
                
                // Sanitize for database
                rawContent = sanitizeForDatabase(rawContent);
                
                return {
                    title: c.web.title || 'Official Source',
                    url: c.web.uri,
                    raw_content: rawContent || `No extractable text content found from ${c.web.uri}. Please visit the URL directly to verify the data.`
                };
            });

        // Simple deduplication (like old version)
        const uniqueUrls = new Set();
        validatedSources = webChunks.filter((item) => {
            if (uniqueUrls.has(item.url)) return false;
            uniqueUrls.add(item.url);
            return true;
        }).slice(0, 3); // Keep top 3 actual sources
        
        console.log(`[Extraction] Final validated sources: ${validatedSources.length}`);
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

    // Simple confidence scoring (like old version)
    let confidenceScore = data.confidence_score || 'Medium';
    if (!data.total_credits) {
        confidenceScore = 'Low';
    }

    // Determine the tuition_amount field:
    // If we have calculated_total_cost, use that; otherwise use stated_tuition
    let tuitionAmount = data.calculated_total_cost || data.stated_tuition || data.tuition_amount || null;
    let tuitionPeriod = data.tuition_period || 'N/A';
    
    // If we calculated the total, update the period
    if (data.calculated_total_cost && data.stated_tuition) {
        tuitionPeriod = 'full program (calculated)';
    }

    // Sanitize raw_content for database storage
    const sanitizedRawContent = sanitizeForDatabase(data.raw_content) || 'No content summary provided.';

    const result = {
      tuition_amount: tuitionAmount,
      stated_tuition: data.stated_tuition || null, // Original value from website
      tuition_period: tuitionPeriod,
      academic_year: data.academic_year || '2025-2026',
      cost_per_credit: data.cost_per_credit || null,
      total_credits: data.total_credits || null,
      calculated_total_cost: data.calculated_total_cost || null,
      program_length: data.program_length || null,
      actual_program_name: data.actual_program_name || null,
      is_stem: data.is_stem === true ? true : false, // Default to false if not explicitly true
      additional_fees: data.additional_fees || null,
      remarks: sanitizeForDatabase(data.remarks) || null,
      confidence_score: confidenceScore,
      status: data.status === 'Not Found' ? 'Not Found' : 'Success',
      source_url: primarySourceUrl,
      validated_sources: validatedSources,
      raw_content: sanitizedRawContent
    };

    console.log(`[Extraction] Success! Tuition: ${result.tuition_amount}, Stated: ${result.stated_tuition}, Program: ${result.actual_program_name}, STEM: ${result.is_stem}, Confidence: ${result.confidence_score}, Status: ${result.status}`);
    res.json(result);

  } catch (error) {
    console.error('[Extraction] Error:', error.message);
    console.error('[Extraction] Stack:', error.stack);
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

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }]
      }
    });

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
    console.error('Maps Extraction Error:', error);
    res.json(null);
  }
});

// --- EXECUTIVE SUMMARY ENDPOINT ---
router.post('/summary', async (req, res) => {
  try {
    const { data } = req.body;

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'Missing or invalid data array' });
    }

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

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const summary = response.text || 'No analysis generated.';
    res.json({ summary });

  } catch (error) {
    console.error('Gemini API Error:', error);
    res.status(500).json({
      summary: 'Failed to generate analysis. Please try again later.',
      error: error.message
    });
  }
});

// --- CHAT ENDPOINT (Streaming) ---
router.post('/chat', async (req, res) => {
  try {
    const { message, contextData, history } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Missing message' });
    }

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
      model: 'gemini-2.5-flash',
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
    console.error('Chat Error:', error);

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

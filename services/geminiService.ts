
import { GoogleGenAI, Chat } from "@google/genai";
import { ExtractionResult, ExtractionStatus, ConfidenceScore, LocationData } from "../types";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key missing");
  }
  return new GoogleGenAI({ apiKey });
};

// --- CHAT ANALYST SERVICE ---

export const createProjectChat = (data: ExtractionResult[]): Chat => {
  const ai = getClient();
  
  // Simplify data for token efficiency
  const contextData = data
    .filter(r => r.status === ExtractionStatus.SUCCESS)
    .map(r => ({
      school: r.school_name,
      program: r.program_name,
      tuition: r.tuition_amount,
      period: r.tuition_period,
      year: r.academic_year,
      location: r.location_data?.address || "Unknown"
    }));

  const systemInstruction = `
    You are the "Academica AI Analyst". You are analyzing a specific dataset of university tuition fees.
    
    CURRENT DATASET:
    ${JSON.stringify(contextData, null, 2)}
    
    ROLE:
    - Answer questions about this specific data.
    - Compare schools, prices, and locations.
    - If asked for averages, calculate them based strictly on the provided data.
    - Be concise, professional, and data-driven.
    - If the user asks about a school not in the list, say it is not in the current project scope.
  `;

  return ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction
    }
  });
};

// --- MAPS GROUNDING SERVICE ---

export const getCampusLocation = async (school: string, program: string): Promise<LocationData | null> => {
  try {
    const ai = getClient();
    
    // We specifically use Gemini Maps Grounding
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
      // Find the chunk with map data
      const mapChunk = groundingChunks.find((c: any) => c.web?.uri?.includes('google.com/maps') || (c.source && c.source.title));
      
      // Note: The structure of grounding chunks varies. We are looking for the URI and Title provided by the Maps tool.
      // In a real Maps Grounding response, we often get specific lat/lng in the grounding metadata or we parse the URI.
      
      // For this implementation, we will try to extract what we can from the grounding response or the text if structured data isn't perfect.
      
      // Let's rely on the first valid map link found
      const firstMap = groundingChunks.find((c: any) => c.web?.uri);
      
      if (firstMap) {
        return {
          address: firstMap.web?.title || "Address Found via Google Maps",
          map_url: firstMap.web?.uri || "",
          latitude: null, // Hard to extract accurately without specific schema, setting null for safety
          longitude: null
        };
      }
    }
    
    return null;

  } catch (error) {
    console.error("Maps Extraction Error:", error);
    return null;
  }
};


// --- EXISTING SERVICES ---

// Simulates analyzing the extracted data to provide a strategic summary
export const generateExecutiveSummary = async (data: ExtractionResult[]): Promise<string> => {
  try {
    const ai = getClient();

    // Format data for the prompt
    const dataContext = data.map(r => 
      `- ${r.school_name} (${r.program_name}): ${r.tuition_amount || 'Not Found'} (${r.academic_year}) - Confidence: ${r.confidence_score}`
    ).join('\n');

    const prompt = `
      You are an expert financial analyst for an educational institution. 
      Analyze the following competitor tuition data extracted from university websites.
      
      Data:
      ${dataContext}

      Please provide a concise executive summary (max 3 paragraphs) including:
      1. The range of tuition fees observed.
      2. Identification of the most expensive and least expensive options (excluding "Not Found").
      3. Any data quality warnings based on the confidence scores.
      
      Format the output as Markdown.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "No analysis generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Failed to generate analysis. Please try again later.";
  }
};

// Uses Gemini with Google Search to perform real extraction
export const simulateExtraction = async (school: string, program: string): Promise<Partial<ExtractionResult>> => {
  try {
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

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    let jsonStr = response.text || "{}";
    
    // Improved JSON extraction: find the first { and the last }
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    } else {
      // Fallback cleanup if regex fails but backticks exist
      if (jsonStr.includes("```")) {
        jsonStr = jsonStr.replace(/```json/g, "").replace(/```/g, "");
      }
    }
    
    jsonStr = jsonStr.trim();

    let data;
    try {
      data = JSON.parse(jsonStr);
    } catch (e) {
      console.warn("JSON Parse Failed, falling back to raw text", jsonStr);
      return {
        status: ExtractionStatus.FAILED,
        raw_content: `Failed to parse AI response. Raw output: ${jsonStr}`
      };
    }

    // --- Source URL Logic ---
    // Priority: Grounding Metadata (Real Search Results) > AI JSON Output (Potential Hallucination)
    
    let validatedSources: {title: string, url: string}[] = [];
    let primarySourceUrl = "";

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    
    if (groundingChunks && groundingChunks.length > 0) {
        const webChunks = groundingChunks
            .filter((c: any) => c.web?.uri)
            .map((c: any) => ({
                title: c.web.title || "Official Source",
                url: c.web.uri
            }));
        
        // Deduplicate URLs based on the URL string
        const uniqueUrls = new Set();
        validatedSources = webChunks.filter((item: any) => {
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
        primarySourceUrl = "https://google.com"; // Fallback if absolutely nothing found
    }

    return {
      tuition_amount: data.tuition_amount,
      tuition_period: data.tuition_period || "N/A",
      academic_year: data.academic_year || "2025-2026",
      cost_per_credit: data.cost_per_credit,
      total_credits: data.total_credits,
      program_length: data.program_length,
      remarks: data.remarks,
      confidence_score: (data.confidence_score as ConfidenceScore) || ConfidenceScore.MEDIUM,
      status: data.status === "Not Found" ? ExtractionStatus.NOT_FOUND : ExtractionStatus.SUCCESS,
      source_url: primarySourceUrl,
      validated_sources: validatedSources,
      raw_content: data.raw_content || "No content summary provided."
    };

  } catch (error) {
    console.error("Extraction Simulation Error:", error);
    return {
      status: ExtractionStatus.FAILED,
      raw_content: "Agent failed to retrieve data due to system error."
    };
  }
};

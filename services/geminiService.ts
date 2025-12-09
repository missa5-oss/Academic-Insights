import { ExtractionResult, ExtractionStatus, ConfidenceScore, LocationData } from "../types";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// --- CHAT ANALYST SERVICE ---

/**
 * Chat client that communicates with the backend Gemini API.
 * Maintains conversation history and project context for contextual responses.
 *
 * @example
 * ```typescript
 * const chat = new BackendChat(projectResults);
 * for await (const chunk of chat.sendMessageStream("Compare tuition costs")) {
 *   console.log(chunk.text);
 * }
 * ```
 */
export class BackendChat {
  private contextData: ExtractionResult[];
  private history: any[] = [];

  /**
   * Creates a new BackendChat instance.
   * @param data - Array of extraction results to use as context for the chat
   */
  constructor(data: ExtractionResult[]) {
    this.contextData = data;
  }

  /**
   * Updates the context data and resets conversation history.
   * Call this when switching between projects.
   * @param data - New array of extraction results
   */
  updateContext(data: ExtractionResult[]) {
    this.contextData = data;
    this.history = []; // Reset conversation history for new project
  }

  /**
   * Sends a message to the chat API and streams the response.
   * Uses Server-Sent Events (SSE) for real-time streaming.
   * @param message - The user's message to send
   * @yields Objects containing text chunks from the AI response
   * @throws Error if the API request fails or response is unreadable
   */
  async *sendMessageStream(message: string) {
    const response = await fetch(`${API_URL}/api/gemini/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        contextData: this.contextData,
        history: this.history
      })
    });

    if (!response.ok) {
      throw new Error(`Chat API error: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('Response body is not readable');
    }

    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');

      // Keep the last incomplete line in the buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);

          if (data === '[DONE]') {
            return;
          }

          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              yield { text: parsed.text };
            }
            if (parsed.error) {
              throw new Error(parsed.error);
            }
          } catch (e) {
            // Ignore JSON parse errors for non-JSON lines
          }
        }
      }
    }
  }
}

/**
 * Factory function to create a new chat instance for a project.
 * @param data - Array of extraction results to provide context for the chat
 * @returns A new BackendChat instance initialized with the provided data
 */
export const createProjectChat = (data: ExtractionResult[]): BackendChat => {
  return new BackendChat(data);
};

// --- MAPS GROUNDING SERVICE ---

/**
 * Fetches campus location data using Google Maps grounding.
 * @param school - The name of the school/university
 * @param program - The name of the program
 * @returns Location data including address and map URL, or null if not found
 */
export const getCampusLocation = async (school: string, program: string): Promise<LocationData | null> => {
  try {
    const response = await fetch(`${API_URL}/api/gemini/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ school, program })
    });

    if (!response.ok) {
      console.error('Location API error:', response.statusText);
      return null;
    }

    const data = await response.json();
    return data;

  } catch (error) {
    console.error("Maps Extraction Error:", error);
    return null;
  }
};


// --- EXECUTIVE SUMMARY SERVICE ---

/**
 * Generates an AI-powered executive summary of tuition data.
 * @param data - Array of extraction results to analyze
 * @returns A markdown-formatted summary string, or an error message if generation fails
 */
export const generateExecutiveSummary = async (data: ExtractionResult[]): Promise<string> => {
  try {
    const response = await fetch(`${API_URL}/api/gemini/summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data })
    });

    if (!response.ok) {
      console.error('Summary API error:', response.statusText);
      return "Failed to generate analysis. Please try again later.";
    }

    const result = await response.json();
    return result.summary || "No analysis generated.";

  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Failed to generate analysis. Please try again later.";
  }
};

// --- TUITION EXTRACTION SERVICE ---

/**
 * Extracts tuition information for a school/program combination using AI.
 * Uses Google Search grounding to find official tuition data from .edu domains.
 * @param school - The name of the school/university
 * @param program - The name of the program (e.g., "MBA", "Computer Science")
 * @returns Partial extraction result with tuition data, status, confidence, and source URLs
 */
export const simulateExtraction = async (school: string, program: string): Promise<Partial<ExtractionResult>> => {
  try {
    console.log(`[Frontend] Starting extraction for: ${school} - ${program}`);
    const response = await fetch(`${API_URL}/api/gemini/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ school, program })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Frontend] Extraction API error (${response.status}):`, errorText);
      return {
        status: ExtractionStatus.FAILED,
        raw_content: `API request failed with status ${response.status}: ${errorText}`
      };
    }

    const data = await response.json();
    console.log(`[Frontend] Extraction response received:`, { 
      status: data.status, 
      tuition: data.tuition_amount,
      stated_tuition: data.stated_tuition,
      confidence: data.confidence_score,
      sources: data.validated_sources?.length || 0 
    });

    // Map server status to ExtractionStatus enum
    let status: ExtractionStatus;
    if (data.status === "Not Found") {
      status = ExtractionStatus.NOT_FOUND;
    } else if (data.status === "Failed") {
      status = ExtractionStatus.FAILED;
    } else if (data.status === "Success") {
      status = ExtractionStatus.SUCCESS;
    } else {
      console.warn(`[Frontend] Unknown status received: ${data.status}, defaulting to SUCCESS`);
      status = ExtractionStatus.SUCCESS;
    }

    const result: Partial<ExtractionResult> = {
      // Tuition data
      tuition_amount: data.tuition_amount,
      stated_tuition: data.stated_tuition || null,
      tuition_period: data.tuition_period || "N/A",
      academic_year: data.academic_year || "2025-2026",
      
      // Detailed metadata
      cost_per_credit: data.cost_per_credit || null,
      total_credits: data.total_credits || null,
      calculated_total_cost: data.calculated_total_cost || null,
      program_length: data.program_length || null,
      additional_fees: data.additional_fees || null,
      remarks: data.remarks || null,
      
      // Program details
      actual_program_name: data.actual_program_name || null,
      is_stem: data.is_stem === true, // Default to false if not explicitly true
      
      // Confidence & validation
      confidence_score: (data.confidence_score as ConfidenceScore) || ConfidenceScore.MEDIUM,
      confidence_details: data.confidence_details || undefined,
      source_validation: data.source_validation || undefined,
      
      // Status & sources
      status: status,
      source_url: data.source_url,
      validated_sources: data.validated_sources || [],
      raw_content: data.raw_content || "No content summary provided."
    };

    console.log(`[Frontend] Extraction completed: Status=${status}, Confidence=${result.confidence_score}, STEM=${result.is_stem}`);
    return result;

  } catch (error) {
    console.error("[Frontend] Extraction Error:", error);
    return {
      status: ExtractionStatus.FAILED,
      raw_content: `Agent failed to retrieve data due to system error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

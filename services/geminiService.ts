import { ExtractionResult, ExtractionStatus, ConfidenceScore, LocationData } from "../types";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// --- CHAT ANALYST SERVICE ---

// Chat wrapper that mimics the Gemini Chat interface but calls backend API
export class BackendChat {
  private contextData: ExtractionResult[];
  private history: any[] = [];

  constructor(data: ExtractionResult[]) {
    this.contextData = data;
  }

  // Update context when switching projects
  updateContext(data: ExtractionResult[]) {
    this.contextData = data;
    this.history = []; // Reset conversation history for new project
  }

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

export const createProjectChat = (data: ExtractionResult[]): BackendChat => {
  return new BackendChat(data);
};

// --- MAPS GROUNDING SERVICE ---

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

export const simulateExtraction = async (school: string, program: string): Promise<Partial<ExtractionResult>> => {
  try {
    const response = await fetch(`${API_URL}/api/gemini/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ school, program })
    });

    if (!response.ok) {
      console.error('Extraction API error:', response.statusText);
      return {
        status: ExtractionStatus.FAILED,
        raw_content: `API request failed with status ${response.status}`
      };
    }

    const data = await response.json();

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
      source_url: data.source_url,
      validated_sources: data.validated_sources || [],
      raw_content: data.raw_content || "No content summary provided."
    };

  } catch (error) {
    console.error("Extraction Error:", error);
    return {
      status: ExtractionStatus.FAILED,
      raw_content: "Agent failed to retrieve data due to system error."
    };
  }
};

# Google Search Flow Diagram - Academic Insights Application

## Overview
This document explains how Google Search integration works in the Academic Insights application. The search is powered by Google's Gemini API with Google Search Grounding tool.

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER INTERACTION                                 │
│                    (ProjectDetail.tsx Component)                         │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               │ User clicks "Run Extraction" button
                               │ OR triggers batch processing
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    handleRunExtraction()                                 │
│                  (pages/ProjectDetail.tsx:99)                           │
│                                                                          │
│  Input: school_name, program_name                                       │
│  - Sets processing state                                                │
│  - Calls simulateExtraction()                                           │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               │ await simulateExtraction(school, program)
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    simulateExtraction()                                 │
│              (services/geminiService.ts:144)                            │
│                                                                          │
│  Step 1: Initialize Gemini Client                                       │
│  ┌─────────────────────────────────────────────┐                       │
│  │ const ai = getClient()                       │                       │
│  │ - Reads API_KEY from process.env.API_KEY    │                       │
│  │ - Creates GoogleGenAI instance               │                       │
│  └─────────────────────────────────────────────┘                       │
│                                                                          │
│  Step 2: Build Extraction Prompt                                        │
│  ┌─────────────────────────────────────────────┐                       │
│  │ Prompt includes:                            │                       │
│  │ - Target: school + program                  │                       │
│  │ - CRITICAL RULES:                           │                       │
│  │   1. Only official .edu domains             │                       │
│  │   2. Multi-source validation (2 pages)      │                       │
│  │   3. In-state tuition preference            │                       │
│  │   4. Confidence scoring rules               │                       │
│  │   5. Status handling                        │                       │
│  │ - JSON schema for output                    │                       │
│  └─────────────────────────────────────────────┘                       │
│                                                                          │
│  Step 3: Call Gemini API with Google Search Tool                        │
│  ┌─────────────────────────────────────────────┐                       │
│  │ ai.models.generateContent({                 │                       │
│  │   model: 'gemini-2.5-flash',                │                       │
│  │   contents: prompt,                         │                       │
│  │   config: {                                 │                       │
│  │     tools: [{ googleSearch: {} }]  ◄───────┼─── KEY: Enables       │
│  │   }                                         │      Google Search     │
│  │ })                                          │      Grounding         │
│  └─────────────────────────────────────────────┘                       │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               │ Gemini API processes request
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    GOOGLE SEARCH GROUNDING                              │
│              (Handled by Gemini API internally)                          │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │ 1. Gemini analyzes the prompt                                 │     │
│  │ 2. Determines search queries needed                           │     │
│  │ 3. Executes Google Search queries                             │     │
│  │ 4. Retrieves web page content from search results             │     │
│  │ 5. Filters for official university websites (.edu domains)    │     │
│  │ 6. Extracts relevant tuition information                       │     │
│  │ 7. Cross-references multiple sources                          │     │
│  │ 8. Generates structured JSON response                         │     │
│  └──────────────────────────────────────────────────────────────┘     │
│                                                                          │
│  Response Structure:                                                     │
│  {                                                                       │
│    text: "JSON string with extracted data",                             │
│    candidates: [{                                                       │
│      groundingMetadata: {                                               │
│        groundingChunks: [                                               │
│          { web: { uri: "...", title: "..." } },                        │
│          { web: { uri: "...", title: "..." } },                        │
│          ...                                                             │
│        ]                                                                 │
│      }                                                                   │
│    }]                                                                    │
│  }                                                                       │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               │ Response received
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    RESPONSE PROCESSING                                   │
│              (services/geminiService.ts:190-266)                         │
│                                                                          │
│  Step 1: Extract JSON from Response Text                                │
│  ┌─────────────────────────────────────────────┐                       │
│  │ - Remove markdown formatting (```json)      │                       │
│  │ - Extract JSON using regex: /\{[\s\S]*\}/  │                       │
│  │ - Parse JSON string                         │                       │
│  └─────────────────────────────────────────────┘                       │
│                                                                          │
│  Step 2: Extract Source URLs from Grounding Metadata                    │
│  ┌─────────────────────────────────────────────┐                       │
│  │ - Access: response.candidates[0]            │                       │
│  │            .groundingMetadata                │                       │
│  │            .groundingChunks                  │                       │
│  │ - Filter chunks with web.uri                │                       │
│  │ - Extract title and URL                     │                       │
│  │ - Deduplicate URLs                          │                       │
│  │ - Keep top 3 sources                        │                       │
│  └─────────────────────────────────────────────┘                       │
│                                                                          │
│  Step 3: Build ExtractionResult Object                                  │
│  ┌─────────────────────────────────────────────┐                       │
│  │ Maps extracted data to ExtractionResult:     │                       │
│  │ - tuition_amount                            │                       │
│  │ - tuition_period                            │                       │
│  │ - academic_year                             │                       │
│  │ - cost_per_credit                           │                       │
│  │ - total_credits                             │                       │
│  │ - program_length                            │                       │
│  │ - remarks                                   │                       │
│  │ - confidence_score (High/Medium/Low)        │                       │
│  │ - status (SUCCESS/NOT_FOUND/FAILED)         │                       │
│  │ - source_url (primary source)               │                       │
│  │ - validated_sources (array of sources)     │                       │
│  │ - raw_content                               │                       │
│  └─────────────────────────────────────────────┘                       │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               │ Returns Partial<ExtractionResult>
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    UPDATE RESULT IN DATABASE                             │
│                  (pages/ProjectDetail.tsx:105)                          │
│                                                                          │
│  ┌─────────────────────────────────────────────┐                       │
│  │ updateResult(item.id, {                    │                       │
│  │   ...data,                                  │                       │
│  │   extraction_date: new Date()               │                       │
│  │ })                                          │                       │
│  │                                             │                       │
│  │ This calls AppContext.updateResult()       │                       │
│  │ which makes API call to backend            │                       │
│  │ PUT /api/results/:id                       │                       │
│  │ and updates PostgreSQL database            │                       │
│  └─────────────────────────────────────────────┘                       │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               │ UI updates automatically
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         UI UPDATE                                        │
│                    (ProjectDetail.tsx)                                   │
│                                                                          │
│  - Processing indicator removed                                          │
│  - Result row updated with extracted data                               │
│  - Status badge updated (Success/Not Found/Failed)                      │
│  - Confidence score displayed                                            │
│  - Source URLs available in Audit Modal                                 │
└─────────────────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. **Google Search Tool Activation**
   - Location: `services/geminiService.ts:186`
   - Code: `tools: [{ googleSearch: {} }]`
   - This enables Gemini to use Google Search to find and retrieve web content

### 2. **Grounding Metadata**
   - Contains actual search results from Google
   - Provides source URLs and titles
   - Used to validate AI-extracted data
   - Prevents hallucination by linking to real sources

### 3. **Source Validation Priority**
   - **Priority 1**: Grounding metadata (real search results)
   - **Priority 2**: AI JSON output (fallback if grounding fails)

### 4. **Extraction Rules**
   - Only official university websites (.edu domains)
   - Multi-source validation (cross-reference 2 pages)
   - In-state tuition preference
   - Confidence scoring based on data completeness

## Data Flow Summary

1. **User Action** → Triggers extraction for a school/program
2. **Frontend** → Calls `simulateExtraction()` directly (client-side)
3. **Gemini API** → Uses Google Search tool to find official university websites
4. **Google Search** → Returns search results with web content
5. **Gemini AI** → Extracts tuition data from search results
6. **Response Processing** → Parses JSON and extracts source URLs
7. **Database Update** → Saves results to PostgreSQL via API
8. **UI Update** → Displays extracted data to user

## Important Notes

- **Client-Side Execution**: The Google Search happens client-side through the Gemini API, not through a backend proxy
- **API Key**: Stored in frontend `.env.local` as `GEMINI_API_KEY` (mapped to `API_KEY`)
- **Model**: Uses `gemini-2.5-flash` model
- **Rate Limiting**: Batch processing includes 1-second delay between requests
- **Error Handling**: Failed extractions return `FAILED` status with error message in `raw_content`

## How Many Search Queries Does Gemini Execute?

**Answer: The number is dynamically determined by Gemini and is not fixed.**

### Key Points:

1. **Dynamic Query Generation**: Gemini autonomously determines how many Google Search queries to execute based on:
   - The complexity of the prompt
   - The information requirements
   - Whether initial results are sufficient

2. **Your Prompt Requirements**: Your prompt specifically requests:
   - **MULTI-SOURCE VALIDATION**: "Attempt to find up to 2 distinct official pages"
   - This means Gemini will likely execute **multiple search queries** to find different pages (e.g., "Tuition & Fees" page AND "Program Admissions" page)

3. **Typical Behavior**: For a single extraction request, Gemini typically executes:
   - **1-3 initial search queries** to find relevant official university pages
   - **Additional follow-up queries** if needed to:
     - Find the specific program page
     - Locate the tuition/fees page
     - Cross-reference information from multiple sources
     - Verify data accuracy

4. **Example Query Sequence** (for "Johns Hopkins MBA"):
   - Query 1: "Johns Hopkins MBA tuition fees"
   - Query 2: "Johns Hopkins Carey Business School MBA program cost"
   - Query 3: "Johns Hopkins MBA admissions requirements credits" (if needed for total_credits)

5. **Quota Limits**: 
   - **1,500 grounded requests per day** (free tier)
   - Each `simulateExtraction()` call = 1 grounded request
   - Multiple search queries within a single request don't count as separate requests
   - Shared quota across all Gemini models in the same project

### What You Can Observe:

- **Grounding Chunks**: The `groundingMetadata.groundingChunks` array contains results from all search queries executed
- **Multiple Sources**: Your code extracts up to 3 unique source URLs, indicating multiple queries were likely executed
- **Response Time**: More complex searches (requiring multiple queries) take longer to complete

## Example Search Flow

For a search like "Johns Hopkins MBA":
1. Gemini generates search queries: "Johns Hopkins MBA tuition", "Johns Hopkins business school fees"
2. Google Search returns results from jhu.edu, carey.jhu.edu, etc.
3. Gemini filters to official .edu domains
4. Extracts tuition data from official pages
5. Cross-references multiple pages for validation
6. Returns structured JSON with source URLs


# Search Workflow Comparison: Flow Diagram vs Current Implementation

**Date:** December 8, 2025  
**Status:** Flow diagram is outdated - needs update

## Executive Summary

The `GOOGLE_SEARCH_FLOW_DIAGRAM.md` describes a **client-side implementation** where the frontend directly calls Gemini API, but the **current implementation uses a backend proxy pattern** for security. The flow diagram needs to be updated to reflect the actual architecture.

---

## Key Differences

### 1. **API Execution Location**

#### Flow Diagram (Outdated)
- ❌ **Client-Side Execution**: Google Search happens client-side through Gemini API
- ❌ **API Key Location**: Stored in frontend `.env.local` as `GEMINI_API_KEY`
- ❌ **Direct API Call**: Frontend calls Gemini API directly

#### Current Implementation (Actual)
- ✅ **Server-Side Execution**: Google Search happens on backend via Express API
- ✅ **API Key Location**: Stored in `server/.env` as `GEMINI_API_KEY` (never exposed to frontend)
- ✅ **Backend Proxy**: Frontend calls `/api/gemini/extract` endpoint, which proxies to Gemini API

---

### 2. **Data Flow**

#### Flow Diagram (Outdated)
```
User → Frontend (simulateExtraction) → Gemini API (client-side) → Google Search
```

#### Current Implementation (Actual)
```
User → Frontend (simulateExtraction) → Backend API (/api/gemini/extract) → Gemini API → Google Search
```

---

### 3. **Code Location**

#### Flow Diagram References (Outdated)
- `services/geminiService.ts:144` - Direct Gemini client initialization
- `services/geminiService.ts:186` - Direct API call with `tools: [{ googleSearch: {} }]`
- Frontend handles all Gemini API interactions

#### Current Implementation (Actual)
- **Frontend**: `services/geminiService.ts:186` - Makes HTTP request to backend
  ```typescript
  const response = await fetch(`${API_URL}/api/gemini/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ school, program })
  });
  ```

- **Backend**: `server/routes/gemini.js:118` - Handles Gemini API call
  ```javascript
  router.post('/extract', validateExtraction, async (req, res) => {
    const ai = getClient(); // Gets API key from server/.env
    const response = await withRetry(
      () => ai.models.generateContent({
        model: GEMINI_CONFIG.MODEL,
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }]
        }
      })
    );
  });
  ```

---

### 4. **Security Model**

#### Flow Diagram (Outdated)
- API key exposed to frontend (security risk)
- No backend validation
- Client-side rate limiting

#### Current Implementation (Actual)
- ✅ API key secured on backend only
- ✅ Server-side input validation (`validateExtraction` middleware)
- ✅ Server-side rate limiting (500 req/15min general, 100 req/15min AI endpoints)
- ✅ CORS protection for API endpoints

---

### 5. **Response Processing**

#### Flow Diagram (Outdated)
- Response processing happens in `services/geminiService.ts:190-266`
- Frontend extracts JSON and source URLs from response

#### Current Implementation (Actual)
- **Backend** (`server/routes/gemini.js:227-348`):
  - Parses JSON from Gemini response
  - Extracts source URLs from `groundingMetadata.groundingChunks`
  - Extracts page content from `groundingMetadata.groundingSupports`
  - Sanitizes content for database storage
  - Builds complete result object

- **Frontend** (`services/geminiService.ts:204-258`):
  - Receives pre-processed JSON from backend
  - Maps server response to `ExtractionResult` type
  - Handles status mapping (Success/Not Found/Failed)

---

### 6. **Prompt Structure**

#### Flow Diagram (Outdated)
- References old prompt structure with "CRITICAL RULES" section
- Mentions "MULTI-SOURCE VALIDATION: Attempt to find up to 2 distinct official pages"

#### Current Implementation (Actual)
- ✅ **Updated Prompt** (`server/routes/gemini.js:126-209`):
  - Business school-specific targeting
  - Multi-tier search strategy (Primary → Secondary → Validation)
  - Enhanced extraction rules
  - Better error handling
  - More robust confidence scoring

---

## What's Correct in the Flow Diagram

1. ✅ **Google Search Tool Activation**: Correctly describes `tools: [{ googleSearch: {} }]`
2. ✅ **Grounding Metadata Structure**: Correctly describes `groundingMetadata.groundingChunks`
3. ✅ **Source Validation Priority**: Priority 1 = Grounding metadata, Priority 2 = AI JSON output
4. ✅ **Dynamic Query Generation**: Correctly notes that Gemini determines number of queries dynamically
5. ✅ **UI Update Flow**: Correctly describes how results update in the UI

---

## What Needs Updating

### 1. **Data Flow Section** (Lines 195-204)
**Current (Outdated):**
```
1. User Action → Triggers extraction
2. Frontend → Calls simulateExtraction() directly (client-side)
3. Gemini API → Uses Google Search tool
```

**Should Be:**
```
1. User Action → Triggers extraction
2. Frontend → Calls simulateExtraction() which makes HTTP request to backend
3. Backend API → Receives request, validates input, calls Gemini API
4. Gemini API → Uses Google Search tool
5. Backend → Processes response, extracts sources, sanitizes data
6. Frontend → Receives processed result, updates UI
```

### 2. **Important Notes Section** (Lines 206-212)
**Current (Outdated):**
- ❌ "Client-Side Execution: The Google Search happens client-side"
- ❌ "API Key: Stored in frontend `.env.local`"

**Should Be:**
- ✅ "Server-Side Execution: The Google Search happens server-side via backend API"
- ✅ "API Key: Stored in `server/.env` (never exposed to frontend)"
- ✅ "Model: Uses `gemini-2.5-flash` model (configured in `server/config.js`)"
- ✅ "Rate Limiting: 500 req/15min general API, 100 req/15min AI endpoints"
- ✅ "Input Validation: Server-side validation via `validateExtraction` middleware"

### 3. **Code References**
**Current (Outdated):**
- `services/geminiService.ts:186` - Direct Gemini API call

**Should Be:**
- `services/geminiService.ts:186` - HTTP request to backend API
- `server/routes/gemini.js:118` - Backend endpoint that calls Gemini API
- `server/routes/gemini.js:214-223` - Actual Gemini API call with retry logic

### 4. **Response Processing Location**
**Current (Outdated):**
- `services/geminiService.ts:190-266` - Response processing

**Should Be:**
- `server/routes/gemini.js:227-348` - Backend response processing (JSON parsing, source extraction, sanitization)
- `services/geminiService.ts:204-258` - Frontend result mapping

---

## Architecture Benefits of Current Implementation

1. **Security**: API key never exposed to frontend
2. **Validation**: Server-side input validation prevents malformed requests
3. **Rate Limiting**: Centralized rate limiting on backend
4. **Error Handling**: Consistent error handling and logging on backend
5. **Retry Logic**: Automatic retry with exponential backoff for transient failures
6. **Content Sanitization**: Backend sanitizes content before database storage
7. **CORS Protection**: Backend controls which origins can access the API

---

## Recommendations

1. **Update Flow Diagram**: Rewrite `GOOGLE_SEARCH_FLOW_DIAGRAM.md` to reflect backend proxy architecture
2. **Update Code References**: Fix all file paths and line numbers to match current implementation
3. **Add Backend Details**: Document backend processing steps (validation, retry logic, sanitization)
4. **Security Section**: Add section explaining why backend proxy is used (API key protection)

---

## Current Workflow (Accurate)

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERACTION                          │
│              (pages/ProjectDetail.tsx)                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ User clicks "Run Extraction"
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              handleRunExtraction()                          │
│         (pages/ProjectDetail.tsx:111)                        │
│                                                              │
│  - Sets processing state                                    │
│  - Calls simulateExtraction(school, program)               │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ await simulateExtraction()
                           ▼
┌─────────────────────────────────────────────────────────────┐
│            simulateExtraction()                             │
│        (services/geminiService.ts:186)                      │
│                                                              │
│  Makes HTTP POST request to:                                │
│  ${API_URL}/api/gemini/extract                              │
│  Body: { school, program }                                 │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ HTTP Request
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              BACKEND API ENDPOINT                            │
│        POST /api/gemini/extract                              │
│        (server/routes/gemini.js:118)                          │
│                                                              │
│  Step 1: Input Validation                                   │
│  ┌─────────────────────────────────────┐                   │
│  │ validateExtraction middleware       │                   │
│  │ - Validates school/program names     │                   │
│  │ - Checks length limits               │                   │
│  └─────────────────────────────────────┘                   │
│                                                              │
│  Step 2: Initialize Gemini Client                           │
│  ┌─────────────────────────────────────┐                   │
│  │ const ai = getClient()                │                   │
│  │ - Reads GEMINI_API_KEY from           │                   │
│  │   process.env (server/.env)          │                   │
│  │ - Creates GoogleGenAI instance        │                   │
│  └─────────────────────────────────────┘                   │
│                                                              │
│  Step 3: Build Extraction Prompt                            │
│  ┌─────────────────────────────────────┐                   │
│  │ Robust business school-specific       │                   │
│  │ prompt with multi-tier search         │                   │
│  │ strategy                              │                   │
│  └─────────────────────────────────────┘                   │
│                                                              │
│  Step 4: Call Gemini API with Retry                        │
│  ┌─────────────────────────────────────┐                   │
│  │ withRetry(() =>                      │                   │
│  │   ai.models.generateContent({        │                   │
│  │     model: GEMINI_CONFIG.MODEL,      │                   │
│  │     contents: prompt,                 │                   │
│  │     config: {                         │                   │
│  │       tools: [{ googleSearch: {} }]    │                   │
│  │     }                                 │                   │
│  │   })                                  │                   │
│  │ )                                     │                   │
│  │ - Max 3 retries with exponential     │                   │
│  │   backoff                             │                   │
│  └─────────────────────────────────────┘                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ Gemini API processes request
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              GOOGLE SEARCH GROUNDING                        │
│        (Handled by Gemini API internally)                   │
│                                                              │
│  - Gemini analyzes prompt                                   │
│  - Executes Google Search queries                           │
│  - Retrieves web page content                               │
│  - Filters for official .edu domains                        │
│  - Extracts tuition information                             │
│  - Returns structured JSON + grounding metadata             │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ Response with grounding metadata
                           ▼
┌─────────────────────────────────────────────────────────────┐
│            BACKEND RESPONSE PROCESSING                      │
│        (server/routes/gemini.js:227-348)                     │
│                                                              │
│  Step 1: Extract JSON from Response                         │
│  ┌─────────────────────────────────────┐                   │
│  │ - Remove markdown formatting         │                   │
│  │ - Extract JSON using regex           │                   │
│  │ - Parse JSON string                  │                   │
│  └─────────────────────────────────────┘                   │
│                                                              │
│  Step 2: Extract Source URLs                                │
│  ┌─────────────────────────────────────┐                   │
│  │ - Access groundingMetadata           │                   │
│  │   .groundingChunks                    │                   │
│  │ - Filter chunks with web.uri         │                   │
│  │ - Extract page content from           │                   │
│  │   groundingSupports                   │                   │
│  │ - Sanitize content for database       │                   │
│  │ - Deduplicate URLs                    │                   │
│  │ - Keep top 3 sources                  │                   │
│  └─────────────────────────────────────┘                   │
│                                                              │
│  Step 3: Build Result Object                               │
│  ┌─────────────────────────────────────┐                   │
│  │ - Format currency values             │                   │
│  │ - Set confidence score               │                   │
│  │ - Determine tuition_amount           │                   │
│  │ - Sanitize raw_content               │                   │
│  │ - Build complete result object        │                   │
│  └─────────────────────────────────────┘                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ HTTP Response (JSON)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│            FRONTEND RESPONSE HANDLING                       │
│        (services/geminiService.ts:204-258)                   │
│                                                              │
│  - Receives pre-processed JSON from backend                 │
│  - Maps server status to ExtractionStatus enum              │
│  - Builds Partial<ExtractionResult> object                  │
│  - Returns result to caller                                 │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ Returns Partial<ExtractionResult>
                           ▼
┌─────────────────────────────────────────────────────────────┐
│            UPDATE RESULT IN DATABASE                        │
│        (pages/ProjectDetail.tsx:117)                         │
│                                                              │
│  updateResult(item.id, {                                   │
│    ...data,                                                 │
│    extraction_date: new Date()                              │
│  })                                                          │
│                                                              │
│  - Calls AppContext.updateResult()                          │
│  - Makes PUT /api/results/:id to backend                    │
│  - Updates PostgreSQL database                               │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ UI updates automatically
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    UI UPDATE                                 │
│              (pages/ProjectDetail.tsx)                        │
│                                                              │
│  - Processing indicator removed                              │
│  - Result row updated with extracted data                   │
│  - Status badge updated                                     │
│  - Confidence score displayed                               │
│  - Source URLs available in Audit Modal                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Conclusion

The flow diagram is **outdated** and describes an old client-side architecture. The current implementation uses a **secure backend proxy pattern** that:

1. Protects API keys
2. Validates input server-side
3. Handles rate limiting centrally
4. Provides retry logic for reliability
5. Sanitizes content before storage

**Action Required**: Update `GOOGLE_SEARCH_FLOW_DIAGRAM.md` to reflect the current backend proxy architecture.

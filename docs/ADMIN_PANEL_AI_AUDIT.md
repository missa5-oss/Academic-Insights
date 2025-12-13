# Admin Panel AI Usage Audit

**Date:** December 19, 2024  
**Auditor:** AI Assistant  
**Purpose:** Comprehensive audit of AI usage tracking and administration panel capabilities

---

## Executive Summary

The current administration panel provides basic system health monitoring and API analytics, but lacks detailed AI-specific observability. This audit identifies gaps in AI usage tracking, tool calling monitoring, failure rate analysis, and cost management.

**Key Findings:**
- ✅ Basic API logging exists
- ✅ System health monitoring functional
- ❌ No actual AI token usage tracking
- ❌ No tool calling (Google Search/Maps) success rate tracking
- ❌ Cost estimates are hardcoded, not based on actual usage
- ❌ No AI-specific failure rate analysis
- ❌ No breakdown by AI service type

---

## Current State Analysis

### 1. AI Systems in Use

#### 1.1 Gemini API Services
The application uses **Google Gemini 2.5 Flash** model for four distinct operations:

1. **Tuition Extraction** (`/api/gemini/extract`)
   - Model: `gemini-2.5-flash`
   - Tool: Google Search Grounding
   - Purpose: Extract tuition data from .edu websites
   - Frequency: High (one per school/program combination)

2. **Location Lookup** (`/api/gemini/location`)
   - Model: `gemini-2.5-flash`
   - Tool: Google Maps Grounding
   - Purpose: Find campus addresses
   - Frequency: Low (optional feature)

3. **Executive Summary** (`/api/gemini/summary`)
   - Model: `gemini-2.5-flash`
   - Tool: None (text generation only)
   - Purpose: Generate market analysis reports
   - Frequency: Medium (one per project analysis)

4. **Chat Assistant** (`/api/gemini/chat`)
   - Model: `gemini-2.5-flash`
   - Tool: None (context-aware chat)
   - Purpose: Answer questions about project data
   - Frequency: Variable (user-driven)

#### 1.2 Tool Usage
- **Google Search Grounding**: Used in extraction endpoint
- **Google Maps Grounding**: Used in location endpoint
- **No tool calling tracking**: Current system doesn't track tool call success/failure rates

---

### 2. Current Tracking Capabilities

#### 2.1 API Logging (`api_logs` table)
**What's Tracked:**
- HTTP method, path, status code
- Request duration (ms)
- IP address, user agent
- Request body (sanitized)
- Error messages (for 4xx/5xx)

**What's Missing:**
- AI-specific metrics (tokens, model used)
- Tool calling information
- AI response times (separate from HTTP duration)
- Cost per request

#### 2.2 System Health Monitoring
**What's Tracked:**
- Database connectivity and latency
- Memory usage (total, free, used, percentage)
- CPU load average
- Server uptime
- Platform and Node.js version

**Status:** ✅ Comprehensive

#### 2.3 Basic Metrics
**What's Tracked:**
- Total projects, results, conversations
- Extraction status breakdown
- Confidence score distribution
- Daily extraction counts
- API request counts by path

**What's Missing:**
- AI call counts by service type
- Token usage statistics
- Actual cost tracking
- Tool calling success rates

---

### 3. Current Cost Estimation

**Location:** `pages/AdminPanel.tsx:132-175`

**Current Implementation:**
```typescript
// Hardcoded estimates
const totalTokens = totalCalls * 5000;  // Fixed estimate
const totalCost = totalCalls * 0.005;    // Fixed $0.005 per call
```

**Issues:**
1. ❌ No actual token counting from Gemini API responses
2. ❌ No differentiation between input/output tokens
3. ❌ No cost calculation based on actual Gemini pricing
4. ❌ No tracking of Google Search/Maps API costs
5. ❌ Estimates don't account for different operation types (extraction vs chat vs summary)

**Gemini 2.5 Flash Pricing (as of 2024):**
- Input: ~$0.075 per 1M tokens
- Output: ~$0.30 per 1M tokens
- Google Search Grounding: Additional cost per search
- Google Maps Grounding: Additional cost per lookup

---

### 4. Failure Rate Analysis

#### 4.1 Current Tracking
**What's Tracked:**
- HTTP status codes (4xx, 5xx)
- Error messages in `api_logs.error_message`
- Recent errors endpoint (`/api/admin/errors`)

**What's Missing:**
- AI-specific failure reasons:
  - Rate limiting (429 errors)
  - API quota exhaustion
  - Invalid responses (JSON parsing failures)
  - Tool calling failures (Search/Maps not returning results)
  - Timeout errors
- Failure rate by AI operation type
- Retry attempt tracking
- Success rate trends over time

#### 4.2 Retry Logic
**Location:** `server/routes/gemini.js:54-76`

**Current Implementation:**
- Max retries: 3
- Exponential backoff with jitter
- Retryable errors: RESOURCE_EXHAUSTED, UNAVAILABLE, DEADLINE_EXCEEDED, INTERNAL

**What's Missing:**
- Retry attempt logging
- Success rate after retries
- Average retry count per operation type

---

### 5. Tool Calling Observability

#### 5.1 Google Search Grounding
**Current State:**
- Used in extraction endpoint
- No explicit success/failure tracking
- No metrics on:
  - Number of search results returned
  - Search result quality
  - Source validation success rate
  - Cases where search returns no .edu results

**What Should Be Tracked:**
- Search calls made
- Results returned (count)
- .edu domain results (count)
- Source validation success rate
- Average response time for search operations

#### 5.2 Google Maps Grounding
**Current State:**
- Used in location endpoint
- Returns null on failure (silent failure)
- No tracking of:
  - Lookup attempts
  - Success rate
  - Response times

**What Should Be Tracked:**
- Map lookup attempts
- Success rate
- Average response time
- Cases where location not found

---

### 6. Admin Panel UI Analysis

#### 6.1 Current Features
✅ System Health Dashboard
- Uptime, database status, memory, CPU
- Visual health indicators

✅ Database Statistics
- Row counts per table
- Table-level metrics

✅ Metrics Summary Cards
- Total projects, extractions, API requests
- Estimated AI cost (hardcoded)

✅ Charts
- Daily extractions (bar chart)
- Status distribution (pie chart)

✅ API Analytics
- Top endpoints
- Response codes
- Performance metrics

✅ Recent Errors
- Last 5 errors with details

#### 6.2 Missing Features
❌ **AI Usage Dashboard**
- Token usage over time
- Cost breakdown by service
- Model usage statistics
- Tool calling metrics

❌ **AI Failure Analysis**
- Failure rate by operation type
- Common error patterns
- Retry success rates
- Timeout analysis

❌ **Tool Calling Metrics**
- Google Search success rate
- Google Maps success rate
- Average results per search
- Source validation rates

❌ **Cost Management**
- Actual vs estimated costs
- Cost trends
- Cost per project
- Cost alerts/thresholds

❌ **Performance Analytics**
- AI response time trends
- Token usage efficiency
- Cache hit rates (for summaries)

---

## Recommendations

### Priority 1: Critical (Implement First)

1. **Create `ai_usage_logs` Table**
   - Track every AI API call
   - Store: tokens (input/output), model, endpoint, cost, duration, success/failure
   - Link to `api_logs` for correlation

2. **Extract Token Usage from Gemini Responses**
   - Gemini API returns `usageMetadata` with token counts
   - Capture: `promptTokenCount`, `candidatesTokenCount`, `totalTokenCount`
   - Store in `ai_usage_logs` table

3. **Track Tool Calling**
   - Log Google Search calls (count, success, results)
   - Log Google Maps calls (count, success)
   - Store in `ai_usage_logs` or separate `tool_usage_logs` table

4. **Calculate Actual Costs**
   - Use Gemini pricing: $0.075/1M input, $0.30/1M output
   - Add Google Search/Maps costs if applicable
   - Store per-request cost in `ai_usage_logs`

### Priority 2: High (Implement Next)

5. **AI Usage Dashboard in Admin Panel**
   - Token usage charts (daily, weekly, monthly)
   - Cost breakdown by service type
   - Model usage statistics
   - Tool calling success rates

6. **Failure Rate Analysis**
   - Failure rate by operation type
   - Error categorization (rate limit, timeout, parsing, etc.)
   - Retry success tracking
   - Trend analysis

7. **Performance Metrics**
   - AI response time tracking
   - Token efficiency metrics
   - Cache hit rates for summaries

### Priority 3: Medium (Nice to Have)

8. **Cost Alerts**
   - Daily/weekly cost thresholds
   - Email/notification when exceeded
   - Budget tracking per project

9. **Advanced Analytics**
   - Cost per project
   - Token usage per extraction
   - Efficiency trends (tokens per successful extraction)

10. **Export Capabilities**
    - Export AI usage reports (CSV/JSON)
    - Cost reports for billing
    - Performance reports

---

## Implementation Plan

See `ADMIN_PANEL_ENHANCEMENT_PLAN.md` for detailed implementation steps.

---

## Additional Ideas

### 1. AI Model Comparison
- Track performance metrics for different models (if you switch models)
- A/B testing capabilities
- Cost comparison between models

### 2. Rate Limit Monitoring
- Track rate limit usage
- Predict when limits will be hit
- Automatic throttling recommendations

### 3. Quality Metrics
- Track extraction quality (confidence scores over time)
- Source validation success rates
- User corrections/edits (indicates poor extractions)

### 4. Predictive Analytics
- Predict monthly costs based on usage trends
- Identify unusual usage patterns
- Capacity planning

### 5. Integration with External Tools
- Export to monitoring tools (Datadog, New Relic, etc.)
- Webhook notifications for critical events
- Slack/email alerts for failures

---

## Conclusion

The current admin panel provides a solid foundation for system monitoring, but lacks the depth needed for AI-specific observability. Implementing the Priority 1 recommendations will provide immediate value in understanding AI usage, costs, and failure patterns. The Priority 2 and 3 enhancements will transform the admin panel into a state-of-the-art AI operations dashboard.

**Estimated Implementation Time:**
- Priority 1: 2-3 days
- Priority 2: 3-4 days
- Priority 3: 2-3 days
- **Total: 7-10 days** for complete implementation


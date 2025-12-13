# Admin Panel Enhancement Plan: State-of-the-Art AI Observability

**Date:** December 19, 2024  
**Status:** Planning  
**Estimated Time:** 7-10 days

---

## Overview

This document outlines the implementation plan to transform the admin panel into a state-of-the-art AI observability dashboard with comprehensive tracking of AI usage, costs, tool calling, and failure rates.

---

## Phase 1: Database Schema Enhancements

### 1.1 Create `ai_usage_logs` Table

**Purpose:** Track every AI API call with detailed metrics

**Schema:**
```sql
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id TEXT PRIMARY KEY,
  api_log_id TEXT REFERENCES api_logs(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,  -- '/api/gemini/extract', '/api/gemini/chat', etc.
  model TEXT NOT NULL,     -- 'gemini-2.5-flash'
  operation_type TEXT NOT NULL,  -- 'extraction', 'chat', 'summary', 'location'
  
  -- Token Usage
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  
  -- Tool Usage
  tools_used JSONB,  -- [{'type': 'googleSearch', 'success': true, 'results_count': 3}]
  
  -- Cost
  input_cost DECIMAL(10, 6),   -- Calculated from input_tokens
  output_cost DECIMAL(10, 6),  -- Calculated from output_tokens
  tool_cost DECIMAL(10, 6),     -- Google Search/Maps costs
  total_cost DECIMAL(10, 6),
  
  -- Performance
  ai_response_time_ms INTEGER,  -- Time for AI to respond (separate from HTTP duration)
  retry_count INTEGER DEFAULT 0,
  
  -- Success/Failure
  success BOOLEAN NOT NULL,
  error_type TEXT,  -- 'rate_limit', 'timeout', 'parsing_error', 'tool_failure', etc.
  error_message TEXT,
  
  -- Metadata
  request_metadata JSONB,  -- School, program, project_id, etc.
  response_metadata JSONB,  -- Status, confidence_score, etc.
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_usage_endpoint ON ai_usage_logs(endpoint, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_operation ON ai_usage_logs(operation_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_success ON ai_usage_logs(success, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_cost ON ai_usage_logs(created_at DESC, total_cost);
```

**Implementation Location:** `server/db.js`

---

### 1.2 Create `tool_usage_logs` Table (Optional - can be in ai_usage_logs)

**Purpose:** Detailed tracking of tool calls (Google Search, Google Maps)

**Schema:**
```sql
CREATE TABLE IF NOT EXISTS tool_usage_logs (
  id TEXT PRIMARY KEY,
  ai_usage_log_id TEXT REFERENCES ai_usage_logs(id) ON DELETE CASCADE,
  tool_type TEXT NOT NULL,  -- 'googleSearch', 'googleMaps'
  success BOOLEAN NOT NULL,
  results_count INTEGER,
  response_time_ms INTEGER,
  error_message TEXT,
  metadata JSONB,  -- Search query, results, etc.
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Phase 2: Backend Implementation

### 2.1 Create AI Usage Logger Utility

**File:** `server/utils/aiLogger.js`

**Functions:**
```javascript
/**
 * Log AI API call with token usage and cost
 */
export async function logAiUsage({
  apiLogId,
  endpoint,
  model,
  operationType,
  inputTokens,
  outputTokens,
  toolsUsed,
  aiResponseTime,
  retryCount,
  success,
  errorType,
  errorMessage,
  requestMetadata,
  responseMetadata
}) {
  // Calculate costs
  const inputCost = (inputTokens / 1_000_000) * 0.075;  // $0.075 per 1M tokens
  const outputCost = (outputTokens / 1_000_000) * 0.30; // $0.30 per 1M tokens
  const toolCost = calculateToolCost(toolsUsed);
  const totalCost = inputCost + outputCost + toolCost;

  // Insert into ai_usage_logs
  await sql`
    INSERT INTO ai_usage_logs (...)
    VALUES (...)
  `;
}

/**
 * Extract token usage from Gemini response
 */
export function extractTokenUsage(response) {
  const usage = response.usageMetadata || {};
  return {
    inputTokens: usage.promptTokenCount || 0,
    outputTokens: usage.candidatesTokenCount || 0,
    totalTokens: usage.totalTokenCount || 0
  };
}

/**
 * Extract tool usage from Gemini response
 */
export function extractToolUsage(response) {
  const tools = [];
  const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
  
  if (groundingMetadata?.groundingChunks) {
    // Google Search was used
    tools.push({
      type: 'googleSearch',
      success: groundingMetadata.groundingChunks.length > 0,
      resultsCount: groundingMetadata.groundingChunks.length
    });
  }
  
  // Check for Google Maps
  if (groundingMetadata?.groundingChunks?.some(c => c.web?.uri?.includes('maps'))) {
    tools.push({
      type: 'googleMaps',
      success: true,
      resultsCount: 1
    });
  }
  
  return tools;
}

/**
 * Calculate tool costs
 */
function calculateToolCost(toolsUsed) {
  // Google Search: ~$0.005 per search (estimate)
  // Google Maps: ~$0.002 per lookup (estimate)
  let cost = 0;
  toolsUsed.forEach(tool => {
    if (tool.type === 'googleSearch') {
      cost += 0.005;
    } else if (tool.type === 'googleMaps') {
      cost += 0.002;
    }
  });
  return cost;
}
```

---

### 2.2 Update Gemini Routes to Log AI Usage

**File:** `server/routes/gemini.js`

**Changes Needed:**

1. **Extract Endpoint** (`/extract`):
```javascript
router.post('/extract', validateExtraction, async (req, res) => {
  const startTime = Date.now();
  let retryCount = 0;
  let aiUsageLog = null;

  try {
    const { school, program } = req.body;
    const ai = getClient();

    // Track retries
    const extractionResult = await withRetry(
      () => {
        retryCount++;
        return extractProgramInfo(ai, school, program);
      },
      `extract:${school}`
    );

    const response = extractionResult.response;
    const aiResponseTime = Date.now() - startTime;

    // Extract token usage
    const tokenUsage = extractTokenUsage(response);
    const toolsUsed = extractToolUsage(response);

    // Log AI usage (get apiLogId from request if available)
    aiUsageLog = await logAiUsage({
      endpoint: '/api/gemini/extract',
      model: GEMINI_CONFIG.MODEL,
      operationType: 'extraction',
      inputTokens: tokenUsage.inputTokens,
      outputTokens: tokenUsage.outputTokens,
      toolsUsed: toolsUsed,
      aiResponseTime: aiResponseTime,
      retryCount: retryCount - 1, // Subtract 1 (first attempt not a retry)
      success: true,
      requestMetadata: { school, program },
      responseMetadata: {
        status: extractedData.status,
        confidence_score: confidenceScore
      }
    });

    // ... rest of extraction logic
  } catch (error) {
    // Log failure
    await logAiUsage({
      endpoint: '/api/gemini/extract',
      model: GEMINI_CONFIG.MODEL,
      operationType: 'extraction',
      aiResponseTime: Date.now() - startTime,
      retryCount: retryCount - 1,
      success: false,
      errorType: categorizeError(error),
      errorMessage: error.message,
      requestMetadata: { school, program }
    });
    throw error;
  }
});
```

2. **Apply similar changes to:**
   - `/location` endpoint
   - `/summary` endpoint
   - `/chat` endpoint

---

### 2.3 Create Admin API Endpoints for AI Metrics

**File:** `server/routes/admin.js`

**New Endpoints:**

```javascript
/**
 * GET /api/admin/ai-usage
 * Get AI usage statistics
 */
router.get('/ai-usage', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const operationType = req.query.operationType; // Optional filter

    // Total usage
    const totalUsage = await sql`
      SELECT 
        COUNT(*) as total_calls,
        SUM(total_tokens) as total_tokens,
        SUM(total_cost) as total_cost,
        AVG(ai_response_time_ms)::INTEGER as avg_response_time,
        COUNT(*) FILTER (WHERE success = true) as success_count,
        COUNT(*) FILTER (WHERE success = false) as failure_count
      FROM ai_usage_logs
      WHERE created_at > NOW() - INTERVAL '${days} days'
      ${operationType ? sql`AND operation_type = ${operationType}` : sql``}
    `;

    // Usage by operation type
    const usageByOperation = await sql`
      SELECT 
        operation_type,
        COUNT(*) as calls,
        SUM(total_tokens) as tokens,
        SUM(total_cost) as cost,
        AVG(ai_response_time_ms)::INTEGER as avg_response_time,
        COUNT(*) FILTER (WHERE success = true)::FLOAT / COUNT(*) * 100 as success_rate
      FROM ai_usage_logs
      WHERE created_at > NOW() - INTERVAL '${days} days'
      GROUP BY operation_type
      ORDER BY calls DESC
    `;

    // Daily usage
    const dailyUsage = await sql`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as calls,
        SUM(total_tokens) as tokens,
        SUM(total_cost) as cost,
        COUNT(*) FILTER (WHERE success = false) as failures
      FROM ai_usage_logs
      WHERE created_at > NOW() - INTERVAL '${days} days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;

    // Tool usage statistics
    const toolUsage = await sql`
      SELECT 
        jsonb_array_elements(tools_used)->>'type' as tool_type,
        COUNT(*) as usage_count,
        COUNT(*) FILTER (WHERE (jsonb_array_elements(tools_used)->>'success')::boolean = true) as success_count
      FROM ai_usage_logs
      WHERE created_at > NOW() - INTERVAL '${days} days'
        AND tools_used IS NOT NULL
      GROUP BY tool_type
    `;

    // Error breakdown
    const errorBreakdown = await sql`
      SELECT 
        error_type,
        COUNT(*) as count
      FROM ai_usage_logs
      WHERE created_at > NOW() - INTERVAL '${days} days'
        AND success = false
      GROUP BY error_type
      ORDER BY count DESC
    `;

    res.json({
      summary: totalUsage[0],
      byOperation: usageByOperation,
      daily: dailyUsage,
      toolUsage: toolUsage,
      errors: errorBreakdown,
      period: `${days} days`
    });
  } catch (error) {
    logger.error('Failed to get AI usage', error);
    res.status(500).json({ error: 'Failed to retrieve AI usage' });
  }
});

/**
 * GET /api/admin/ai-costs
 * Get detailed cost breakdown
 */
router.get('/ai-costs', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;

    const costs = await sql`
      SELECT 
        DATE(created_at) as date,
        SUM(input_cost) as input_cost,
        SUM(output_cost) as output_cost,
        SUM(tool_cost) as tool_cost,
        SUM(total_cost) as total_cost,
        operation_type
      FROM ai_usage_logs
      WHERE created_at > NOW() - INTERVAL '${days} days'
      GROUP BY DATE(created_at), operation_type
      ORDER BY date DESC, operation_type
    `;

    res.json({ costs, period: `${days} days` });
  } catch (error) {
    logger.error('Failed to get AI costs', error);
    res.status(500).json({ error: 'Failed to retrieve AI costs' });
  }
});
```

---

## Phase 3: Frontend Implementation

### 3.1 Update Admin Panel Types

**File:** `pages/AdminPanel.tsx`

**Add New Interfaces:**
```typescript
interface AiUsageMetrics {
  summary: {
    total_calls: number;
    total_tokens: number;
    total_cost: number;
    avg_response_time: number;
    success_count: number;
    failure_count: number;
  };
  byOperation: Array<{
    operation_type: string;
    calls: number;
    tokens: number;
    cost: number;
    avg_response_time: number;
    success_rate: number;
  }>;
  daily: Array<{
    date: string;
    calls: number;
    tokens: number;
    cost: number;
    failures: number;
  }>;
  toolUsage: Array<{
    tool_type: string;
    usage_count: number;
    success_count: number;
  }>;
  errors: Array<{
    error_type: string;
    count: number;
  }>;
}

interface AiCostBreakdown {
  costs: Array<{
    date: string;
    input_cost: number;
    output_cost: number;
    tool_cost: number;
    total_cost: number;
    operation_type: string;
  }>;
  period: string;
}
```

---

### 3.2 Add AI Usage Dashboard Section

**File:** `pages/AdminPanel.tsx`

**New Component:**
```typescript
const [aiUsage, setAiUsage] = useState<AiUsageMetrics | null>(null);
const [aiCosts, setAiCosts] = useState<AiCostBreakdown | null>(null);

// Fetch AI usage data
const fetchAiUsage = async () => {
  try {
    const [usageRes, costsRes] = await Promise.all([
      fetch(`${API_URL}/api/admin/ai-usage?days=7`),
      fetch(`${API_URL}/api/admin/ai-costs?days=30`)
    ]);
    
    if (usageRes.ok) {
      setAiUsage(await usageRes.json());
    }
    if (costsRes.ok) {
      setAiCosts(await costsRes.json());
    }
  } catch (err) {
    console.error('Failed to fetch AI usage:', err);
  }
};

// Add to fetchAdminData
useEffect(() => {
  fetchAdminData();
  fetchAiUsage();
  const interval = setInterval(() => {
    fetchAdminData();
    fetchAiUsage();
  }, 30000);
  return () => clearInterval(interval);
}, []);
```

---

### 3.3 Create AI Usage Dashboard UI

**New Sections to Add:**

1. **AI Usage Overview Cards**
   - Total AI Calls
   - Total Tokens Used
   - Total Cost (Actual)
   - Success Rate
   - Avg Response Time

2. **Token Usage Chart**
   - Line chart showing daily token usage
   - Breakdown by input/output tokens

3. **Cost Breakdown Chart**
   - Stacked area chart: input cost, output cost, tool cost
   - Breakdown by operation type

4. **Operation Type Breakdown**
   - Bar chart: calls, tokens, cost per operation type
   - Success rate per operation type

5. **Tool Usage Metrics**
   - Google Search: usage count, success rate, avg results
   - Google Maps: usage count, success rate

6. **Failure Analysis**
   - Error type breakdown (pie chart)
   - Failure rate trends
   - Common error patterns

---

## Phase 4: Error Categorization

### 4.1 Create Error Categorization Function

**File:** `server/utils/aiLogger.js`

```javascript
export function categorizeError(error) {
  const message = error.message || '';
  const code = error.code || '';

  // Rate limiting
  if (message.includes('429') || message.includes('quota') || message.includes('rate limit')) {
    return 'rate_limit';
  }

  // Timeout
  if (message.includes('timeout') || message.includes('DEADLINE_EXCEEDED')) {
    return 'timeout';
  }

  // Parsing errors
  if (message.includes('parse') || message.includes('JSON')) {
    return 'parsing_error';
  }

  // Tool failures
  if (message.includes('tool') || message.includes('grounding')) {
    return 'tool_failure';
  }

  // API errors
  if (code.includes('UNAVAILABLE') || message.includes('503')) {
    return 'api_unavailable';
  }

  // Resource exhaustion
  if (code.includes('RESOURCE_EXHAUSTED')) {
    return 'resource_exhausted';
  }

  // Unknown
  return 'unknown';
}
```

---

## Phase 5: Testing

### 5.1 Unit Tests
- Test token extraction from Gemini responses
- Test cost calculations
- Test error categorization
- Test tool usage extraction

### 5.2 Integration Tests
- Test AI usage logging in all endpoints
- Test admin API endpoints
- Test data aggregation queries

### 5.3 Manual Testing
- Verify token counts match Gemini dashboard
- Verify costs are reasonable
- Test UI displays correctly
- Test real-time updates

---

## Phase 6: Documentation

### 6.1 Update Documentation
- Update `CLAUDE.md` with new AI tracking features
- Add API documentation for new endpoints
- Create user guide for admin panel

### 6.2 Add Comments
- Document all new functions
- Add JSDoc comments
- Update inline comments

---

## Implementation Checklist

### Database
- [ ] Create `ai_usage_logs` table
- [ ] Create indexes
- [ ] Test table creation
- [ ] Add migration script

### Backend
- [ ] Create `aiLogger.js` utility
- [ ] Update `/extract` endpoint
- [ ] Update `/location` endpoint
- [ ] Update `/summary` endpoint
- [ ] Update `/chat` endpoint
- [ ] Create `/api/admin/ai-usage` endpoint
- [ ] Create `/api/admin/ai-costs` endpoint
- [ ] Add error categorization
- [ ] Test all endpoints

### Frontend
- [ ] Add TypeScript interfaces
- [ ] Add state management
- [ ] Create AI Usage Overview cards
- [ ] Create Token Usage chart
- [ ] Create Cost Breakdown chart
- [ ] Create Operation Type breakdown
- [ ] Create Tool Usage section
- [ ] Create Failure Analysis section
- [ ] Test UI responsiveness
- [ ] Test real-time updates

### Testing
- [ ] Unit tests
- [ ] Integration tests
- [ ] Manual testing
- [ ] Performance testing

### Documentation
- [ ] Update `CLAUDE.md`
- [ ] Add API docs
- [ ] Create user guide
- [ ] Add code comments

---

## Estimated Timeline

- **Phase 1 (Database):** 1 day
- **Phase 2 (Backend):** 3-4 days
- **Phase 3 (Frontend):** 2-3 days
- **Phase 4 (Error Handling):** 0.5 days
- **Phase 5 (Testing):** 1 day
- **Phase 6 (Documentation):** 0.5 days

**Total: 7-10 days**

---

## Success Metrics

After implementation, you should be able to:

1. ✅ See actual token usage (not estimates)
2. ✅ See actual costs (not hardcoded estimates)
3. ✅ Track tool calling success rates
4. ✅ Analyze failure patterns
5. ✅ Monitor AI performance trends
6. ✅ Identify cost optimization opportunities
7. ✅ Set up alerts for unusual usage patterns

---

## Future Enhancements (Post-Implementation)

1. **Cost Alerts**: Email/Slack notifications when costs exceed thresholds
2. **Predictive Analytics**: Forecast future costs based on trends
3. **A/B Testing**: Compare different models/prompts
4. **Export Reports**: CSV/PDF exports for billing
5. **Integration**: Connect to external monitoring tools


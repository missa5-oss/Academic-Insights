# Sprint 2: AI Features Enhancement - Implementation Guide

**Duration**: Weeks 3-5
**Target Version**: v1.2.0
**Team Size**: 2-3 Backend + 1 AI Engineer
**Status**: 📋 Planning Complete

---

## Executive Summary

Sprint 2 transforms the AI analysis capabilities from basic extraction and qualitative analysis to a sophisticated, context-aware analytics platform. Focus areas: quantitative insights, conversation persistence, enhanced context, and source attribution.

---

## User Stories

### US2.1: Enhanced Executive Summary with Metrics & Citations (Priority: P0)

**Goal**: Replace qualitative-only analysis with balanced quantitative/qualitative insights and source citations

**Acceptance Criteria**:
- Summary includes statistical metrics (avg tuition, price ranges, STEM breakdown, confidence distribution)
- Each claim includes source attribution (e.g., "Yale MBA ($65,000, High confidence, 2 sources)")
- Response structured with clear sections (Market Overview, Competitive Positioning, Data Quality, Opportunities)
- Summary streamed in chunks for progressive rendering
- Results cached to avoid regeneration for unchanged data
- Analysis completes in < 5 seconds for 100 results

**Implementation Details**:

**Backend Changes** (`server/routes/gemini.js:563-604`):

1. Replace current prompt with structured analysis prompt:

```javascript
const summaryPrompt = `Analyze this tuition market data. Provide BOTH quantitative metrics AND qualitative insights.

QUANTITATIVE SECTION:
- Average tuition: $X
- Price range: $X - $Y (standard deviation: $Z)
- Tuition distribution: X% in low range, Y% in mid range, Z% in high range
- STEM programs: X%, Non-STEM: Y%
- Data quality: X% High confidence, Y% Medium, Z% Low
- Success rate: X% (successful extractions)

QUALITATIVE SECTION:
- Market positioning and competitive landscape
- Notable patterns and outliers
- Program pricing tiers and value propositions

CITATIONS:
Include specific schools/programs in analysis with confidence levels.
Example: "Yale MBA averages $65,000 (High confidence, 2025)"

Format as structured JSON with these sections: market_overview, statistics, competitive_positioning, data_quality, opportunities`;
```

2. Update response format to JSON:

```javascript
const result = await streamAnalysisJson(projectData, summaryPrompt);
// Returns: { market_overview, statistics, competitive_positioning, data_quality, opportunities }
```

3. Implement caching layer:

```javascript
// Check if data unchanged since last analysis
const dataHash = hashResults(results);
const cached = await sql`
  SELECT response FROM project_summaries
  WHERE project_id = ${projectId}
  AND data_hash = ${dataHash}
  AND created_at > now() - interval '24 hours'
`;

if (cached) return cached[0].response; // Use cached

// If not cached, generate new analysis
const analysis = await generateAnalysis(...);
await sql`INSERT INTO project_summaries (project_id, data_hash, response) VALUES ...`;
```

4. Implement streaming response:

```javascript
// Instead of generating full response at once, stream sections
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');

yield JSON.stringify({ section: 'market_overview', data: {...} });
yield JSON.stringify({ section: 'statistics', data: {...} });
// etc.
```

**Frontend Changes** (`services/geminiService.ts:155-175`):

```typescript
export async function* generateExecutiveSummaryStream(
  results: ExtractionResult[]
): AsyncGenerator<any, void, unknown> {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const response = await fetch(`${apiUrl}/api/gemini/summary-stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: results })
  });

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;

    const text = decoder.decode(value);
    const lines = text.split('\n').filter(line => line.trim());

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        yield data;
      }
    }
  }
}
```

**UI Changes** (`pages/ProjectDetail.tsx`):

```tsx
const handleRunAnalysis = async () => {
  setIsAnalyzing(true);
  setAiAnalysis({
    market_overview: '',
    statistics: '',
    competitive_positioning: '',
    data_quality: '',
    opportunities: ''
  });

  for await (const section of generateExecutiveSummaryStream(filteredResults)) {
    setAiAnalysis(prev => ({
      ...prev,
      [section.section]: section.data
    }));
  }
  setIsAnalyzing(false);
};
```

**Effort**: 6-8 hours

---

### US2.2: Expand Chat Context with Complete Data Fields (Priority: P0)

**Goal**: Provide chat with comprehensive data context for richer analysis

**Acceptance Criteria**:
- Chat context includes: school, program, tuition, location, STEM status, fees, confidence, version count
- Quick-reference summary shown in chat (X successful, Y pending, confidence %)
- Chat can answer: "Compare STEM vs non-STEM", "Which has lowest fees?", "Show trends"
- Context remains consistent across message exchanges
- All context data properly formatted and token-efficient

**Implementation Details**:

**Backend Changes** (`server/routes/gemini.js:614-646`):

Current:
```javascript
const simplifiedContext = results
  .slice(0, 100)
  .map(r => ({
    school: r.school_name,
    program: r.program_name,
    tuition: r.tuition_amount,
    location: address
  }));
```

Enhanced:
```javascript
const enhancedContext = {
  summary: {
    total: results.length,
    successful: results.filter(r => r.status === 'Success').length,
    pending: results.filter(r => r.status === 'Pending').length,
    notFound: results.filter(r => r.status === 'Not Found').length,
    failed: results.filter(r => r.status === 'Failed').length,
    confidenceDistribution: {
      high: results.filter(r => r.confidence_score === 'High').length,
      medium: results.filter(r => r.confidence_score === 'Medium').length,
      low: results.filter(r => r.confidence_score === 'Low').length
    },
    stemCount: results.filter(r => r.is_stem).length,
    nonStemCount: results.filter(r => !r.is_stem).length,
    priceRange: { min: minTuition, max: maxTuition, avg: avgTuition }
  },
  results: results
    .filter(r => r.status === 'Success')
    .slice(0, 100)
    .map(r => ({
      school: r.school_name,
      program: r.program_name,
      tuition: r.tuition_amount,
      fees: r.additional_fees || 'Not specified',
      costPerCredit: r.cost_per_credit,
      isStem: r.is_stem ? 'Yes' : 'No',
      confidence: r.confidence_score,
      year: r.academic_year,
      location: address,
      versions: r.extraction_version // count of versions available
    }))
};
```

**System Instruction Update** (`server/routes/gemini.js:626-638`):

```javascript
const systemInstruction = `You are the "Academica AI Analyst" - an expert in university tuition analysis.

AVAILABLE DATA:
You have access to comprehensive tuition data including:
- School/program names with STEM classification
- Tuition amounts and additional fees
- Cost per credit calculations
- Extraction confidence levels
- Geographic locations
- Historical version tracking

ANALYSIS CAPABILITIES:
- Compare schools and programs by tuition, fees, STEM status
- Analyze pricing patterns and outliers
- Calculate aggregates from the data (averages, ranges, distributions)
- Identify trends when multiple versions exist
- Assess data quality based on confidence scores
- Group results by STEM status, location, or other attributes

RESPONSE GUIDELINES:
- Base all answers strictly on provided data
- When comparing items, cite specific values and confidence levels
- Qualify uncertain data: "This program shows Medium confidence"
- If data incomplete: "X programs don't have fee information"
- For trends: Reference version dates and price changes
- Be concise, professional, data-focused
- If a school/program not in dataset, explicitly state: "Not in current dataset"
- Always consider data quality when making recommendations`;
```

**Effort**: 3-4 hours

---

### US2.3: Implement Chat Conversation Persistence (Priority: P1)

**Goal**: Save chat conversations to database so users can review and reference past discussions

**Acceptance Criteria**:
- Chat history persists across sessions and project switches
- Users can view conversation list with timestamps and message counts
- Conversations can be named/titled for easy reference
- Old conversations can be deleted
- Conversation restore shows full history on selection
- Performance: Load 10 conversations in < 500ms

**Database Schema** (`server/db.js`):

```sql
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_project_conversations(project_id, created_at DESC)
);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  tokens_used INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_conversation_messages(conversation_id, created_at)
);
```

**Backend API** (`server/routes/conversations.js`):

```javascript
// POST /api/conversations - Create new conversation
router.post('/', async (req, res) => {
  const { projectId, title } = req.body;
  const id = `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  await sql`
    INSERT INTO conversations (id, project_id, title)
    VALUES (${id}, ${projectId}, ${title || 'Untitled'})
  `;
  res.json({ id, projectId, title: title || 'Untitled' });
});

// GET /api/conversations/:projectId - List conversations
router.get('/:projectId', async (req, res) => {
  const conversations = await sql`
    SELECT id, title, message_count, last_message_at, created_at
    FROM conversations
    WHERE project_id = ${req.params.projectId}
    ORDER BY last_message_at DESC
  `;
  res.json(conversations);
});

// POST /api/conversations/:id/messages - Add message
router.post('/:id/messages', async (req, res) => {
  const { role, content, tokensUsed } = req.body;
  const msgId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  await sql`INSERT INTO conversation_messages (id, conversation_id, role, content, tokens_used)
    VALUES (${msgId}, ${req.params.id}, ${role}, ${content}, ${tokensUsed})`;

  // Update message count
  await sql`UPDATE conversations SET message_count = message_count + 1, last_message_at = CURRENT_TIMESTAMP
    WHERE id = ${req.params.id}`;

  res.json({ id: msgId, role, content });
});

// GET /api/conversations/:id/messages - Get conversation messages
router.get('/:id/messages', async (req, res) => {
  const messages = await sql`
    SELECT role, content, created_at FROM conversation_messages
    WHERE conversation_id = ${req.params.id}
    ORDER BY created_at ASC
  `;
  res.json(messages);
});

// DELETE /api/conversations/:id - Delete conversation
router.delete('/:id', async (req, res) => {
  await sql`DELETE FROM conversations WHERE id = ${req.params.id}`;
  res.json({ success: true });
});
```

**Frontend Integration** (`components/ChatAssistant.tsx`):

```tsx
// Add conversation management UI
const [conversations, setConversations] = useState<any[]>([]);
const [activeConversation, setActiveConversation] = useState<string | null>(null);
const [conversationList, setConversationListOpen] = useState(false);

const createConversation = async (title: string) => {
  const res = await fetch(`${API_URL}/api/conversations`, {
    method: 'POST',
    body: JSON.stringify({ projectId: projectId, title })
  });
  const { id } = await res.json();
  setActiveConversation(id);
  loadConversations();
};

const loadConversations = async () => {
  const res = await fetch(`${API_URL}/api/conversations/${projectId}`);
  const data = await res.json();
  setConversations(data);
};

const saveMessage = async (role: string, content: string) => {
  if (activeConversation) {
    await fetch(`${API_URL}/api/conversations/${activeConversation}/messages`, {
      method: 'POST',
      body: JSON.stringify({ role, content })
    });
  }
};

// UI: Show conversation list sidebar
// UI: Auto-save messages to current conversation
// UI: "New Conversation" button to start fresh
```

**Effort**: 6-8 hours

---

### US2.4: Add Chat Response Citations (Priority: P2)

**Goal**: Chat responses should cite specific schools/programs and confidence levels

**Acceptance Criteria**:
- Each claim references data: "Yale MBA costs $65,000 (High confidence, 2025)"
- Chat response highlights which schools were used
- Optional "View Source" button shows extraction details
- Citations link to audit modal when clicked
- 80% of significant claims include citations

**Implementation**:

**Updated System Instruction** (modify `server/routes/gemini.js:626-638`):

```javascript
const systemInstruction = `... [previous content] ...

CITATION REQUIREMENTS:
- When comparing specific schools: Include name, confidence level, and year
  Example: "Harvard MBA ($70k High confidence 2025) vs Yale ($65k Medium 2025)"
- When stating facts about data: Include the basis
  Example: "50% of programs are STEM (25 of 50)"
- When mentioning numbers: Show source confidence
  Example: "Average tuition is $55k (based on 80 High/Medium confidence results)"
- For trends: Reference version history
  Example: "Yale's MBA increased 5% from 2024 (v1) to 2025 (v2)"
- Quality caveats: "Limited confidence - only 2 sources" or "High confidence - 5 sources"`;
```

**Frontend Parsing** (`components/ChatAssistant.tsx`):

```typescript
// Extract citations from response
const extractCitations = (text: string) => {
  // Pattern: "School Name ($amount Confidence year)"
  const citationPattern = /([A-Z][a-z]+ [A-Z][a-z]*)\s*\(\$[\d,]+ (High|Medium|Low) confidence (\d{4})\)/g;
  return [...text.matchAll(citationPattern)].map(m => ({
    school: m[1],
    confidence: m[2],
    year: m[3],
    fullText: m[0]
  }));
};

// Highlight citations in rendered response
const highlightCitations = (text: string, citations: any[]) => {
  let result = text;
  citations.forEach(cite => {
    result = result.replace(
      cite.fullText,
      `<span class="citation" data-school="${cite.school}">${cite.fullText}</span>`
    );
  });
  return result;
};

// Click handler: Show source modal
const handleCitationClick = (school: string) => {
  const result = filteredResults.find(r => r.school_name === school);
  if (result) showAuditModal(result);
};
```

**Effort**: 4-5 hours

---

### US2.5: Implement Summary Streaming & Caching (Priority: P2)

**Goal**: Summary responds progressively and caches results to avoid regeneration

**Acceptance Criteria**:
- Summary sections appear as they're generated (progressive rendering)
- User sees "Generating..." progress indicators
- Identical projects reuse cached analysis (24-hour TTL)
- Cache invalidation when results change
- Stream completes in < 5 seconds even with 500 results
- Cache hit reduces analysis time from 5s to < 100ms

**Implementation**: See US2.1 for streaming/caching details

**Effort**: 4-5 hours (depends on US2.1 completion)

---

## Implementation Timeline

### Week 3 (Days 1-5)
- **Day 1-2**: Database schema (conversations) + API endpoints
- **Day 2-3**: Enhanced chat context + system instruction
- **Day 3-5**: Conversation persistence UI + message saving

### Week 4 (Days 6-10)
- **Day 6-7**: Enhanced summary prompt + metrics calculation
- **Day 7-9**: Summary streaming implementation
- **Day 9-10**: Frontend UI for streamed summary sections

### Week 5 (Days 11-15)
- **Day 11-12**: Chat response citations (parsing + highlighting)
- **Day 12-13**: Summary caching layer
- **Day 13-15**: Testing, refinement, documentation

---

## Success Criteria

**Core Deliverables** (v1.2.0):
- ✅ Executive summary includes quantitative metrics
- ✅ Chat context expanded with STEM, fees, confidence data
- ✅ Chat conversations persist to database
- ✅ Summary sections streamed progressively
- ✅ Responses cite specific schools with confidence levels
- ✅ Analysis results cached for performance

**Quality Standards**:
- ✅ All new endpoints tested with 100+ results
- ✅ Streaming works smoothly (< 5s for large datasets)
- ✅ Cache hits verified (50%+ hit rate expected)
- ✅ No TypeScript errors
- ✅ All UI responsive on mobile/tablet

**Performance Benchmarks**:
- ✅ Chat response: < 2 seconds per message
- ✅ Summary generation: < 5 seconds
- ✅ Summary cached access: < 100ms
- ✅ Load conversation list: < 500ms
- ✅ Database queries indexed for speed

---

## Files to Create

1. `server/routes/conversations.js` - Conversation CRUD endpoints
2. `SPRINT_2_IMPLEMENTATION.md` - This file

---

## Files to Modify

**Backend**:
- `server/routes/gemini.js` - Enhanced summary prompt, streaming, caching, context
- `server/db.js` - Add conversations tables

**Frontend**:
- `services/geminiService.ts` - Streaming support, citation extraction
- `components/ChatAssistant.tsx` - Conversation UI, persistence
- `pages/ProjectDetail.tsx` - Summary streaming, citation display

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Streaming breaks on slow networks | Implement fallback to full response if stream fails |
| Cache staleness causes stale analysis | Implement version-based cache invalidation |
| Conversation table grows large | Add pagination, archive old conversations |
| Citations don't match perfectly | Fuzzy matching for school name variations |
| Performance regression | Benchmark before/after with 1000+ results |

---

## Team Assignments (Recommended)

- **Backend Lead**: US2.1 (summary), US2.5 (caching)
- **Backend Engineer**: US2.2 (context), US2.3 (persistence)
- **Frontend Engineer**: US2.3 (UI), US2.4 (citations)
- **AI Engineer**: Support on prompt optimization

---

## Version Progression

- **v1.2.0 Target**: All 5 user stories complete
- **Minimum Viable**: US2.1 + US2.2 + US2.3 (most impact)
- **Nice-to-Have**: US2.4 + US2.5 (polish)

---

## Next Steps

1. ✅ Review implementation guide with team
2. ✅ Assign team members to user stories
3. ✅ Create detailed task breakdown in project management tool
4. ✅ Schedule daily standups for Sprint 2
5. ✅ Set up development database with new schema
6. ✅ Begin US2.3 (foundation for persistence features)

---

**Status**: Ready for Sprint 2 Kickoff
**Last Updated**: December 12, 2025

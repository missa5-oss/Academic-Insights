# Agentic Extraction System Proposal

## Executive Summary

This document explores transitioning Academic-Insights from a single-pass Gemini extraction approach to a **multi-agent architecture** using Google's Agent Development Kit (ADK). The goal: achieve smarter, more reliable tuition data extraction without requiring manual re-runs.

**Current Problem**: Grounding results are good but not always accurate due to:
- Single-pass extraction with no verification
- ~20% of extractions return empty grounding chunks (Google API limitation)
- No ability to cross-validate or self-correct
- Inconsistent confidence scoring

**Proposed Solution**: A multi-agent system with specialized agents that:
1. **Extract** data from official sources
2. **Verify** accuracy and completeness
3. **Reconcile** conflicting information
4. **Output** high-confidence, validated results

---

## Current Extraction Workflow Analysis

### How It Works Now (Single-Pass)

```
┌─────────────────────────────────────────────────────────────────┐
│                        CURRENT WORKFLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   User Input                 Gemini API                 Result   │
│   ───────────                ──────────                 ──────   │
│   School Name  ──────►  Single Prompt   ──────►  JSON Response   │
│   Program Name          + Google Search           + Sources      │
│                         Grounding                                │
│                                                                  │
│   Total Time: 3-8 seconds                                        │
│   Accuracy: ~75-85%                                              │
│   Manual Re-runs Required: ~15-25%                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Current Limitations Identified

| Issue | Impact | Root Cause |
|-------|--------|------------|
| Empty grounding chunks | ~20% of extractions have no source content | Google Search grounding API limitation |
| Program name variations | "Part-Time MBA" may be called "Professional MBA" | Hardcoded variations list is incomplete |
| Hallucination risk | AI may invent data when uncertain | No verification step to validate claims |
| Calculation mismatches | Stated tuition ≠ calculated total | No reconciliation logic |
| Confidence scoring unreliable | Based only on field presence | Doesn't verify data accuracy |
| School matching | May return data from wrong school | No cross-validation |

### Current Prompt Analysis

From [gemini.js:189-207](server/routes/gemini.js#L189-L207):

```javascript
const prompt = `
Search "${school}" "${program}" tuition site:.edu

CRITICAL: Only use .edu official sources. Ignore clearadmit, poets&quants...

PROGRAM NAME VARIATIONS:
- If searching for "Part-Time MBA", also check: Professional MBA, Weekend MBA...

RULES:
- tuition_amount = TOTAL PROGRAM COST (cost_per_credit × total_credits)
- Use IN-STATE rates, put out-of-state in remarks
- If not found on .edu site, status="Not Found"

OUTPUT - Return ONLY this JSON...
`;
```

**Strengths**: Concise, direct instructions, trusts Gemini's search
**Weaknesses**: No verification, no retry logic for bad results, single attempt

---

## Google Agent Development Kit (ADK) Overview

### What is ADK?

Google ADK is a framework for building multi-agent AI systems that can:
- Coordinate multiple specialized agents
- Share state between agents
- Execute agents sequentially or in parallel
- Implement verification and quality control patterns

### Key ADK Concepts for Our Use Case

| Concept | Description | Our Application |
|---------|-------------|-----------------|
| **LlmAgent** | AI-powered agents with model-driven decisions | Extractor, Verifier, Reconciler agents |
| **SequentialAgent** | Executes agents in order, sharing state | Extract → Verify → Reconcile pipeline |
| **ParallelAgent** | Runs agents concurrently | Multiple search strategies simultaneously |
| **AgentTool** | Wrap agent as a tool for another agent | Verifier can call Extractor for retry |
| **Shared State** | `context.state` for inter-agent communication | Pass extracted data between agents |
| **output_key** | Agent output saved to specific state key | `extractor_result`, `verification_result` |

### Generator-Critic Pattern (ADK Best Practice)

ADK documentation specifically recommends a **Generator-Critic pattern** for quality control:

```
┌──────────────────────────────────────────────────────────┐
│              GENERATOR-CRITIC PATTERN                    │
├──────────────────────────────────────────────────────────┤
│                                                          │
│   Generator Agent          Critic Agent                  │
│   ───────────────          ────────────                  │
│   Extracts data   ──────►  Reviews output                │
│   Saves to state           Checks accuracy               │
│                            Flags issues                  │
│                            Requests retry if needed      │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

This is exactly what we need for tuition extraction!

---

## Proposed Multi-Agent Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PROPOSED AGENTIC WORKFLOW                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────┐ │
│   │ SEARCHER    │    │ EXTRACTOR   │    │ VERIFIER    │    │ OUTPUT  │ │
│   │ AGENT       │───►│ AGENT       │───►│ AGENT       │───►│ AGENT   │ │
│   └─────────────┘    └─────────────┘    └─────────────┘    └─────────┘ │
│         │                  │                  │                  │      │
│         ▼                  ▼                  ▼                  ▼      │
│   - Multiple search   - Parse tuition   - Cross-check      - Format    │
│     strategies          data              calculations       JSON       │
│   - Find program      - Extract all     - Verify sources   - Set       │
│     variations          fields          - Flag issues        confidence │
│   - Rank sources      - Handle edge     - Request retry    - Return    │
│                         cases             if needed          result     │
│                                                                          │
│   Shared State: { search_results, extracted_data, verification, ... }   │
│                                                                          │
│   Total Time: 8-15 seconds (but higher accuracy)                         │
│   Target Accuracy: 90-95%                                                │
│   Manual Re-runs Required: <5%                                           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Agent Specifications

#### 1. Searcher Agent

**Purpose**: Find the best sources for tuition data

**Responsibilities**:
- Execute multiple search queries with program name variations
- Rank sources by reliability (.edu > official business school > others)
- Handle empty grounding chunks by retrying with alternative queries
- Return a ranked list of source URLs with snippets

**Inputs** (from state):
- `school_name`
- `program_name`

**Outputs** (to state):
- `search_results`: Array of sources with URLs, titles, snippets
- `program_variations_found`: Actual program names discovered
- `search_confidence`: How confident we are in the sources

**Search Strategy**:
```
Query 1: "{school}" "{program}" tuition site:.edu
Query 2: "{school}" "{program_variation_1}" tuition official
Query 3: "{school}" MBA graduate tuition fees site:{school_domain}
```

#### 2. Extractor Agent

**Purpose**: Extract structured tuition data from sources

**Responsibilities**:
- Parse tuition amounts from source content
- Extract all data fields (credits, cost per credit, program length, etc.)
- Handle various formats (per credit, per year, total program)
- Calculate totals when components are available

**Inputs** (from state):
- `search_results`: Sources from Searcher Agent
- `school_name`, `program_name`

**Outputs** (to state):
- `extracted_data`: Raw extracted JSON
- `extraction_notes`: Any ambiguities or uncertainties
- `calculation_method`: How total was computed

**Extraction Rules**:
- Prefer explicitly stated total program cost
- If not available, calculate: `cost_per_credit × total_credits`
- Always extract in-state rates (out-of-state in remarks)
- Note if STEM designation is explicitly stated

#### 3. Verifier Agent

**Purpose**: Validate extracted data for accuracy

**Responsibilities**:
- Cross-check calculations (stated vs. calculated total)
- Verify source reliability (is this the right school?)
- Flag inconsistencies for human review
- Request retry from Extractor if data quality is poor
- Determine final confidence score

**Inputs** (from state):
- `extracted_data`: From Extractor Agent
- `search_results`: Original sources
- `school_name`, `program_name`

**Outputs** (to state):
- `verification_result`: Pass/Fail/NeedsReview
- `verification_notes`: Explanation of any issues
- `confidence_score`: High/Medium/Low with reasoning
- `retry_requested`: Boolean (triggers re-extraction if true)

**Verification Checks**:
```
1. Math Check: Does cost_per_credit × total_credits ≈ tuition_amount?
2. Source Check: Is the URL from the correct school's domain?
3. Completeness Check: Are critical fields present?
4. Freshness Check: Is the academic year current (2024-2025 or 2025-2026)?
5. Plausibility Check: Is tuition in reasonable range for program type?
```

#### 4. Output Agent

**Purpose**: Format final result and determine confidence

**Responsibilities**:
- Consolidate verified data into final JSON format
- Set appropriate confidence score based on verification
- Include audit trail (sources, verification notes)
- Handle edge cases (Not Found, partial data)

**Inputs** (from state):
- `extracted_data`: Verified extraction
- `verification_result`: From Verifier Agent
- `search_results`: For source attribution

**Outputs**:
- Final JSON response matching current API contract

---

## Implementation Options

### Option A: Full ADK Implementation (Node.js/TypeScript)

**Approach**: Build complete multi-agent system using Google ADK

**Pros**:
- Full agent orchestration capabilities
- Built-in state management
- Proper agent hierarchy and delegation
- Future-proof architecture

**Cons**:
- Significant code rewrite
- New dependency (ADK)
- Learning curve for ADK patterns
- May require Python (better ADK support) or experimental TypeScript SDK

**Estimated Effort**: 40-60 hours

**Files to Create/Modify**:
```
server/
├── agents/
│   ├── index.js              # Agent orchestrator
│   ├── searcherAgent.js      # Source finding agent
│   ├── extractorAgent.js     # Data extraction agent
│   ├── verifierAgent.js      # Validation agent
│   └── outputAgent.js        # Formatting agent
├── routes/
│   └── gemini.js             # Update to use agent pipeline
└── package.json              # Add ADK dependencies
```

### Option B: Simulated Multi-Agent (Pure JavaScript)

**Approach**: Implement agent-like behavior without ADK framework

**Pros**:
- No new dependencies
- Works with existing Gemini API calls
- Incremental implementation possible
- Easier to debug and maintain

**Cons**:
- Manual state management
- No built-in orchestration
- More boilerplate code
- Not a "true" agent system

**Estimated Effort**: 25-35 hours

**Implementation Pattern**:
```javascript
// Simulated multi-agent extraction
async function agenticExtract(school, program) {
  const state = { school, program };

  // Stage 1: Search
  state.searchResults = await searcherAgent(state);

  // Stage 2: Extract
  state.extractedData = await extractorAgent(state);

  // Stage 3: Verify (with retry loop)
  let attempts = 0;
  do {
    state.verification = await verifierAgent(state);
    if (state.verification.retryRequested && attempts < 2) {
      state.extractedData = await extractorAgent(state, { retry: true });
    }
    attempts++;
  } while (state.verification.retryRequested && attempts < 3);

  // Stage 4: Format output
  return outputAgent(state);
}
```

### Option C: Hybrid - Enhanced Single Call with Verification

**Approach**: Keep single Gemini call but add verification step

**Pros**:
- Minimal code changes
- Quick to implement
- Maintains current performance
- Easy rollback

**Cons**:
- Not truly agentic
- Limited improvement potential
- Still single-pass extraction

**Estimated Effort**: 10-15 hours

**Implementation**:
```javascript
// Enhanced extraction with verification
async function enhancedExtract(school, program) {
  // Primary extraction (current approach)
  const extraction = await extractProgramInfo(ai, school, program);

  // Verification call
  const verification = await verifyExtraction(ai, extraction, school, program);

  if (verification.needsRetry) {
    // Retry with different search strategy
    const retry = await extractWithAlternativeStrategy(ai, school, program);
    return mergeResults(extraction, retry, verification);
  }

  return formatWithVerification(extraction, verification);
}
```

---

## Recommendation

### Recommended Approach: Option B (Simulated Multi-Agent)

**Rationale**:
1. **No new dependencies** - Uses existing Gemini API
2. **Incremental adoption** - Can implement one agent at a time
3. **Proven patterns** - Generator-Critic pattern works well
4. **Testable** - Each "agent" is a separate function
5. **Reversible** - Easy to roll back if needed

### Implementation Phases

#### Phase 1: Verification Agent (Week 1-2)
Add a verification step after extraction:
- Cross-check calculations
- Validate source URLs
- Set confidence score based on verification
- Flag for manual review if needed

**Expected Impact**: +5-10% accuracy improvement

#### Phase 2: Retry Logic (Week 2-3)
Implement intelligent retry:
- Detect low-confidence extractions
- Retry with alternative search queries
- Try program name variations automatically

**Expected Impact**: +5-10% accuracy improvement

#### Phase 3: Multi-Search Strategy (Week 3-4)
Parallel search queries:
- Multiple query variations
- Rank and merge results
- Handle empty grounding chunks

**Expected Impact**: Reduce empty chunk failures by 50%

#### Phase 4: Full Pipeline (Week 4-5)
Complete agent pipeline:
- Searcher → Extractor → Verifier → Output
- Shared state management
- Configurable retry limits
- Comprehensive audit trail

**Expected Impact**: Target 90-95% accuracy

---

## Technical Considerations

### API Cost Impact

| Approach | Gemini Calls per Extraction | Est. Cost Increase |
|----------|-----------------------------|--------------------|
| Current | 1 | Baseline |
| Option A (ADK) | 3-4 | +200-300% |
| Option B (Simulated) | 2-3 | +100-200% |
| Option C (Hybrid) | 2 | +100% |

### Performance Impact

| Approach | Est. Time per Extraction |
|----------|--------------------------|
| Current | 3-8 seconds |
| Option A (ADK) | 10-20 seconds |
| Option B (Simulated) | 8-15 seconds |
| Option C (Hybrid) | 6-12 seconds |

### Database Schema Updates

New fields needed for audit trail:
```sql
ALTER TABLE extraction_results ADD COLUMN IF NOT EXISTS
  agent_trace JSONB;  -- Full agent execution trace

ALTER TABLE extraction_results ADD COLUMN IF NOT EXISTS
  verification_notes TEXT;  -- Verifier agent notes

ALTER TABLE extraction_results ADD COLUMN IF NOT EXISTS
  retry_count INTEGER DEFAULT 0;  -- Number of extraction attempts

ALTER TABLE extraction_results ADD COLUMN IF NOT EXISTS
  search_strategies_used TEXT[];  -- Which queries were tried
```

---

## Success Metrics

### Primary Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Extraction Accuracy | ~80% | 90-95% | Spot-check vs. official sources |
| Manual Re-runs | ~20% | <5% | User-initiated retry rate |
| High Confidence Rate | ~50% | >75% | % of High confidence extractions |
| Empty Source Rate | ~20% | <10% | % with no grounding content |

### Secondary Metrics

| Metric | Measurement |
|--------|-------------|
| Average Extraction Time | Time from request to response |
| API Cost per Extraction | Gemini API calls × cost |
| Retry Success Rate | % of retries that improve result |
| Verification Accuracy | % of verification flags that are correct |

---

## Next Steps

1. **Create feature branch**: `feature/agentic-extraction`
2. **Implement Phase 1**: Add verification agent
3. **Test with known problematic schools**: Validate improvement
4. **Measure metrics**: Compare before/after accuracy
5. **Iterate**: Proceed to Phase 2-4 based on results

---

## Appendix: ADK Resources

- [Google ADK Documentation](https://google.github.io/adk-docs/)
- [Multi-Agent Systems Guide](https://google.github.io/adk-docs/agents/multi-agents/)
- [Tools Overview](https://google.github.io/adk-docs/tools/)
- [Generator-Critic Pattern](https://google.github.io/adk-docs/agents/multi-agents/#review-critique)

## Appendix: Current Code References

- Extraction endpoint: [server/routes/gemini.js:244-555](server/routes/gemini.js#L244-L555)
- Prompt definition: [server/routes/gemini.js:189-207](server/routes/gemini.js#L189-L207)
- Confidence scoring: [server/routes/gemini.js:432-440](server/routes/gemini.js#L432-L440)
- Source validation: [server/routes/gemini.js:355-418](server/routes/gemini.js#L355-L418)

# Agentic Extraction Architecture

This document provides visual diagrams of the Academic-Insights agentic extraction system using Mermaid.

As of Tuesday Dec 16 2025

## System Overview

```mermaid
flowchart TB
    subgraph Client["Frontend (React)"]
        UI[Project Detail UI]
        GS[geminiService.ts]
    end

    subgraph Server["Backend (Express)"]
        API["/api/gemini/extract"]

        subgraph Agents["Agent System"]
            EA[Extractor Agent]
            VA[Verifier Agent]
        end

        subgraph Utilities
            RT[Retry Logic]
            PV[Program Variations]
            JP[JSON Parser]
        end
    end

    subgraph External["External Services"]
        GM[Gemini AI Model]
        GS_API[Google Search Grounding]
        DB[(PostgreSQL)]
    end

    UI -->|"Extract Request"| GS
    GS -->|"POST /extract"| API
    API --> EA
    EA -->|"withRetry()"| RT
    RT -->|"generateContent()"| GM
    GM -->|"tools: googleSearch"| GS_API
    GS_API -->|"Grounding Chunks"| GM
    GM -->|"JSON Response"| EA
    EA -->|"Not Found?"| PV
    PV -->|"Try Variation"| EA
    EA -->|"Extracted Data"| VA
    VA -->|"Verify"| GM
    VA -->|"Verification Result"| API
    API -->|"Store Result"| DB
    API -->|"Response"| GS
    GS -->|"Update UI"| UI
```

## Extraction Flow (Detailed)

```mermaid
flowchart TD
    Start([POST /api/gemini/extract]) --> Init[Initialize Gemini Client]
    Init --> Extract[Call extractProgramInfo]

    subgraph Extractor["Extractor Agent"]
        Extract --> Prompt[Build Search Prompt]
        Prompt --> |"Search school + program site:.edu"| API_Call[Gemini API Call]
        API_Call --> |"tools: googleSearch"| Grounding[Google Search Grounding]
        Grounding --> Parse[Parse JSON Response]
        Parse --> Check{Status = Success?}
    end

    Check -->|No| Variations{Has Program Variations?}
    Variations -->|Yes| Retry[Try Alternative Name]
    Retry -->|"MAX 3 retries"| Extract
    Variations -->|No| NotFound[Return Not Found]

    Check -->|Yes| Sources[Extract Grounding Sources]
    Sources --> Content[Extract Source Content]
    Content --> Verify[Call Verifier Agent]

    subgraph Verifier["Verifier Agent"]
        Verify --> Math[Math Verification]
        Verify --> Source[Source Verification]
        Verify --> Complete[Completeness Check]
        Verify --> Plausible[Plausibility Check]
        Math & Source & Complete & Plausible --> AI_Verify[AI Verification]
        AI_Verify --> Confidence[Determine Confidence]
    end

    Confidence --> Build[Build Final Response]
    NotFound --> Build
    Build --> Store[(Store in PostgreSQL)]
    Store --> Return([Return to Client])
```

## Retry Logic with Exponential Backoff

```mermaid
flowchart LR
    subgraph Retry["withRetry() Function"]
        A[Attempt 1] -->|Fail| W1[Wait 1-2s]
        W1 --> B[Attempt 2]
        B -->|Fail| W2[Wait 2-4s]
        W2 --> C[Attempt 3]
        C -->|Fail| W3[Wait 4-8s]
        W3 --> D[Attempt 4]
        D -->|Fail| Error[Throw Error]

        A -->|Success| Done[Return Result]
        B -->|Success| Done
        C -->|Success| Done
        D -->|Success| Done
    end

    style A fill:#4CAF50
    style B fill:#FFC107
    style C fill:#FF9800
    style D fill:#F44336
```

## Program Variation Retry Strategy

```mermaid
flowchart TD
    Input["Part-Time MBA"] --> Lookup[Lookup in PROGRAM_VARIATIONS]

    subgraph Variations["Program Variations Map"]
        PT["part-time mba"] --> V1["Professional MBA"]
        PT --> V2["Weekend MBA"]
        PT --> V3["Evening MBA"]
        PT --> V4["Flex MBA"]
        PT --> V5["Working Professional MBA"]
    end

    Lookup --> Limit["Limit to MAX_VARIATION_RETRIES = 3"]
    Limit --> Try1[Try: Professional MBA]
    Try1 -->|Not Found| Try2[Try: Weekend MBA]
    Try2 -->|Not Found| Try3[Try: Evening MBA]
    Try3 -->|Not Found| Final[Return Original Not Found]

    Try1 -->|Found| Success[Return with variation note]
    Try2 -->|Found| Success
    Try3 -->|Found| Success

    style Success fill:#4CAF50
    style Final fill:#F44336
```

## Verifier Agent - Rule-Based Checks

```mermaid
flowchart TB
    Input[Extracted Data] --> V1 & V2 & V3 & V4

    subgraph V1["Math Verification"]
        M1[Parse tuition_amount]
        M2[Parse cost_per_credit]
        M3[Parse total_credits]
        M1 & M2 & M3 --> Calc["expected = cost × credits"]
        Calc --> Compare{"|tuition - expected| ≤ 5%?"}
        Compare -->|Yes| MP[PASS]
        Compare -->|No| MF[FAIL]
    end

    subgraph V2["Source Verification"]
        S1{Is .edu domain?}
        S1 -->|Yes| S2{Matches school name?}
        S2 -->|Yes| SP[PASS]
        S2 -->|No| SW[WARN]
        S1 -->|No| SF[FAIL]
    end

    subgraph V3["Completeness Check"]
        C1[Required: tuition, period, year]
        C2[Important: cost/credit, credits, length]
        C3[Optional: STEM, fees, remarks]
        C1 & C2 & C3 --> Score["Score = (req×50 + imp×35 + opt×15) / 100"]
    end

    subgraph V4["Plausibility Check"]
        P1{"$5K < tuition < $300K?"}
        P2{"$100 < cost/credit < $5K?"}
        P3{"20 < credits < 100?"}
        P1 & P2 & P3 --> PP[Plausibility Score]
    end

    MP & MF & SP & SW & SF & Score & PP --> Aggregate[Aggregate Results]
    Aggregate --> AI[AI Verification]
    AI --> Final[Final Confidence: High/Medium/Low]
```

## AI Verification Flow

```mermaid
sequenceDiagram
    participant VA as Verifier Agent
    participant GM as Gemini AI
    participant DB as Database

    VA->>VA: Collect rule-based results
    VA->>GM: Send verification prompt
    Note over GM: Review extracted data<br/>Check source content<br/>Identify red flags
    GM-->>VA: Return JSON verdict

    alt source_supports_data = true
        VA->>VA: Maintain/Increase confidence
    else source_supports_data = false
        VA->>VA: Decrease confidence
        VA->>VA: Set needs_review or retry
    end

    VA->>DB: Store verification_data
    VA-->>DB: Update verification_status
```

## Data Flow Through System

```mermaid
flowchart LR
    subgraph Input
        School[School Name]
        Program[Program Name]
    end

    subgraph Processing
        Extract[Extractor Agent]
        Verify[Verifier Agent]
    end

    subgraph Output
        subgraph Result["Extraction Result"]
            TD[Tuition Data]
            VS[Validated Sources]
            VD[Verification Data]
            CS[Confidence Score]
        end
    end

    School & Program --> Extract
    Extract -->|"JSON + Grounding"| Verify
    Verify --> TD & VS & VD & CS
```

## Confidence Score Determination

```mermaid
flowchart TD
    Start[Start Verification] --> RB{All Rule-Based<br/>Checks Pass?}

    RB -->|Yes| AI{AI Says Source<br/>Supports Data?}
    RB -->|No| Issues{How Many Issues?}

    AI -->|Yes| High[HIGH Confidence]
    AI -->|No| Medium1[MEDIUM Confidence]

    Issues -->|"≥3 issues"| Retry[retry_recommended]
    Issues -->|"1-2 issues"| Review[needs_review]

    Retry --> Low[LOW Confidence]
    Review --> Medium2[MEDIUM Confidence]

    style High fill:#4CAF50
    style Medium1 fill:#FFC107
    style Medium2 fill:#FFC107
    style Low fill:#F44336
```

## Database Schema (Verification Fields)

```mermaid
erDiagram
    extraction_results {
        text id PK
        text project_id FK
        text school_name
        text program_name
        text tuition_amount
        text status
        text confidence_score
        jsonb validated_sources
        jsonb verification_data
        text verification_status
        int retry_count
        timestamp extracted_at
    }

    projects ||--o{ extraction_results : contains
```

## Component Dependencies

```mermaid
graph TB
    subgraph Server["server/"]
        config[config.js]
        gemini[routes/gemini.js]
        verifier[agents/verifierAgent.js]
        logger[utils/logger.js]
        db[db.js]
    end

    subgraph External
        genai["@google/genai"]
        neon["@neondatabase/serverless"]
    end

    gemini --> config
    gemini --> verifier
    gemini --> logger
    gemini --> db
    verifier --> config
    verifier --> logger
    gemini --> genai
    db --> neon
```

## Error Handling Flow

```mermaid
flowchart TD
    API[API Call] --> Try{Try Extraction}

    Try -->|Success| Parse{Parse JSON}
    Try -->|Error| Retry{Retryable Error?}

    Retry -->|"429, 503, timeout"| Backoff[Exponential Backoff]
    Backoff --> Try
    Retry -->|"Other Error"| Fail[Return Failed Status]

    Parse -->|Valid| Verify[Run Verification]
    Parse -->|Invalid| Extract_Fail[Return Failed Status]

    Verify --> Store[Store Result]
    Fail --> Store
    Extract_Fail --> Store

    style Fail fill:#F44336
    style Extract_Fail fill:#F44336
```

## Summary Statistics

| Component | Purpose | Key Functions |
|-----------|---------|---------------|
| **Extractor Agent** | Extract tuition data from web | `extractProgramInfo()` |
| **Verifier Agent** | Validate extraction accuracy | `verifyExtraction()` |
| **Retry Logic** | Handle transient failures | `withRetry()` |
| **Program Variations** | Alternative name lookup | `getProgramVariations()` |
| **AI Verification** | Intelligent data validation | `performAIVerification()` |

## Configuration Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `MAX_VARIATION_RETRIES` | 3 | Limit program name retry attempts |
| `RETRY_CONFIG.maxRetries` | 3 | Max API call retries |
| `RETRY_CONFIG.baseDelayMs` | 1000 | Initial backoff delay |
| `RETRY_CONFIG.maxDelayMs` | 10000 | Maximum backoff delay |

---

*Last Updated: December 16, 2025*
*Version: Phase 2 - Verification Agent Complete*

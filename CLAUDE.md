# CLAUDE.md

Guidance for Claude Code when working on Academic-Insights repository.

## Project Overview

**Academic-Insights** is a React-based web application for extracting, analyzing, and comparing university tuition data using Google's Gemini API with grounding tools (Google Search and Google Maps).

## Core Features

- **Project Management**: Create, edit, delete tuition research projects
- **AI-Powered Extraction**: Gemini 2.5 Flash + Google Search grounding extracts tuition from .edu sites
- **Data Validation**: Program existence verification, confidence scoring (High/Medium/Low)
- **Agentic Verification**: Rule-based + AI verification with retry logic for program name variations
- **Market Analysis**: Real-time dashboards with statistics, trends, and export (CSV/JSON)
- **Historical Tracking**: Version history for price changes and trends
- **Data Audit**: Validated sources, page content snippets, audit trails
- **AI Chat**: Project-scoped questions with conversation persistence (streaming SSE)
- **Admin Observability**: System health, API analytics, LLM extraction audit logs
- **Authentication**: Simple role-based access (Admin/Analyst)
- **Database**: Neon PostgreSQL with real-time sync, pagination, filtering

## Quick Start

**Setup:**
```bash
npm install && npm run server:install
# Create .env.local with: VITE_API_URL=http://localhost:3001
# Create server/.env with: GEMINI_API_KEY=... DATABASE_URL=... PORT=3001
```

**Run (Terminal 1: Backend, Terminal 2: Frontend):**
```bash
npm run server          # Backend on :3001
npm run dev             # Frontend on :5173
# macOS IPv6 issue? Use: npx vite --host 127.0.0.1
```

**Verify:**
```bash
lsof -i :3001                                 # Backend running?
curl http://localhost:3001/api/projects       # API responding?
```

**CORS:** Default allows `localhost:5173` and `127.0.0.1:5173`. Add custom origins via `ALLOWED_ORIGINS` env var.

## Architecture

### Tech Stack
- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Express.js with Neon PostgreSQL
- **Routing**: React Router v7 (HashRouter)
- **AI**: Google Gemini 2.5 Flash (@google/genai v1.31)
- **State**: React Context API + API persistence
- **UI**: Lucide icons, Recharts, Tailwind CSS

### Architecture

**Data Flow**: AppContext → Express API → Neon PostgreSQL

**AI Integration** (all backend-proxied):
- `POST /api/gemini/extract` - Tuition extraction (Google Search grounding)
- `POST /api/gemini/location` - Campus location (Google Maps grounding)
- `POST /api/gemini/chat` - Q&A on project data (streaming SSE)
- `POST /api/gemini/summary` - Executive summary generation

**Security**:
- API key on backend only (never frontend)
- CORS: localhost:5173/127.0.0.1:5173 by default
- Rate limiting: 500 req/15min general, 100 req/15min AI
- Role-based auth (Admin/Analyst) stored in localStorage

### Key Files

**Frontend**:
- `src/App.tsx` - Router, route guards
- `src/context/AppContext.tsx` - Global state + API calls
- `src/services/geminiService.ts` - Gemini API integration
- `src/pages/` - Login, Dashboard, ProjectDetail, AdminPanel
- `src/components/` - AuditModal, HistoryModal, ChatAssistant, ConfirmDialog, etc.
- `src/utils/` - csv.ts, date.ts, api.ts utility modules
- `src/types.ts` - TypeScript interfaces

**Backend**:
- `server/index.js` - Express server with security middleware
- `server/db.js` - Database setup with auto-migrations
- `server/config.js` - Centralized config (Gemini, rate limits, CORS)
- `server/routes/gemini.js` - Extraction + verification agent
- `server/routes/admin.js` - Admin observability endpoints
- `server/routes/conversations.js` - Chat persistence
- `server/agents/verifierAgent.js` - Data validation logic
- `server/middleware/apiLogger.js` - Request logging middleware
- `server/utils/aiLogger.js` - LLM extraction audit logging
- `server/utils/cache.js` - In-memory response caching (Sprint 5)
- `server/utils/materializedView.js` - Materialized view refresh utilities (Sprint 5)
- `server/utils/queryPerformance.js` - Query performance monitoring (Sprint 5)

### Data Models

**ExtractionResult**: School/program extraction
- Core: tuition_amount, cost_per_credit, total_credits, program_length_months, is_stem
- Status: Pending, Success, Not Found, Failed
- Confidence: High, Medium, Low
- Verification: verification_data (JSONB), verification_status, retry_count
- Audit: validated_sources (JSONB), raw_content, actual_program_name
- History: extraction_version, extracted_at, updated_at
- User: is_flagged, user_comments

**Project**: Container for extractions
- Fields: name, description, created_at, last_run, status, results_count

**Conversation**: Chat session
- Fields: id, project_id, title, message_count, last_message_at, created_at
- Messages: conversation_messages (role, content, tokens_used)

**AdminObservability**: System monitoring
- api_logs: HTTP request tracking (method, path, status, duration, IP)
- ai_extraction_logs: LLM call audit (tokens, cost, model, success/failure)

### Environment Variables

- **Frontend** (`.env.local`): `VITE_API_URL=http://localhost:3001`
- **Backend** (`server/.env`): `GEMINI_API_KEY`, `DATABASE_URL`, `PORT`, `ALLOWED_ORIGINS`

## Agentic Extraction System

**Status**: Phase 1 & 2 Complete (December 16, 2025)

### Phase 1: Verification Agent
- **Rule-based checks**: Math (cost × credits ≈ tuition), Source (.edu domain), Completeness, Plausibility
- **AI verification**: Reviews source content for accuracy confirmation
- **Confidence**: High (all checks pass + AI confirms), Medium (most pass), Low (critical fields missing)
- **Implementation**: `server/agents/verifierAgent.js`

### Phase 2: Program Variations Retry
- **Auto-retry**: Up to 3 program name variations when "Not Found" or missing tuition
- **Variations**: Part-Time/Professional/Weekend/Evening MBA, Executive/EMBA, MS Finance/Accounting, etc.
- **Credit conservation**: MAX_VARIATION_RETRIES = 3
- **Implementation**: `server/routes/gemini.js` (PROGRAM_VARIATIONS, getProgramVariations())

### Extraction Prompt (`server/routes/gemini.js:186-265`)

Key rules:
- Search `.edu` sites only
- `tuition_amount` = total program (tuition only, no fees)
- `program_length_months` = numeric value (24 not "2 years")
- `academic_year` = 2025-2026 or latest
- Status "Not Found" if program doesn't exist
- Returns: `{tuition_amount, cost_per_credit, total_credits, program_length_months, is_stem, ...}`

### Known Limitations

**Google Grounding** (~20% of extractions):
- Empty grounding chunks → empty `validated_sources`
- Returns redirect URLs, not direct .edu links
- Workaround: Fallback summary provided

**Tuition Format**:
- Per-credit vs total program cost varies by school
- AI calculates: cost_per_credit × total_credits
- Always verify against source in Audit Modal

### Future: Google ADK Migration (Phase 4+)
- Currently using low-level `@google/genai` SDK for direct API control
- Plan to migrate to **Google Agent Development Kit (ADK)** for structured agentic workflows
- ADK provides: multi-turn agent orchestration, built-in tool management, visual debugging UI, observability
- Benefits: Cleaner verification agent code, better session management, improved observability
- Status: Planned for future phase after current agentic extraction system is stable

## Testing & Debugging

**Tests**: `npm run test:run` (Vitest + React Testing Library)
- `src/test/` - Test setup and utilities
- `context/AppContext.test.tsx` - State management tests
- Known issue: macOS Vitest 4.x may timeout (use `pool: 'vmForks'`)

**Manual Integration Test**:
1. Create project → Add targets → Run extraction
2. View results in table → Check audit modal → Test chat
3. Export results (CSV/JSON)

**Debugging**:
```bash
lsof -i :3001                          # Backend running?
curl http://localhost:3001/api/projects  # API responding?
node server/check-sources.js           # Recent extractions
```

**Common Issues**:
| Issue | Fix |
|-------|-----|
| CORS Error | Frontend URL in `ALLOWED_ORIGINS` |
| IPv6 Error | Use `npx vite --host 127.0.0.1` |
| No Projects | Backend running? Check `DATABASE_URL` |
| API Key Error | Verify `GEMINI_API_KEY` in `server/.env` |

## Database

**Schema** (9 tables + 1 materialized view):
1. **projects** - Research project containers
2. **extraction_results** - Tuition data extractions (version tracking, verification)
3. **conversations** - Chat session metadata
4. **conversation_messages** - Chat message history
5. **project_summaries** - AI summary caching (24hr TTL)
6. **project_analysis_history** - Persistent analysis storage
7. **api_logs** - HTTP request audit trail (Sprint 3)
8. **ai_extraction_logs** - LLM call tracking with token/cost metrics (Sprint 3)
9. **ai_chat_logs** - Chat LLM call audit (Sprint 3)
10. **project_analytics** - Materialized view for pre-computed analytics (Sprint 5)

**Key Features**:
- Version tracking via `extraction_version` column (historical tuition data)
- Auto-migration on server start via `server/db.js`
- Comprehensive indexes for performance (status, confidence, date, verification)
- **Sprint 5**: Composite indexes for common query patterns:
  - `idx_results_project_status_confidence` - Filtered queries
  - `idx_results_project_extracted_at` - Trends queries
  - `idx_results_school_program` - History lookups
- **Sprint 5**: Materialized view `project_analytics` for fast analytics queries
- JSONB columns for flexible metadata (validated_sources, verification_data)

**Performance Optimizations (Sprint 5)**:
- Bulk inserts optimized (N+1 → single query using UNNEST)
- Response caching for analytics endpoint (5-minute TTL)
- Materialized views for pre-computed aggregations
- Automatic cache invalidation on data modifications

## Admin Observability (Sprint 3)

**AdminPanel Features**:
- **System Health**: Uptime, memory usage, CPU load, database latency
- **Database Stats**: Row counts for all tables
- **API Analytics**: Request volume, response times, error rates, top endpoints
- **LLM Audit Dashboard**:
  - Extraction logs with token usage, costs, success/failure tracking
  - Detailed extraction metadata (school, program, model, verification status)
  - Filter by date range, success status, verification status
  - Export audit data for analysis
- **Recent Errors**: Last 5 API errors with stack traces
- **Auto-refresh**: 30-second polling interval

**Endpoints** (`/api/admin/*`):
- `GET /health` - Detailed health check with component status (includes query performance stats)
- `GET /metrics` - System metrics (projects, results, API analytics)
- `GET /api-logs` - HTTP request logs (filterable, paginated)
- `GET /errors` - Recent error responses
- `GET /database-stats` - Table row counts
- `GET /ai-logs` - LLM extraction audit logs (Sprint 3)
- `GET /query-performance` - Database query performance statistics (Sprint 5)
- `POST /query-performance/reset` - Reset query performance statistics (Sprint 5)
- `DELETE /api-logs` - Clear old logs

**Observability Stack**:
- `server/middleware/apiLogger.js` - Non-blocking HTTP request logging
- `server/utils/aiLogger.js` - LLM call tracking (tokens, cost, latency)
- `server/utils/logger.js` - Structured console logging
- `server/utils/queryPerformance.js` - Database query performance monitoring (Sprint 5)
  - Tracks slow queries (>100ms threshold)
  - Provides statistics by table
  - In-memory storage of recent slow queries

## Utility Modules

**Frontend Utilities** (Sprint 4):
- `src/utils/csv.ts` - `toCSV()`, `downloadCSV()`, `parseCSV()`, `escapeCSV()`
- `src/utils/date.ts` - `formatDate()`, `getRelativeTime()`, `getAcademicYear()`, `daysAgo()`
- `src/utils/api.ts` - `apiRequest()`, `get()`, `post()`, `put()`, `del()` - Standardized fetch wrappers

**Backend Utilities** (Sprint 5):
- `server/utils/cache.js` - In-memory response caching
  - `cache.get(key)` - Retrieve cached value
  - `cache.set(key, value, ttlMs)` - Set cached value with TTL
  - `cache.deleteByPattern(pattern)` - Invalidate cache by prefix
  - `getAnalyticsCacheKey(projectId, dataHash)` - Generate cache keys
  - `invalidateAnalyticsCache(projectId)` - Invalidate project analytics cache
- `server/utils/materializedView.js` - Materialized view management
  - `refreshProjectAnalytics()` - Refresh analytics materialized view
  - `refreshProjectAnalyticsForProject(projectId)` - Refresh for specific project
- `server/utils/queryPerformance.js` - Query performance monitoring
  - `trackQuery(queryText, duration, params)` - Track query execution
  - `getQueryStats()` - Get performance statistics
  - `getSlowQueries(limit)` - Get recent slow queries
  - `resetStats()` - Reset performance statistics

## Patterns & Conventions

**Backend Configuration** (`server/config.js`):
- All env-dependent values centralized
- `GEMINI_CONFIG.MODEL` = 'gemini-2.5-flash'
- Rate limits: 500 req/15min (general), 100 req/15min (AI)
- CORS origins configurable via `ALLOWED_ORIGINS` env var

**Error Handling**:
- `withRetry()` utility for transient API failures (exponential backoff)
- Structured error logging via `logger.error()`
- API responses include proper HTTP status codes + error messages

**Database Migrations**:
- Auto-run on server start via `initializeDatabase()`
- Use `ALTER TABLE IF NOT EXISTS` for backward compatibility
- Migrations logged via `logger.info()` / `logger.debug()`

**LLM Cost Tracking**:
- Gemini 2.5 Flash: $0.075 per 1M input tokens, $0.30 per 1M output
- Google Search grounding: $5.00 per 1K queries
- Tracked in `ai_extraction_logs` table via `aiLogger.logExtraction()`

**TypeScript**:
- All types defined in `src/types.ts`
- Use strict mode (`tsconfig.json`)
- Prefer interfaces over types for object shapes

## Recent Development Status

**Current Version**: v1.5.0 (January 2026)

**Completed Sprints**:
- ✅ **Phase 1-2**: Agentic extraction with verification agent + program variations retry (Dec 16, 2025)
- ✅ **Sprint 2**: AI features enhancement - Chat persistence, summary caching (Dec 2025)
- ✅ **Sprint 3**: Admin observability - LLM audit dashboard, API logging, system health (Dec 12, 2025)
- ✅ **Sprint 4**: Performance & polish - Utility modules, TypeScript completion, search optimization (Dec 12, 2025)
- ✅ **Sprint 5**: Database & Backend Performance - Bulk insert optimization, caching, materialized views, query monitoring (Jan 7, 2026)

**Key Learnings**:
- Gemini grounding chunks sometimes empty (~20% of cases) - always provide fallback summary
- `program_length_months` must be numeric (not "2 years") for analytics
- Verification agent reduces low-confidence extractions by flagging issues early
- LLM cost tracking essential for budget management ($0.075-$0.30 per 1M tokens)
- **Sprint 5**: Bulk inserts with UNNEST reduce database round trips from N to 1 (10-15s → <2s for 100 items)
- **Sprint 5**: Response caching with automatic invalidation improves analytics endpoint performance (300-500ms → <100ms cached)
- **Sprint 5**: Materialized views provide fast pre-computed aggregations for analytics queries
- **Sprint 5**: Composite indexes significantly improve filtered query performance on large datasets

**Active Branch**: `feature/agentic-extraction` (verified data quality improvements)

**Sprint 5 Performance Improvements** (January 2026):
- ✅ Bulk insert optimization: N+1 query pattern eliminated (100 items: 10-15s → <2s)
- ✅ Database indexes: Added 3 composite indexes for common query patterns
- ✅ Response caching: Analytics endpoint cached with 5-minute TTL and automatic invalidation
- ✅ Materialized views: Pre-computed analytics aggregations for faster queries
- ✅ Query performance monitoring: Real-time tracking of slow queries (>100ms) with admin dashboard
- ✅ Cache hit rate tracking: `X-Cache-Status` header for monitoring cache effectiveness

## Documentation

- **Architecture**: [docs/AGENTIC_EXTRACTION_ARCHITECTURE.md](docs/AGENTIC_EXTRACTION_ARCHITECTURE.md) - Mermaid diagrams
- **Implementation**: [server/agents/verifierAgent.js](server/agents/verifierAgent.js) - Verification logic
- **Changelog**: [CHANGELOG.md](CHANGELOG.md) - Version history (currently v1.4.0)
- **README**: [README.md](README.md) - User-facing project overview

# CLAUDE.md

Guidance for Claude Code when working on Academic-Insights repository.

## Project Overview

**Academic-Insights** is a React-based web application for extracting, analyzing, and comparing university tuition data using Google's Gemini API with grounding tools (Google Search and Google Maps).

## Core Features

- **Project Management**: Create, edit, delete tuition research projects
- **AI-Powered Extraction**: Gemini + Google Search grounding extracts tuition from .edu sites
- **Data Validation**: Program existence verification, confidence scoring (High/Medium/Low)
- **Market Analysis**: Real-time dashboards with statistics, trends, and export (CSV/JSON)
- **Historical Tracking**: Version history for price changes and trends
- **Data Audit**: Validated sources, page content snippets, audit trails
- **AI Chat**: Project-scoped questions about extracted data (streaming SSE)
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
- **AI**: Google Gemini API (@google/genai)
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
- `App.tsx` - Router, route guards
- `context/AppContext.tsx` - Global state + API calls
- `services/geminiService.ts` - Gemini API integration
- `pages/` - Login, Dashboard, ProjectDetail, AdminPanel
- `components/` - AuditModal, HistoryModal, ChatAssistant, etc.
- `types.ts` - TypeScript interfaces

**Backend**:
- `server/index.js` - Express server
- `server/db.js` - Database setup
- `server/routes/gemini.js` - Extraction + verification agent
- `server/agents/verifierAgent.js` - Data validation logic
- `server/config.js` - Centralized config

### Data Models

**ExtractionResult**: School/program extraction
- Fields: tuition_amount, cost_per_credit, total_credits, program_length_months, is_stem, confidence_score, status
- Status: Pending, Success, Not Found, Failed
- Confidence: High, Medium, Low
- Verification: Math check, source check, completeness, plausibility, AI verification

**Project**: Container for extractions
- Fields: name, description, created_at, last_run, status, results_count

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

**Tables**: projects, extraction_results
- Version tracking via `extraction_version` column
- Historical data: multiple rows per school/program
- Auto-migration on server start via `server/db.js`

## Documentation

- **Architecture**: [docs/AGENTIC_EXTRACTION_ARCHITECTURE.md](docs/AGENTIC_EXTRACTION_ARCHITECTURE.md) - Mermaid diagrams
- **Implementation**: [server/agents/verifierAgent.js](server/agents/verifierAgent.js) - Verification logic
- **Roadmaps**: See `/Users/mahmoudissa/.claude/plans/`

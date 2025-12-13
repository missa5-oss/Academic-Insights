# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Academic-Insights** (internally named "Academica") is a React-based web application for extracting, analyzing, and comparing university tuition data using AI-powered web research. The app uses Google's Gemini API with grounding tools (Google Search and Google Maps) to automatically extract tuition information from official university websites.

## Features

### 🎯 Project Management
- **Create Projects**: Organize tuition research by creating named projects with descriptions
- **Edit/Delete Projects**: Modify project details or remove projects (cascades to delete all associated results)
- **Project Dashboard**: View all projects with status indicators, result counts, and last run timestamps
- **Project Status Tracking**: Monitor project states (Active, Completed, Idle)

### 🔍 AI-Powered Data Extraction
- **Automated Tuition Extraction**: Use Gemini AI with Google Search grounding to automatically extract tuition data from official university websites
- **Bulk Target Addition**: Add multiple school/program combinations at once via:
  - Manual entry (one-by-one)
  - CSV import (bulk upload)
- **Smart Data Validation**: AI intelligently prefers official .edu domains and in-state tuition rates
- **In-State Tuition Preference**: Always extracts in-state (resident) rates; out-of-state rates stored in remarks
- **Tuition-Only Calculations**: Total cost calculations exclude fees for uniform school comparisons
- **Program Existence Verification**: Returns "Not Found" if program doesn't exist (prevents hallucination)
- **Comprehensive Data Points**: Extracts:
  - `stated_tuition`: Exact tuition as written on website
  - `calculated_total_cost`: Tuition-only total (cost_per_credit × total_credits)
  - `is_stem`: STEM designation status
  - `additional_fees`: Separate fees field
  - `actual_program_name`: Exact official program name
  - Tuition amount, period, academic year, cost per credit, total credits, program length
- **Confidence Scoring**: Each extraction receives High/Medium/Low confidence score based on data completeness and program existence verification
- **Content Snippets**: Audit modal shows actual page content from source URLs (extracted from Gemini's grounding metadata)
- **Campus Location Lookup**: Automatically fetch campus addresses and map URLs using Google Maps grounding
- **Extraction Status Tracking**: Monitor extraction progress (Pending, Success, Not Found, Failed)

### 📊 Data Analysis & Visualization
- **Market Analysis Dashboard**: View analytical insights about collected tuition data
  - **Bar Chart**: Compare schools by tuition amount (highest to lowest)
  - **Pie Chart**: Distribution of tuitions by status
  - **Statistics Cards**: Average tuition, highest/lowest tuition, completion rate
- **AI Executive Summary**: Generate markdown-formatted analysis reports with Gemini AI
- **Sortable Data Tables**: Sort results by any column (school, program, tuition, status, etc.)
- **Search & Filter**: Quickly find specific schools or programs in large datasets
- **Data Export**: Download results as CSV or JSON for external analysis

### 📈 Historical Price Tracking
- **Version History**: Track tuition price changes over time for each school/program combination
- **Price Trend Visualization**: View historical price changes with:
  - Version badges (v1, v2, v3, etc.)
  - Timeline view with extraction dates
  - Percentage and dollar amount change calculations
  - Visual indicators (trending up/down icons)
- **Track Price Updates**: Manually trigger new extractions to create new versions and compare with historical data
- **History Modal**: Detailed view showing all versions with:
  - Extraction timestamps
  - Tuition amount comparisons
  - Change metrics (% increase/decrease)
  - Confidence scores per version
  - Remarks and metadata

### 🤖 AI Chat Assistant
- **Project-Scoped Chat**: Ask questions about tuition data within the current project
- **Streaming Responses**: Real-time AI responses using Server-Sent Events (SSE)
- **Context-Aware Analysis**: Chat assistant has access to all extracted data in the current project
- **Interactive Q&A**: Ask for comparisons, insights, trends, or specific data points

### 🔍 Data Auditing & Quality Control
- **Audit Modal**: View detailed extraction metadata for each result:
  - Up to 3 validated source URLs with titles
  - Actual page content snippets (extracted from Gemini's grounding metadata, up to 10,000 characters)
  - Website stated tuition vs calculated total cost comparison
  - Confidence score breakdown with factors
  - Source validation indicators (business school site verification)
  - Campus location with interactive map links
  - Full extraction metadata (period, year, credits, STEM status, etc.)
  - Editable fields: cost per credit, total credits, program length, user comments
- **Manual Data Editing**: Edit tuition amounts directly in the table for corrections
- **Flag System**: Mark results for review with visual flag indicators
- **Source Validation**: View and verify the sources used for each extraction

### 👥 User Management
- **Role-Based Access**: Two user roles (Admin, Analyst)
- **Admin Panel**: Admin-only page for user management and system overview
- **Authentication**: Simple login system with localStorage persistence (designed for internal use)
- **Protected Routes**: Route guards ensure proper access control

### 💾 Data Management
- **Persistent Storage**: All data stored in Neon PostgreSQL serverless database
- **Real-Time Sync**: Frontend state automatically syncs with backend database
- **Bulk Operations**:
  - Bulk delete results with confirmation
  - Bulk import targets via CSV
  - Batch export to CSV/JSON
- **Data Migration Tool**: One-time migration from localStorage to Neon database
- **Data Backup/Restore**: Export and import complete project datasets

### 🔒 Security & Performance
- **API Key Protection**: Gemini API key secured on backend only (never exposed to frontend)
- **CORS Configuration**: Configurable allowed origins for production deployments
- **Rate Limiting**:
  - General API: 500 requests per 15 minutes per IP
  - AI endpoints: 100 requests per 15 minutes per IP
- **Error Boundaries**: Graceful error handling prevents app crashes
- **Input Validation**: Server-side validation for all data operations

### 📱 User Experience
- **Responsive Design**: Works on desktop and tablet devices
- **Loading States**: Visual feedback for all async operations (spinners, progress indicators)
- **Hover Actions**: Quick access to common actions on table rows
- **Keyboard Shortcuts**: Tab/Enter navigation for forms
- **Toast Notifications**: User feedback for actions (success/error messages)
- **Confirmation Dialogs**: Prevent accidental deletions with confirmation prompts

### 🎨 UI Components
- **Custom Modals**: Project creation, editing, audit view, history view, chat assistant
- **Data Tables**: Sortable, searchable tables with inline editing
- **Charts**: Bar charts, pie charts, line charts (Recharts)
- **Icons**: 50+ Lucide React icons for visual clarity
- **Custom Styling**: Tailwind CSS with custom brand colors

## Development Commands

### Setup
```bash
npm install                # Install frontend dependencies
npm run server:install     # Install backend dependencies
```

Create `.env.local` in project root:
```
VITE_API_URL=http://localhost:3001
```

Create `server/.env`:
```
GEMINI_API_KEY=your_gemini_api_key_here
DATABASE_URL=postgresql://your-neon-connection-string-here
PORT=3001
```

Get your Neon connection string from [Neon Console](https://console.neon.tech)

### Running the App

> **Last updated:** December 8, 2025

#### Quick Start (Recommended)
```bash
# Terminal 1: Start backend API (must start first)
npm run server

# Terminal 2: Start frontend
npm run dev
```

#### macOS Troubleshooting: IPv6 Binding Error

If you see this error when starting the frontend:
```
Error: listen EPERM: operation not permitted ::1:5173
```

This is a macOS security issue with IPv6 binding. Use this workaround:
```bash
# Instead of `npm run dev`, run Vite with explicit IPv4 host:
npx vite --host 127.0.0.1
```

Then access the app at: **http://127.0.0.1:5173/**

#### Verifying Servers Are Running

**Backend verification:**
```bash
# Check if backend is listening on port 3001
lsof -i :3001

# Test the API directly
curl http://localhost:3001/api/projects
```

You should see your projects returned as JSON.

**Frontend verification:**
- Open http://localhost:5173/ (or http://127.0.0.1:5173/ if using the IPv4 workaround)
- You should see the login page

#### CORS Configuration

The backend allows requests from these origins by default:
- `http://localhost:5173` (Vite default port)
- `http://127.0.0.1:5173`
- `http://localhost:3000`
- `http://127.0.0.1:3000`

If the frontend can't load data, check that:
1. Backend is running (`lsof -i :3001`)
2. Frontend URL matches one of the allowed CORS origins
3. Browser console shows no CORS errors

To add custom origins, set `ALLOWED_ORIGINS` in `server/.env`:
```
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://your-domain.com
```

#### Other Commands
```bash
npm run build        # Production build
npm run preview      # Preview production build
```

## Architecture

### Tech Stack
- **Frontend**: React 19 with TypeScript
- **Backend**: Express.js with Neon PostgreSQL
- **Routing**: React Router v7 (HashRouter for deployment compatibility)
- **Build Tool**: Vite
- **AI Service**: Google Gemini API (@google/genai)
- **State Management**: React Context API with API-backed data persistence
- **UI Components**: Custom components with Lucide icons and Recharts

### Core Architecture Patterns

**Data Flow**:
1. All application state lives in `context/AppContext.tsx`
2. Project and result data is persisted to Neon PostgreSQL via Express API
3. User authentication is stored in localStorage (personal use only)
4. AI operations are handled by backend API (`/api/gemini/*`) - API key never exposed to frontend
5. AppContext makes RESTful API calls to `http://localhost:3001/api/*`

**Authentication**:
- Simple role-based auth (Admin/Analyst) stored in localStorage
- Two route guards: `ProtectedRoute` (requires login) and `AdminRoute` (requires Admin role)
- Routes are defined in `App.tsx`
- Note: Designed for internal use at Carey Business School (trusted environment)

**Security Features**:
- API key secured on backend only (never sent to frontend)
- CORS configured for internal network (customizable via `ALLOWED_ORIGINS` env var)
- Rate limiting: 500 req/15min for general API, 100 req/15min for AI endpoints
- Error boundaries prevent app crashes and provide user-friendly error messages

**AI Integration**:
The app uses four distinct Gemini API features (all proxied through backend for security):
1. **Google Search Grounding** (`POST /api/gemini/extract`): Extracts tuition data from official university websites
   - Uses simplified, concise prompt structure for better performance
   - Extracts in-state tuition rates (out-of-state in remarks)
   - Calculates total cost using tuition only (excludes fees)
   - Verifies program existence (returns "Not Found" if program doesn't exist)
   - Extracts actual page content from grounding metadata for audit trail
2. **Google Maps Grounding** (`POST /api/gemini/location`): Finds campus locations and addresses
3. **Chat with Context** (`POST /api/gemini/chat`): Provides an AI analyst that can answer questions about extracted data (streaming)
4. **Executive Summary** (`POST /api/gemini/summary`): Generates markdown analysis of tuition data

### File Structure

```
/
├── App.tsx                  # Router config, route guards
├── index.tsx               # App entry point
├── types.ts                # TypeScript interfaces (Project, ExtractionResult, etc.)
├── constants.ts            # App-wide constants
├── context/
│   └── AppContext.tsx      # Global state provider with API integration
├── services/
│   └── geminiService.ts    # All Gemini API integrations
├── pages/
│   ├── Login.tsx           # Login page
│   ├── Dashboard.tsx       # Project listing
│   ├── ProjectDetail.tsx   # Main extraction interface with table
│   └── AdminPanel.tsx      # User & API management (Admin only)
├── components/
│   ├── Layout.tsx          # App shell with navigation
│   ├── ProjectModals.tsx   # Create/Edit project dialogs
│   ├── AuditModal.tsx      # View extraction sources/metadata
│   ├── HistoryModal.tsx    # View version history and price changes over time
│   ├── ChatAssistant.tsx   # AI chat interface
│   ├── ErrorBoundary.tsx   # React error boundary for graceful error handling
│   └── DataMigration.tsx   # One-time localStorage → Neon migration tool
├── server/                  # Backend API
│   ├── index.js            # Express server entry point
│   ├── db.js               # Neon connection & schema initialization
│   ├── routes/
│   │   ├── projects.js     # Project CRUD endpoints
│   │   ├── results.js      # Results CRUD + bulk operations + history tracking
│   │   └── gemini.js       # Gemini AI proxy endpoints (extract, location, chat, summary)
│   ├── package.json        # Backend dependencies
│   └── .env                # GEMINI_API_KEY, DATABASE_URL (not in git)
└── vite.config.ts          # Vite config with env variable injection
```

### Key Data Models

**ExtractionResult**: Represents a single tuition extraction task
- Includes: school name, program name, tuition data, confidence score, status, location, sources
- Status values: Pending, Success, Not Found, Failed
- Confidence scores: High, Medium, Low

**Project**: Container for multiple extraction results
- Tracks creation date, last run time, status, and result count

### State Management Patterns

**AppContext Methods**:
- `addProject`, `editProject`, `deleteProject`: Project CRUD
- `addTargets`: Bulk add extraction targets to a project
- `updateResult`: Update individual extraction result (triggers project `last_run` update on success)
- `deleteResult`: Delete result and update project count
- `restoreData`: Import projects/results from backup
- `getResultHistory`: Fetch version history for a specific result (all versions of same school/program)
- `createNewVersion`: Create new version of a result for historical price tracking
- `getTrendsData`: Get trends data for all results in a project (for line chart visualization)

**ID Generation**:
- Projects: `p-${Date.now()}`
- Results: `r-${timestamp}-${index}-${randomString}` (ensures uniqueness for bulk operations)

### Environment Variables

**Frontend** (`.env.local`):
- `VITE_API_URL`: Backend API URL (default: `http://localhost:3001`)

**Backend** (`server/.env`):
- `GEMINI_API_KEY`: Google Gemini API key (kept secure on server-side only)
- `DATABASE_URL`: Neon PostgreSQL connection string
- `PORT`: Server port (default: 3001)
- `ALLOWED_ORIGINS`: (Optional) Comma-separated list of allowed CORS origins for production (default: `http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000`)

### Recent Improvements (December 10, 2025)

**AI Agent Optimization** (December 8):
- **Simplified Prompt Structure**: Reverted from verbose XML-structured prompt to concise, direct instructions for better AI performance
- **In-State Tuition Preference**: Always extracts in-state (resident) tuition; out-of-state rates stored in remarks field
- **Tuition-Only Total Cost**: `calculated_total_cost` excludes fees for uniform school comparisons
- **Program Existence Verification**: Returns "Not Found" with low confidence if program doesn't exist (prevents hallucination)
- **Enhanced Data Fields**: Added `stated_tuition`, `calculated_total_cost`, `is_stem`, `additional_fees` fields
- **Content Extraction**: Extracts actual page text from Gemini's supporting chunks (no additional HTTP requests)
- **Removed Over-Engineering**: Removed complex school matching validation and content fetching that was causing issues

**Extraction Sources Fix** (December 10):
- **Fixed `raw_content` Bug**: Was storing AI's JSON response instead of actual webpage content
  - Now properly extracts content from grounding chunks
  - Aggregates content from multiple sources
  - Includes fallback summary when no grounding chunks available
- **Improved Source URL Handling**: Better display of Google Vertex AI redirect URLs
  - Shows domain prominently (e.g., "jhu.edu")
  - Displays "Via Vertex AI Grounding" link
  - Added "GROUNDED" and "CONTENT ✓" badges in UI
- **Issue Diagnosed**: Google Search grounding intermittently returns empty chunks (~20% of cases)
  - This is a Google API limitation, not fixable on our end
  - Fallback content summary provided when this occurs

**Tuition Data Cleanup** (December 10):
- **Removed "total" Suffix**: Tuition amounts now store clean dollar values
  - Prompt updated to exclude "total" from output
  - Sanitization regex removes " total" suffix as backup
  - Example: `"$76,000"` instead of `"$76,000 total"`

**Program Name Recognition** (December 10):
- **Added Alternative Program Names**: AI now searches for program variations
  - Part-Time MBA → Professional MBA, Weekend MBA, Evening MBA, Working Professional MBA
  - Executive MBA → EMBA, Exec MBA
  - Helps find programs when schools use different naming conventions

See `docs/EXTRACTION_SOURCES_FIX.md` and `docs/EXTRACTION_PROMPT_IMPROVEMENTS.md` for detailed documentation.

### Important Implementation Details

**Extraction Logic** (`server/routes/gemini.js:/extract`):
- Backend endpoint proxies requests to Gemini API with Google Search grounding
- **Simplified Prompt Structure**: Uses concise, direct instructions for better AI performance
- **Program Name Variations**: Recognizes alternative names for program types
  - Part-Time MBA → Professional MBA, Weekend MBA, Evening MBA, Working Professional MBA
  - Executive MBA → EMBA, Exec MBA
- **In-State Tuition Preference**: Always extracts in-state (resident) tuition rates; out-of-state rates stored in remarks field
- **Tuition-Only Calculation**: `calculated_total_cost` uses ONLY tuition (cost_per_credit × total_credits), excludes fees for uniform comparison
- **Clean Tuition Format**: Removes "total" suffix from tuition amounts (e.g., `"$76,000"` not `"$76,000 total"`)
  - Prompt instructs AI to exclude "total"
  - Regex sanitization as backup: `tuitionAmount.replace(/\s*total\s*$/i, '')`
- **Program Existence Verification**: Returns "Not Found" with low confidence if program doesn't exist (prevents hallucination)
- **Enhanced Data Fields**: Extracts `stated_tuition` (exact website text), `calculated_total_cost`, `is_stem`, `additional_fees`
- **Content Extraction from Grounding Chunks**: Extracts actual page text from Gemini's supporting chunks (grounding metadata)
  - Aggregates content from all validated sources
  - Fallback to extraction summary if no grounding chunks available
  - **Fixed Bug**: Previously stored AI's JSON response instead of page content
- **Source URL Handling**: Google returns Vertex AI redirect URLs, not direct .edu URLs
  - UI displays domain (e.g., "jhu.edu") prominently
  - Clickable "Via Vertex AI Grounding" link provided
  - Badges: "GROUNDED", "CONTENT ✓" to show data quality
- Validates sources using grounding metadata from Google Search
- Extracts up to 3 source URLs with actual page content snippets for audit trail
- Sets confidence to "Low" if `total_credits` cannot be found or if program existence is uncertain
- Returns structured JSON with tuition details, metadata, and raw content summary
- Frontend calls via `services/geminiService.ts:simulateExtraction()`

**Bulk Delete Race Condition Fix**:
- When bulk deleting results, `deleteResult` is called with explicit `projectId` parameter
- This prevents stale state reads when processing multiple deletes in sequence
- See commit: 8d2056a

**Location Extraction** (`getCampusLocation`):
- Uses Google Maps grounding to find campus addresses
- Extracts map URL and address from grounding chunks
- Returns `null` if no valid location found

### Known Issues & Limitations

#### Google Grounding API Limitations

**Empty Grounding Chunks (~20% of extractions)**:
- Google Search grounding sometimes returns no `groundingChunks`
- Results in empty `validated_sources` array
- **This is a Google API limitation** - cannot be fixed on our end
- Workaround: Fallback content summary is provided showing extracted data
- User sees "Legacy Source" section with extraction summary instead of source URLs

**Redirect URLs Instead of Direct .edu URLs**:
- Google returns `vertexaisearch.cloud.google.com/grounding-api-redirect/...` URLs
- Actual domain (e.g., "jhu.edu") is only in the `title` field
- **This is by design from Google's Grounding API**
- UI workaround: Display domain prominently with clickable redirect link

#### Program Naming Variations

Some schools use different names for similar program types:
- "Part-Time MBA" may be called "Professional MBA", "Weekend MBA", or "Evening MBA"
- "Executive MBA" may be abbreviated as "EMBA"
- The prompt now includes these variations to improve finding programs
- The `actual_program_name` field stores what the school actually calls it

#### Tuition Data Consistency

- Some schools list tuition per credit, some as total program cost
- The AI attempts to calculate total cost (cost_per_credit × total_credits)
- If calculation fields are missing, `calculated_total_cost` may be null
- Always verify extracted data in Audit Modal against source URLs

### Testing & Debugging

#### Automated Tests

The project uses **Vitest** with React Testing Library for unit tests.

**Running Tests**:
```bash
npm run test:run          # Run all tests once
npx vitest --run          # Alternative: run tests once
npx vitest                # Watch mode (re-runs on file changes)
npx vitest --coverage     # Run with coverage report
```

**Test Structure**:
```
src/test/
├── setup.ts              # Test setup (cleanup, mocks)
└── test-utils.tsx        # Custom render with providers

context/
└── AppContext.test.tsx   # AppContext unit tests
```

**Test Coverage**:
- `AppContext.test.tsx`: Comprehensive tests for global state management
  - Authentication: login, logout, session persistence from localStorage
  - Projects: add, edit, delete operations
  - Results: add targets, update, delete operations
  - History: fetch result history, trends data
  - Error handling: graceful handling of API failures

**Known Issue**: On some macOS configurations with Vitest 4.x, tests may timeout due to worker initialization issues. The test configuration uses `pool: 'vmForks'` as a workaround.

#### Manual Testing Workflow

For integration testing with the Gemini API:
1. Create a project on Dashboard
2. Add school/program targets in ProjectDetail
3. Run extraction (calls Gemini API)
4. View results in table and audit modal
5. Test chat assistant with extracted data
6. Export results to CSV/JSON

**Common debugging points**:
- Check browser console for API fetch failures
- Verify `GEMINI_API_KEY` is set correctly in `server/.env` (backend only)
- Ensure backend server is running on port 3001 (`lsof -i :3001`)
- Check server console for Gemini API errors and database connection errors
- Verify `DATABASE_URL` is correct in `server/.env`
- Review grounding metadata in backend API responses for source validation
- Use browser DevTools Network tab to inspect API calls to `/api/gemini/*`

**Diagnostic Scripts**:
- `server/check-sources.js` - Inspect validated_sources in database, check for empty sources
- `server/check-gwu.js` - Check specific school extraction (George Washington University example)
- Usage: `node server/check-sources.js` to see recent extractions and source data

**Server Logs to Monitor**:
```
[INFO] Grounding sources for School - Program: [{ title: 'domain.edu', url: '...' }]
[INFO] Grounding snippets for School - Program: [{ url: '...', text: '...' }]
[WARN] No grounding chunks returned from Google Search for: Some School - Program
[INFO] Extraction success for: School - Program
```

These logs help diagnose whether Google grounding is returning sources or not.

**Common Issues & Solutions**:

| Issue | Symptom | Solution |
|-------|---------|----------|
| CORS Error | "No 'Access-Control-Allow-Origin' header" in console | Ensure frontend URL (including port) is in `ALLOWED_ORIGINS` or default list |
| IPv6 Binding Error | `Error: listen EPERM: operation not permitted ::1:5173` | Run `npx vite --host 127.0.0.1` instead of `npm run dev` |
| Projects Not Loading | Dashboard shows empty, no errors | Check backend is running, test API with `curl http://localhost:3001/api/projects` |
| Database Connection Hang | Backend starts but never shows "Running on..." | Verify `DATABASE_URL` in `server/.env`, check Neon dashboard for connection issues |
| API Key Error | 401/403 errors on extraction | Verify `GEMINI_API_KEY` in `server/.env` is valid |

### Path Aliasing

TypeScript and Vite are configured with `@/*` alias pointing to project root:
```typescript
import { useApp } from '@/context/AppContext';
```

### Database Schema (Neon PostgreSQL)

**projects** table:
- `id` (TEXT, PK): Generated as `p-${timestamp}`
- `name`, `description`: Project metadata
- `created_at`, `last_run`: Date tracking
- `status`: Active | Completed | Idle
- `results_count`: Number of extraction results

**extraction_results** table:
- `id` (TEXT, PK): Generated as `r-${timestamp}-${index}-${random}`
- `project_id` (TEXT, FK): References projects(id) with CASCADE delete
- `school_name`, `program_name`: Target identifiers
- `tuition_amount`, `tuition_period`, `academic_year`: Extracted data
- `stated_tuition` (TEXT): Exact tuition as stated on website (preserves original format)
- `calculated_total_cost` (TEXT): cost_per_credit × total_credits (tuition only, no fees)
- `cost_per_credit`, `total_credits`, `program_length`, `remarks`: Metadata
- `additional_fees` (TEXT): Technology fees, student services, etc. (separate from tuition)
- `actual_program_name` (TEXT): Exact official program name from website
- `is_stem` (BOOLEAN): STEM designation status (true if explicitly stated, false otherwise)
- `location_data` (JSONB): Campus location from Maps grounding
- `confidence_score`: High | Medium | Low
- `status`: Success | Not Found | Pending | Failed
- `source_url`: Primary source URL
- `validated_sources` (JSONB): Array of source objects with actual page content snippets
- `extraction_date`, `raw_content`: Audit trail
- `is_flagged` (BOOLEAN): Manual flag for quality review
- `extraction_version` (INTEGER): Version number for historical tracking (default: 1)
- `extracted_at` (TIMESTAMP): Timestamp of when this version was extracted
- `user_comments` (TEXT): User-editable notes/comments

**Historical Tracking Pattern**:
- Multiple rows can exist for the same school/program combination with different versions
- Each new extraction creates a new row with incremented `extraction_version`
- Query history by filtering on `project_id`, `school_name`, `program_name` and ordering by `extraction_version`

Schema auto-creates on server start via `server/db.js:initializeDatabase()`
Migrations run automatically for backward compatibility with existing databases

### Data Migration

To migrate existing localStorage data to Neon:
1. Ensure backend server is running
2. Add `<DataMigration />` component to a page (e.g., AdminPanel)
3. Click "Check for Data" to see localStorage contents
4. Click "Migrate to Database" to transfer data
5. Migration handles batching automatically (50 results per batch)

### Deployment Notes

- **Frontend**: Uses `HashRouter` for static hosting compatibility
- **Backend**: Deploy Express server to any Node.js host (Render, Railway, Fly.io)
- **Database**: Neon provides serverless PostgreSQL with automatic scaling
- Update `VITE_API_URL` to point to deployed backend URL
- Ensure CORS is configured for your frontend domain

---

## Phase 2 Development (v1.0.0+)

### Application Versioning

The application follows **Semantic Versioning** (MAJOR.MINOR.PATCH):
- **Current Version**: 1.0.0
- Version is defined in `package.json` and `server/package.json`
- Frontend displays version in sidebar footer via `src/config.ts`
- Backend includes version in startup banner and `X-App-Version` response header
- All changes documented in `CHANGELOG.md`

### Centralized Configuration

Configuration values are centralized to avoid hardcoding:

**Frontend** (`src/config.ts`):
- `APP_VERSION` - Current application version
- `API_URL` - Backend API URL
- `SEARCH_DEBOUNCE_MS` - Search input delay
- Constants for statuses, roles, storage keys

**Backend** (`server/config.js`):
- `APP_VERSION` - Server version
- `PORT` - Server port
- `GEMINI_CONFIG` - AI model settings
- `RATE_LIMITS` - API rate limiting config
- `VALIDATION` - Input validation limits
- `getCorsOrigins()` - CORS allowed origins

### Input Validation

All API endpoints validate input via `server/middleware/validation.js`:

| Endpoint | Validation |
|----------|------------|
| `POST /api/projects` | Name ≤255 chars, Description ≤2000 chars |
| `POST /api/results` | School/Program name ≤500 chars |
| `POST /api/results/bulk` | Batch size ≤100 items |
| `POST /api/results/bulk-delete` | Batch size ≤100 items |
| `POST /api/gemini/extract` | School/Program required and ≤500 chars |
| `POST /api/gemini/chat` | Message required and ≤10000 chars |
| `POST /api/gemini/summary` | Results array required |

Validation errors return standardized JSON:
```json
{
  "error": true,
  "code": "VALIDATION_ERROR",
  "message": "Project name is required",
  "details": { "errors": ["..."] }
}
```

### Logger Utility

A logger utility (`server/utils/logger.js`) provides environment-aware logging:
- **Production**: Only errors and warnings logged
- **Development**: All levels (debug, info, warn, error)
- Methods: `logger.debug()`, `logger.info()`, `logger.warn()`, `logger.error()`
- Specialized methods: `logger.request()` for API requests, `logger.db()` for database operations

**Fully integrated** in all backend files:
- `server/index.js` - Server startup and error handling
- `server/db.js` - Database initialization and migrations
- `server/routes/projects.js` - Project CRUD operations
- `server/routes/results.js` - Results CRUD operations
- `server/routes/gemini.js` - AI extraction endpoints

### Database Constraints

Added unique constraint to prevent duplicate result versions:
```sql
CREATE UNIQUE INDEX idx_results_unique_version
ON extraction_results(project_id, school_name, program_name, extraction_version)
```

### File Structure Updates

```
server/
├── config.js              # Centralized backend configuration (NEW)
├── middleware/
│   └── validation.js      # Input validation middleware (NEW)
├── utils/
│   └── logger.js          # Logger utility (NEW)
└── ...

src/
├── config.ts              # Centralized frontend configuration (NEW)
└── ...

docs/
├── scrum/
│   └── PHASE_2_SCRUM_PLAN.md  # Development roadmap (NEW)
└── ...

CHANGELOG.md               # Version history (NEW)
```

### Development Roadmap

See `docs/scrum/PHASE_2_SCRUM_PLAN.md` for the full development plan including:
- Sprint 1: Foundation & Versioning (completed)
- Sprint 2: Error Handling & Database optimizations (completed)
  - ✅ Logger utility implementation complete
  - ✅ All console.log/console.error replaced with logger
  - ✅ ErrorBoundary component improved with:
    - Named boundaries for better error tracking
    - "Try Again" recovery button
    - Expandable technical details
    - Copy error to clipboard
    - Development vs production mode handling
    - Version display in error UI
  - ✅ Database query optimizations:
    - Added pagination support to results API
    - Added filtering by status and confidence
    - Created indexes for common query patterns
  - ✅ Retry logic for Gemini API calls:
    - Exponential backoff with jitter
    - Automatic retry on transient errors (429, 503, timeouts)
    - Up to 3 retries per request
- Sprint 3: Testing & Documentation (in progress)
  - ✅ Vitest test infrastructure configured
  - ✅ AppContext unit tests implemented (authentication, CRUD, error handling)
  - ✅ JSDoc documentation added to services/ and context/
  - ✅ CHANGELOG.md updated with Sprint 2-3 progress
  - ⏳ Additional component tests (pending)
- Sprint 4: Performance & Polish

### API Pagination

The results API now supports optional pagination:

```
GET /api/results?project_id=xxx&page=1&limit=50&status=Success&confidence=High
```

Response with pagination:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "totalPages": 3,
    "hasMore": true
  }
}
```

Without `page`/`limit` params, returns backward-compatible array format.

### Database Indexes

The following indexes are automatically created for query optimization:
- `idx_results_project_id` - Fast project lookups
- `idx_results_history` - Version history queries
- `idx_results_unique_version` - Prevent duplicate versions
- `idx_results_status` - Status filtering
- `idx_results_confidence` - Confidence filtering
- `idx_results_extraction_date` - Date sorting

### Retry Logic

All Gemini API calls include automatic retry with exponential backoff:
- Max retries: 3
- Base delay: 1 second (doubles each retry)
- Max delay: 10 seconds
- Retryable errors: Rate limits (429), server errors (500/503), timeouts

---

## Additional Documentation

The `docs/` directory contains detailed documentation for specific features and fixes:

### Extraction & AI Features
- **`EXTRACTION_SOURCES_FIX.md`** - Complete diagnosis and fix for "Sources Not Found" issue
  - Root cause analysis of empty `validated_sources`
  - Fix for `raw_content` storing AI JSON instead of page content
  - Google Vertex AI redirect URL handling
  - Before/after comparisons with database inspection results

- **`EXTRACTION_PROMPT_IMPROVEMENTS.md`** - Recent prompt enhancements
  - Removal of "total" from tuition amounts
  - Source restriction to official business school websites
  - Program name variation recognition

### UI & Component Audits
- **`EXTRACTION_UI_AUDIT.md`** - Comprehensive UI analysis of extraction grounding chunks
- **`EXTRACTION_UI_FIXES.md`** - UI improvements for source display
- **`UI_RENDERING_AUDIT.md`** - General UI rendering analysis

### Development & Planning
- **`scrum/PHASE_2_SCRUM_PLAN.md`** - Sprint-based development roadmap
  - Sprint 1: Foundation & Versioning
  - Sprint 2: Error Handling & Database optimizations
  - Sprint 3: Testing & Documentation (current)
  - Sprint 4: Performance & Polish

### Test Results
- **`test-extraction-results.md`** - Documented test extraction results

### Version History
- **`../CHANGELOG.md`** - Complete version history and change log

---

## Quick Reference

### Current Application Version
**v1.0.0** (December 10, 2025)

### Key Files Modified Recently
- `server/routes/gemini.js` (lines 185-417) - Extraction prompt and logic
- `components/AuditModal.tsx` (lines 426-477) - Source URL display improvements
- `CLAUDE.md` - This documentation file

### Latest Prompt Configuration
Located at `server/routes/gemini.js:186-204`:
- Searches `.edu` official sources only
- Recognizes program name variations (Part-Time MBA → Professional/Weekend/Evening MBA)
- Excludes "total" from tuition amounts
- Returns "Not Found" if program doesn't exist
- Uses in-state tuition rates

### Data Quality Indicators
- **High Confidence**: Has tuition_amount, cost_per_credit, and total_credits
- **Medium Confidence**: Has tuition_amount but missing some calculation fields
- **Low Confidence**: Missing tuition_amount or program not found
- **Status "Not Found"**: Program doesn't exist at school (AI verified)

### Debugging Quick Commands
```bash
# Check if backend is running
lsof -i :3001

# Test API directly
curl http://localhost:3001/api/projects

# Check recent extractions in database
node server/check-sources.js

# Test a specific extraction
curl -X POST http://localhost:3001/api/gemini/extract \
  -H "Content-Type: application/json" \
  -d '{"school": "School Name", "program": "Program Name"}'
```

---

## Phase 3 Development: Comprehensive Roadmap (v1.1.0 → v2.0.0)

**Status**: ✅ SPRINT 1 COMPLETE - v1.1.0 RELEASED
**Date**: December 12, 2025
**Roadmap Documents**: See `/Users/mahmoudissa/.claude/plans/`

### Current Development Status

A comprehensive 5-sprint development roadmap has been created to transform Academic-Insights from v1.0.0 to v2.0.0 with significant enhancements across five critical areas.

#### Development Sprints

| Sprint | Focus | Duration | Target Version | Status |
|--------|-------|----------|-----------------|--------|
| 1 | Market Analysis Enhancement | Weeks 1-2 | v1.1.0 | ✅ COMPLETE |
| 2 | AI Features Enhancement | Weeks 3-5 | v1.2.0 | 📋 PLANNING COMPLETE |
| 3 | Admin Observability & Monitoring | Weeks 6-8 | v1.3.0 | 📅 Ready to Plan |
| 4 | Security Hardening | Weeks 9-11 | v2.0.0 | ⚠️ CRITICAL - Blocks Production |
| 5 | Agentic AI Extraction Planning | Weeks 12-14 | v2.1.0+ | 📋 Design Phase |

#### Roadmap Documentation

Location: `/Users/mahmoudissa/.claude/plans/`

**Documents**:
- `INDEX.md` - Navigation guide and quick reference
- `ROADMAP-SUMMARY.md` - Executive overview (20-30 min read)
- `SECURITY-ALERT.md` - Critical vulnerabilities requiring immediate attention
- `comprehensive-scrum-roadmap.md` - Complete detailed specifications
- `lucky-wandering-biscuit.md` - Sprint 1 detailed plan
- `SPRINT_1_IMPLEMENTATION.md` - Step-by-step implementation guide (in repo)

#### Critical Security Alert

🔴 **EXPOSED GEMINI API KEY** in `server/.env.example`
- Requires immediate action: Revoke and regenerate API key
- See `/Users/mahmoudissa/.claude/plans/SECURITY-ALERT.md` for full details

#### Sprint 1: Market Analysis Enhancement (✅ COMPLETE - v1.1.0 RELEASED)

**Goal**: Replace placeholder trend data with real database insights, add analytics cards, enable exports

**User Stories** (All Complete):
1. ✅ **US1.1**: Statistics Summary Cards - Avg/Highest/Lowest tuition, completion rate
   - Backend `GET /api/results/analytics/:projectId` endpoint ✓
   - StatCard component with icons and trends ✓
   - Frontend state management and integration ✓

2. ✅ **US1.2**: Real Historical Trends - Load actual version history instead of hardcoded data
   - Enhanced `GET /api/results/trends/:projectId` with date aggregation ✓
   - Average tuition calculation per extraction month ✓
   - Real data displayed in line chart ✓

3. ✅ **US1.3**: Additional Charts - Status distribution, STEM vs Non-STEM, Cost per credit
   - Status Distribution donut chart ✓
   - STEM vs Non-STEM horizontal bar chart ✓
   - Cost per Credit top 10 analysis chart ✓

4. ✅ **US1.4**: Export Capabilities - CSV and JSON data export
   - CSV export with proper escaping and formatting ✓
   - JSON export with full metadata and aggregated data ✓
   - Export buttons on Market Analysis tab ✓

**Key Changes Implemented**:
- Backend: New `GET /api/results/analytics/:projectId` endpoint with comprehensive calculations
- Backend: Enhanced `GET /api/results/trends/:projectId` with MongoDB-style aggregation
- Frontend: StatCard component (`components/StatCard.tsx`) for metric displays
- Frontend: Analytics data state management in ProjectDetail
- Frontend: Real trends chart replacing hardcoded 2020-2025 placeholder data
- UI: 3 new chart components (Status Distribution, STEM Comparison, Cost Per Credit)
- Export: CSV and JSON data export functions with download buttons
- Version: Updated to v1.1.0 across package.json, config files, and CHANGELOG

**Deliverables**:
- ✅ v1.1.0 release with real-time market analysis dashboard
- ✅ No placeholder data - all charts use real extracted data
- ✅ CSV/JSON export functionality operational
- ✅ 6 total charts (2 original + 4 new) providing complete insights
- ✅ Loading states and error handling for all data-driven components

#### Roadmap Timeline

```
Week 1-2:   Sprint 1 (Market Analysis)
Week 3-5:   Sprint 2 (AI Features)
Week 6-8:   Sprint 3 (Observability)
Week 9-11:  Sprint 4 (Security) ← REQUIRED BEFORE PRODUCTION
Week 12-14: Sprint 5 (Agentic Planning)
```

#### Version Progression

- v1.0.0 (Dec 10) - Original baseline
- ✅ **v1.1.0 (Dec 12)** - Market Analysis enhancements (RELEASED)
  - Real analytics dashboard with statistics cards
  - 3 new insight charts (Status, STEM, Cost Per Credit)
  - CSV/JSON export functionality
  - Real trends data from database
- v1.2.0 (Target Week 5) - AI features improvements
- v1.3.0 (Target Week 8) - Observability & monitoring
- v2.0.0 (Target Week 11) - Security hardened, production-ready
- v2.1.0+ (Future) - Agentic AI extraction

#### Sprint 2: AI Features Enhancement (📋 PLANNING COMPLETE)

**Status**: Ready for execution
**Goal**: Transform AI analysis from basic to sophisticated with quantitative metrics, conversation persistence, and enhanced context

**User Stories**:
1. **US2.1**: Enhanced Executive Summary - Add quantitative metrics and citations
   - Balanced analysis: statistics + qualitative insights
   - Stream sections progressively for better UX
   - Cache results to avoid regeneration
   - Include source attribution

2. **US2.2**: Expanded Chat Context - Complete data field coverage
   - Include STEM status, fees, confidence, location in chat
   - Quick-reference summary (X successful, Y pending, etc.)
   - Enable advanced queries (compare STEM vs non-STEM)

3. **US2.3**: Chat Persistence - Save conversations to database
   - Store conversation history permanently
   - List past conversations with timestamps
   - Restore full conversation history on selection
   - Delete old conversations

4. **US2.4**: Chat Citations - Reference specific schools and sources
   - Parse and highlight citations in responses
   - Link citations to audit modal
   - Show confidence levels and extraction years

5. **US2.5**: Summary Streaming & Caching - Progressive rendering
   - Stream analysis sections as they're generated
   - Cache identical analyses (24-hour TTL)
   - Reduce cached analysis access from 5s to <100ms

**Database Changes**:
- Add `conversations` table (id, project_id, title, message_count, created_at)
- Add `conversation_messages` table (id, conversation_id, role, content, tokens_used, created_at)
- Add `project_summaries` table (project_id, data_hash, response, created_at)

**Files to Create**:
- `server/routes/conversations.js` - Conversation CRUD endpoints
- `SPRINT_2_IMPLEMENTATION.md` - Detailed implementation guide

**Files to Modify**:
- `server/routes/gemini.js` - Enhanced summary, streaming, caching, context
- `server/db.js` - New table schemas
- `services/geminiService.ts` - Streaming support, citation extraction
- `components/ChatAssistant.tsx` - Conversation management UI
- `pages/ProjectDetail.tsx` - Streaming summary display

**Implementation Timeline**:
- Week 3: Database + conversation persistence
- Week 4: Summary enhancement + streaming
- Week 5: Citations + caching + polish

**Effort**: 20-25 hours total

**Next Immediate Steps**:
1. Review `SPRINT_2_IMPLEMENTATION.md` for detailed specifications
2. Assign team members to user stories
3. Set up development database with new schemas
4. Begin US2.3 (conversation persistence - foundation for others)
5. Parallel: Refine summary prompt for US2.1

---

### Next Immediate Steps

1. **This Sprint (Sprint 2)**:
   - Begin implementation of AI Features Enhancement
   - Execute user stories in priority order: US2.3 → US2.1 → US2.2 → US2.4 → US2.5
   - Track progress with daily standups
   - Update version to v1.2.0 when complete

2. **Ongoing**:
   - Update version number in `package.json` as sprints complete
   - Track progress with SPRINT_*_IMPLEMENTATION.md files
   - Update this CLAUDE.md with progress
   - Prepare for Sprint 3 planning

---

### Quick Reference

**Current Version**: v1.0.0 (December 10, 2025)
**Target Version (Sprint 1)**: v1.1.0
**Production Version (All Sprints)**: v2.0.0

**Key Implementation Files for Sprint 1**:
- `SPRINT_1_IMPLEMENTATION.md` - Detailed guide in this repo
- `server/routes/results.js` - New/enhanced endpoints
- `pages/ProjectDetail.tsx` - UI and state management
- `types.ts` - New TypeScript interfaces

**Roadmap Access**:
- All plans: `/Users/mahmoudissa/.claude/plans/`
- Start with: `INDEX.md` or `ROADMAP-SUMMARY.md`

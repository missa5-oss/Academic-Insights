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
- **Comprehensive Data Points**: Extracts tuition amount, period, academic year, cost per credit, total credits, and program length
- **Confidence Scoring**: Each extraction receives High/Medium/Low confidence score based on data completeness
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
  - Raw content snippets (first 500 characters)
  - Campus location with interactive map links
  - Full extraction metadata (period, year, credits, etc.)
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

> **Last updated:** December 5, 2025

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
The app uses three distinct Gemini API features (all proxied through backend for security):
1. **Google Search Grounding** (`POST /api/gemini/extract`): Extracts tuition data from official university websites
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

### Important Implementation Details

**Extraction Logic** (`server/routes/gemini.js:/extract`):
- Backend endpoint proxies requests to Gemini API with Google Search grounding
- Uses strict rules to prefer official .edu domains and in-state tuition rates
- Validates sources using grounding metadata from Google Search
- Extracts up to 3 source URLs for audit trail
- Sets confidence to "Low" if `total_credits` cannot be found
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
- `cost_per_credit`, `total_credits`, `program_length`, `remarks`: Metadata
- `location_data` (JSONB): Campus location from Maps grounding
- `confidence_score`: High | Medium | Low
- `status`: Success | Not Found | Pending | Failed
- `source_url`: Primary source URL
- `validated_sources` (JSONB): Array of source objects
- `extraction_date`, `raw_content`: Audit trail
- `is_flagged` (BOOLEAN): Manual flag for quality review
- `extraction_version` (INTEGER): Version number for historical tracking (default: 1)
- `extracted_at` (TIMESTAMP): Timestamp of when this version was extracted

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

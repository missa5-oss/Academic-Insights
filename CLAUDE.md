# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Academic-Insights** (internally named "Academica") is a React-based web application for extracting, analyzing, and comparing university tuition data using AI-powered web research. The app uses Google's Gemini API with grounding tools (Google Search and Google Maps) to automatically extract tuition information from official university websites.

## Development Commands

### Setup
```bash
npm install                # Install frontend dependencies
npm run server:install     # Install backend dependencies
```

Create `.env.local` in project root:
```
GEMINI_API_KEY=your_gemini_api_key_here
VITE_API_URL=http://localhost:3001
```

Create `server/.env`:
```
DATABASE_URL=postgresql://your-neon-connection-string-here
PORT=3001
```

Get your Neon connection string from [Neon Console](https://console.neon.tech)

### Running the App
```bash
# Terminal 1: Start backend API
npm run server

# Terminal 2: Start frontend
npm run dev

# Other commands
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
4. AI operations are handled through `services/geminiService.ts`
5. AppContext makes RESTful API calls to `http://localhost:3001/api/*`

**Authentication**:
- Simple role-based auth (Admin/Analyst) stored in localStorage
- Two route guards: `ProtectedRoute` (requires login) and `AdminRoute` (requires Admin role)
- Routes are defined in `App.tsx`

**AI Integration**:
The app uses three distinct Gemini API features:
1. **Google Search Grounding** (`simulateExtraction`): Extracts tuition data from official university websites
2. **Google Maps Grounding** (`getCampusLocation`): Finds campus locations and addresses
3. **Chat with Context** (`createProjectChat`): Provides an AI analyst that can answer questions about extracted data

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
│   ├── ChatAssistant.tsx   # AI chat interface
│   └── DataMigration.tsx   # One-time localStorage → Neon migration tool
├── server/                  # Backend API
│   ├── index.js            # Express server entry point
│   ├── db.js               # Neon connection & schema initialization
│   ├── routes/
│   │   ├── projects.js     # Project CRUD endpoints
│   │   └── results.js      # Results CRUD + bulk operations
│   ├── package.json        # Backend dependencies
│   └── .env                # Database credentials (not in git)
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

**ID Generation**:
- Projects: `p-${Date.now()}`
- Results: `r-${timestamp}-${index}-${randomString}` (ensures uniqueness for bulk operations)

### Environment Variables

**Frontend** (`.env.local`):
- `GEMINI_API_KEY`: Gemini API key (mapped to `process.env.API_KEY` in code)
- `VITE_API_URL`: Backend API URL (default: `http://localhost:3001`)

**Backend** (`server/.env`):
- `DATABASE_URL`: Neon PostgreSQL connection string
- `PORT`: Server port (default: 3001)

### Important Implementation Details

**Extraction Logic** (`geminiService.ts:simulateExtraction`):
- Uses strict rules to prefer official .edu domains and in-state tuition rates
- Validates sources using grounding metadata from Google Search
- Extracts up to 3 source URLs for audit trail
- Sets confidence to "Low" if `total_credits` cannot be found
- Returns structured JSON with tuition details, metadata, and raw content summary

**Bulk Delete Race Condition Fix**:
- When bulk deleting results, `deleteResult` is called with explicit `projectId` parameter
- This prevents stale state reads when processing multiple deletes in sequence
- See commit: 8d2056a

**Location Extraction** (`getCampusLocation`):
- Uses Google Maps grounding to find campus addresses
- Extracts map URL and address from grounding chunks
- Returns `null` if no valid location found

### Testing & Debugging

**No formal test suite is configured.** Manual testing workflow:
1. Create a project on Dashboard
2. Add school/program targets in ProjectDetail
3. Run extraction (calls Gemini API)
4. View results in table and audit modal
5. Test chat assistant with extracted data
6. Export results to CSV/JSON

**Common debugging points**:
- Check browser console for Gemini API errors and API fetch failures
- Verify `GEMINI_API_KEY` is set correctly in `.env.local`
- Ensure backend server is running on port 3001
- Check server console for database connection errors
- Verify `DATABASE_URL` is correct in `server/.env`
- Review grounding metadata in API responses for source validation
- Use browser DevTools Network tab to inspect API calls

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

Schema auto-creates on server start via `server/db.js:initializeDatabase()`

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

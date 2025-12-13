# Changelog

All notable changes to the Academic-Insights (Academica) project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Virtual scrolling for very large datasets (500+ items)
- Additional component test coverage
- Sprint 5: Security Hardening

---

## [1.4.0] - 2025-12-12

### Added

#### Sprint 4: Performance & Polish

##### S4-01: Search Optimization
- **Search Debouncing**: Already implemented via `useDebounce` hook (300ms delay)
- Prevents excessive re-renders during typing
- Improves UI responsiveness with large datasets

##### S4-02: Project Sorting
- **Sort Dropdown** (`pages/Dashboard.tsx`): 6 sorting options
  - Newest First (default)
  - Oldest First
  - Name (A-Z)
  - Name (Z-A)
  - Status (Active → Completed → Idle)
  - Most Results
- **localStorage Persistence**: Sort preference saved to `academica_sort_preference`
- **Instant Sorting**: No page reload required

##### S4-03: Utility Extraction
- **CSV Utility** (`src/utils/csv.ts`):
  - `toCSV()` - Convert array to CSV string
  - `downloadCSV()` - Trigger CSV file download
  - `escapeCSV()` - Escape values for CSV format
  - `parseCSV()` - Parse CSV string to array
- **Date Utility** (`src/utils/date.ts`):
  - `formatDate()` - Format date for display
  - `formatDateTime()` - Format with time
  - `getRelativeTime()` - e.g., "2 hours ago"
  - `getTimestamp()` - Filename-safe timestamp
  - `getAcademicYear()` - e.g., "2025-2026"
  - `toISODate()` - YYYY-MM-DD format
  - `isToday()`, `daysAgo()` - Date helpers
- **API Utility** (`src/utils/api.ts`):
  - `apiRequest()` - Standardized fetch with error handling
  - `get()`, `post()`, `put()`, `patch()`, `del()` - HTTP method helpers
  - `isError()` - Type guard for error responses
  - Centralized `API_URL` usage

##### S4-04: TypeScript Completion
- **New Types** (`types.ts`):
  - `TrendData` - Chart trend data structure
  - `ChatMessage` - Conversation message
  - `Conversation` - Chat session metadata
  - `AnalyticsData` - Market analysis data
  - `HealthCheckResponse` - Admin health check
  - `APILogEntry` - API request log
  - `SummaryMetrics` - AI summary metrics
  - `DatabaseStats` - Table row counts
  - `AdminMetrics` - Dashboard metrics

##### S4-05: Confirmation Dialogs
- **ChatAssistant.tsx**: Replaced `confirm()` with proper `ConfirmDialog`
- **Consistent UX**: All delete operations now use styled confirmation modal
- **Audit Complete**: ProjectDetail.tsx already had proper confirmation dialogs

### Improved
- **Dashboard UX**: Sort projects without page navigation
- **Code Quality**: Reusable utilities reduce duplication
- **Type Safety**: Comprehensive TypeScript coverage
- **Maintainability**: Centralized date/CSV/API logic

### Technical
- **New Files**: 3 utility modules in `src/utils/`
- **Config Update**: `STORAGE_KEYS.SORT_PREFERENCE` added
- **Version Sync**: All package.json and config files updated to 1.4.0

---

## [1.3.0] - 2025-12-12

### Added

#### Sprint 3: Admin Observability & Monitoring

##### US3.1: API Request Logging
- **api_logs Database Table** (`server/db.js`): Stores all API request metadata
  - `id`, `method`, `path`, `status_code`, `duration_ms`
  - `ip_address`, `user_agent`, `request_body` (sanitized)
  - `error_message`, `created_at`
- **API Logger Middleware** (`server/middleware/apiLogger.js`):
  - Non-blocking async logging to database
  - Automatic body sanitization (removes passwords, API keys)
  - Request duration tracking
  - Structured JSON logging via logger utility

##### US3.2: Enhanced Admin Dashboard
- **Real-Time System Health** (`pages/AdminPanel.tsx`):
  - Server uptime display with version info
  - Database connection status with latency
  - Memory usage with visual progress bar
  - CPU load average and core count
  - Health status badge (healthy/degraded/unhealthy)
- **Database Statistics**: Row counts for all tables
- **API Analytics Section**:
  - Total requests over 7 days
  - Average response time
  - Error rate percentage
  - Top endpoints by request count
  - Response code breakdown
- **Recent Errors Panel**: Last 5 API errors with details
- **Auto-Refresh**: Dashboard refreshes every 30 seconds
- **Manual Refresh Button**: Force refresh with loading state

##### US3.3: Health Check Endpoints
- **Detailed Health Check** (`GET /api/admin/health`):
  - Component status (database, system)
  - Memory metrics (total, free, used, percentage)
  - CPU load average and core count
  - Platform and Node.js version
  - Overall health status aggregation
- **Liveness Probe** (`GET /api/admin/health/live`): Simple alive check
- **Readiness Probe** (`GET /api/admin/health/ready`): Database connectivity check

##### US3.4: Admin API Endpoints
- **System Metrics** (`GET /api/admin/metrics`):
  - Summary: total projects, results, conversations
  - Status breakdown by extraction status
  - Confidence score distribution
  - Daily extraction counts with success rates
  - API analytics (requests, response time, error rate)
- **API Logs** (`GET /api/admin/api-logs`):
  - Filterable by path and status code
  - Configurable limit (max 200)
- **Recent Errors** (`GET /api/admin/errors`): Last N error responses
- **Database Stats** (`GET /api/admin/database-stats`): Table row counts
- **Clear Logs** (`DELETE /api/admin/api-logs`): Remove logs older than N days

### Improved
- **Admin Panel**: Complete redesign with real backend metrics
- **Observability**: Full request/response logging for debugging
- **System Monitoring**: Real-time health status and resource usage

### Technical
- **Database Schema**: Added `api_logs` table for request tracking
- **Middleware**: New `apiLoggerMiddleware` with sanitization
- **API Routes**: New admin router with 8 endpoints
- **Frontend Types**: TypeScript interfaces for health, metrics, logs

---

## [1.2.0] - 2025-12-12

### Added

#### Sprint 2: AI Features Enhancement

##### US2.3: Chat Conversation Persistence
- **Conversations Database Table** (`server/db.js`): Stores chat sessions per project
  - `conversations`: id, project_id, title, message_count, last_message_at
  - `conversation_messages`: id, conversation_id, role, content, tokens_used
- **Conversations API** (`server/routes/conversations.js`): Full CRUD for chat persistence
  - `GET /:projectId` - List all conversations for a project
  - `POST /` - Create new conversation
  - `GET /:id/messages` - Get messages for a conversation
  - `POST /:id/messages` - Add message to conversation
  - `PUT /:id` - Update conversation title
  - `DELETE /:id` - Delete conversation
  - `POST /:id/export` - Export conversation as JSON
- **ChatAssistant UI Enhancement** (`components/ChatAssistant.tsx`):
  - Conversation list sidebar with create, load, delete actions
  - Auto-save messages to database
  - Auto-title conversations based on first user message
  - Export conversation to JSON file

##### US2.2: Expanded Chat Context
- **Enhanced Context Data** (`server/routes/gemini.js`): Chat now includes all extraction fields
  - Added: actualProgramName, statedTuition, calculatedTotalCost, costPerCredit
  - Added: totalCredits, programLength, isStem, additionalFees, confidence, remarks
  - Added: sourceUrl for citation support
- **Dataset Summary**: Pre-calculated statistics for AI context
  - Average, min, max tuition
  - STEM vs non-STEM program counts

##### US2.1: Enhanced Executive Summary
- **Quantitative Metrics** (`server/routes/gemini.js`): Summary now includes computed metrics
  - Total programs, successful extractions
  - Average, median, min, max tuition
  - STEM/non-STEM breakdown
  - Data quality distribution (High/Medium/Low confidence)
- **Structured Analysis Format**: New prompt generates professional report sections
  - Executive Summary with specific numbers
  - Quantitative Analysis with school citations
  - Competitive Positioning & Messaging insights
  - Market Insights & Recommendations
- **Frontend Integration** (`services/geminiService.ts`): Returns both summary and metrics

##### US2.4: Chat Response Citations
- **Source Reference System**: AI includes source URLs when discussing data
  - Build source reference list from extraction data
  - Citation format: "[Source: domain.edu]" with confidence level
  - "Sources" section at end of responses when applicable

##### US2.5: Summary Caching
- **project_summaries Table** (`server/db.js`): Caches generated summaries
  - Unique constraint on (project_id, data_hash)
  - 24-hour expiration with automatic refresh
- **Cache Logic** (`server/routes/gemini.js`):
  - MD5 hash of data for change detection
  - Returns cached response if hash matches and not expired
  - `forceRefresh` parameter to regenerate on demand
- **Frontend Support**: Pass projectId for caching, shows cached indicator

### Improved
- **Chat Intelligence**: AI now has comprehensive data context for better analysis
- **Summary Quality**: Reports include specific numbers, school names, and source citations
- **User Experience**: Conversation history persists across sessions

### Technical
- **Database Schema**: Added 3 new tables for Sprint 2 features
- **API Endpoints**: New conversations router with full CRUD
- **Caching System**: Hash-based caching with 24-hour TTL
- **Type Safety**: New TypeScript interfaces for SummaryMetrics and SummaryResponse

---

## [1.1.0] - 2025-12-12

### Added

#### Sprint 1: Market Analysis Enhancement
- **Analytics Endpoint** (`GET /api/results/analytics/:projectId`): Backend endpoint calculating statistics cards data
  - Average tuition across successful results
  - Highest/lowest tuition with school/program details
  - Total programs count and success rate
  - STEM vs non-STEM program breakdown

- **StatCard Component** (`components/StatCard.tsx`): Reusable statistics display card with:
  - Icon, title, value, and trend indicator
  - Responsive grid layout for 4 cards across
  - Loading skeleton states

- **Real Trends Data** (US1.2): Enhanced trends aggregation logic
  - `GET /api/results/trends/:projectId` endpoint now groups results by extraction date
  - Calculates average tuition per month using database aggregation
  - Replaced hardcoded 2020-2025 placeholder data with real extraction history
  - Frontend fetches and displays trends with loading states

- **Additional Charts** (US1.3): Three new data visualizations
  - **Status Distribution Chart** (donut): Success/Pending/Not Found/Failed breakdown
  - **STEM vs Non-STEM Comparison Chart** (horizontal bar): Program type distribution
  - **Cost Per Credit Analysis Chart** (horizontal bar): Top 10 schools by cost per credit

- **Data Export Functions** (US1.4): CSV and JSON export capabilities
  - `exportToCSV()`: Exports filtered results with all data fields to CSV file
  - `exportToJSON()`: Exports project metadata, analytics, trends, and results to JSON
  - Export buttons appear on Market Analysis tab with download icons
  - Filenames include project name and export date for easy organization

### Improved
- **Market Analysis Dashboard**: Complete redesign with real data from database
  - Statistics cards now show actual metrics instead of placeholders
  - Trends chart displays real extraction history
  - New insight charts provide deeper analysis capabilities
  - Export functionality enables data sharing and reporting

### Technical
- **Database Aggregation**: Moved trends calculation to backend for better performance
- **API Enhancements**: Added new analytics endpoint with comprehensive calculations
- **State Management**: Added analytics data and trends data state management in ProjectDetail
- **Type Safety**: Added TypeScript interfaces for analytics data structures
- **Component Architecture**: Reusable StatCard component for metrics display

---

## [1.0.0] - 2025-12-05

### Added

#### Project Management
- Create, edit, and delete research projects
- Project dashboard with status indicators and result counts
- Project status tracking (Active, Completed, Idle)

#### AI-Powered Data Extraction
- Automated tuition extraction using Gemini AI with Google Search grounding
- Campus location lookup using Google Maps grounding
- Bulk target addition via manual entry or CSV import
- Confidence scoring (High/Medium/Low) based on data completeness
- Extraction status tracking (Pending, Success, Not Found, Failed)

#### Data Analysis & Visualization
- Market analysis dashboard with bar and pie charts
- Statistics cards (average tuition, highest/lowest, completion rate)
- AI-generated executive summary reports
- Sortable, searchable data tables
- Data export to CSV and JSON formats

#### Historical Price Tracking
- Version history for school/program combinations
- Price trend visualization with change calculations
- History modal with extraction timestamps and metrics

#### AI Chat Assistant
- Project-scoped chat interface
- Streaming responses using Server-Sent Events (SSE)
- Context-aware analysis of extracted data

#### Data Auditing & Quality Control
- Audit modal with source URLs and raw content snippets
- Manual data editing for corrections
- Flag system for quality review
- Source validation display

#### User Management
- Role-based access (Admin, Analyst)
- Admin panel for system overview
- Protected routes with access control

#### Data Management
- Neon PostgreSQL serverless database integration
- Real-time sync between frontend and backend
- Bulk delete with confirmation
- Data migration tool (localStorage → Neon)
- Backup and restore functionality

#### Security & Performance
- API key secured on backend only
- CORS configuration with customizable origins
- Rate limiting (500 req/15min general, 100 req/15min AI endpoints)
- React Error Boundary for graceful error handling

#### User Experience
- Responsive design for desktop and tablet
- Loading states with visual feedback
- Hover actions for quick access
- Toast notifications for action feedback
- Confirmation dialogs for destructive actions

### Technical Stack
- Frontend: React 19, TypeScript, Vite, React Router v7
- Backend: Express.js, Neon PostgreSQL
- AI: Google Gemini API (@google/genai)
- UI: Custom components with Lucide icons, Recharts
- State: React Context API with API-backed persistence

---

## Version History

| Version | Date | Description |
|---------|------|-------------|
| 1.4.0 | 2025-12-12 | Sprint 4: Performance & Polish - Sorting, utilities, TypeScript completion |
| 1.3.0 | 2025-12-12 | Sprint 3: Admin Observability & Monitoring - Health checks, API logging, enhanced admin dashboard |
| 1.2.0 | 2025-12-12 | Sprint 2: AI Features Enhancement - Chat persistence, enhanced context, summary improvements |
| 1.1.0 | 2025-12-12 | Sprint 1: Market Analysis Enhancement - Statistics cards, real trends, export |
| 1.0.0 | 2025-12-05 | Initial production release |

---

*For detailed architecture documentation, see [CLAUDE.md](./CLAUDE.md)*

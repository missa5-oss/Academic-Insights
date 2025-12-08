# Changelog

All notable changes to the Academic-Insights (Academica) project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Virtual scrolling for large datasets
- Additional component test coverage

### Added (Sprint 4: Performance & Polish)
- **Search Debouncing** (`src/hooks/useDebounce.ts`): Custom hook with 300ms delay for search input optimization
- **ConfirmDialog Component** (`src/components/ConfirmDialog.tsx`): Reusable styled confirmation modal for destructive actions
  - Supports danger, warning, and info variants
  - Accessible with keyboard navigation and backdrop click

### Improved
- **ProjectDetail.tsx**: Replaced `window.confirm()` with styled ConfirmDialog for project delete and bulk delete actions
- **TypeScript Configuration**: Added Vite client types and created `src/vite-env.d.ts` for proper `import.meta.env` support

### Fixed
- **ChatAssistant.tsx**: Fixed `sendMessageStream` call to pass string instead of object
- **Layout.tsx**: Wrapped LogOut icon in button for proper `title` attribute support
- **AdminPanel.tsx**: Fixed YAxis `prefix` prop to use `tickFormatter` instead (Recharts compatibility)
- **AppContext.tsx**: Added missing `extraction_version` and `extracted_at` fields to new results

---

## [1.1.0] - 2025-12-06

### Added

#### Sprint 2: Error Handling & Database
- **Logger Utility** (`server/utils/logger.js`): Environment-aware logging with debug, info, warn, error levels
- **Input Validation Middleware** (`server/middleware/validation.js`): Validates all API endpoints with standardized error responses
- **Centralized Configuration**: Frontend (`src/config.ts`) and backend (`server/config.js`) configuration files
- **API Pagination**: Results API now supports optional pagination with `page`, `limit`, `status`, and `confidence` query params
- **Database Indexes**: Added indexes for project_id, status, confidence, and history queries
- **Retry Logic**: Exponential backoff with jitter for Gemini API calls (up to 3 retries)

#### Sprint 3: Testing & Documentation
- **Unit Tests** (`context/AppContext.test.tsx`): Comprehensive test suite for AppContext covering:
  - Authentication (login, logout, session persistence)
  - Projects CRUD operations
  - Results CRUD operations
  - History and trends fetching
  - Error handling
- **JSDoc Documentation**: Added JSDoc comments to all exported functions in:
  - `services/geminiService.ts`: BackendChat class, createProjectChat, getCampusLocation, generateExecutiveSummary, simulateExtraction
  - `context/AppContext.tsx`: AppProvider, useApp, and all context methods

### Improved
- **ErrorBoundary Component**: Enhanced with named boundaries, "Try Again" button, expandable technical details, clipboard copy, and version display
- **Vitest Configuration**: Updated test pool settings for better compatibility

### Technical
- Replaced all `console.log`/`console.error` with logger utility in backend
- Added unique constraint to prevent duplicate result versions
- Test setup includes `@testing-library/react`, `@testing-library/jest-dom`, and Vitest

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
| 1.1.0 | 2025-12-06 | Sprint 2-3: Error handling, database optimizations, testing, documentation |
| 1.0.0 | 2025-12-05 | Initial production release |

---

*For detailed architecture documentation, see [CLAUDE.md](./CLAUDE.md)*

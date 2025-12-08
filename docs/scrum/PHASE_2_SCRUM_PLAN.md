# Academic-Insights Phase 2 Scrum Plan

**Version**: 1.0.0
**Created**: December 5, 2025
**Sprint Duration**: 2 weeks per sprint
**Target Audience**: Carey Business School Internal Team

---

## Executive Summary

Phase 1 delivered a fully functional application with:
- Project management and CRUD operations
- AI-powered tuition extraction with Google Search/Maps grounding
- Data analysis with charts and executive summaries
- Historical price tracking with versioning
- AI chat assistant with streaming responses
- Data export (CSV/JSON) and backup/restore capabilities

Phase 2 focuses on:
1. **Application Versioning & Release Management**
2. **Code Quality & Stability Improvements**
3. **Performance Optimization**
4. **Enhanced User Experience**

---

## Audit Summary

### Current State (December 2025)

| Category | Status | Notes |
|----------|--------|-------|
| Frontend | ✅ Complete | React 19, TypeScript, Vite |
| Backend | ✅ Complete | Express.js, Neon PostgreSQL |
| AI Integration | ✅ Complete | Gemini API with grounding |
| Authentication | ✅ Basic | localStorage-based (internal use) |
| Testing | ❌ None | No test framework configured |
| Versioning | ❌ None | version: 0.0.0 in package.json |
| CI/CD | ❌ None | No automated pipelines |
| Documentation | ✅ Good | CLAUDE.md comprehensive |

### Key Issues Identified

#### Priority 1 - Critical (Security/Stability)
- [ ] No input validation on API endpoints
- [ ] 45+ console.log statements in production code
- [ ] Missing database unique constraints
- [ ] Generic error handling without user feedback

#### Priority 2 - High (Performance/Quality)
- [ ] Hardcoded configuration values (API URLs, model names)
- [ ] TEXT type for date fields (should be TIMESTAMP)
- [ ] N+1 database queries in bulk operations
- [ ] Duplicated loading states across components

#### Priority 3 - Medium (Maintainability)
- [ ] No test coverage
- [ ] Duplicated utility code (CSV, API handling)
- [ ] Missing TypeScript type definitions
- [ ] Sparse code documentation

---

## Application Versioning Strategy

### Semantic Versioning (SemVer)

```
MAJOR.MINOR.PATCH

Examples:
- 1.0.0 → Initial production release
- 1.1.0 → New feature (backwards compatible)
- 1.1.1 → Bug fix
- 2.0.0 → Breaking changes
```

### Version Locations

| File | Current | Target |
|------|---------|--------|
| `package.json` | 0.0.0 | 1.0.0 |
| `server/package.json` | 1.0.0 | 1.0.0 |
| UI Footer | N/A | Display version |
| API Response Header | N/A | `X-App-Version` |

### Changelog Format

```markdown
# Changelog

## [1.1.0] - 2025-MM-DD
### Added
- Feature description

### Changed
- Change description

### Fixed
- Bug fix description

### Security
- Security update description
```

### Git Tagging Strategy

```bash
# Create release tag
git tag -a v1.0.0 -m "Release 1.0.0: Production-ready release"
git push origin v1.0.0

# List tags
git tag -l "v*"
```

---

## Sprint Backlog

### Sprint 1: Foundation & Versioning (Weeks 1-2)

**Sprint Goal**: Establish versioning, improve code quality, add input validation

#### User Stories

| ID | Story | Points | Priority |
|----|-------|--------|----------|
| S1-01 | As a developer, I want application versioning so I can track releases | 3 | P1 |
| S1-02 | As a developer, I want a CHANGELOG file so I can document changes | 2 | P1 |
| S1-03 | As a user, I want to see the app version in the footer | 1 | P2 |
| S1-04 | As a developer, I want centralized configuration so hardcoded values are eliminated | 5 | P1 |
| S1-05 | As a developer, I want input validation on all API endpoints | 8 | P1 |
| S1-06 | As a developer, I want console.log replaced with a logger utility | 3 | P2 |

**Total Story Points**: 22

#### Tasks Breakdown

**S1-01: Application Versioning**
- [ ] Update `package.json` version to `1.0.0`
- [ ] Sync `server/package.json` version
- [ ] Create version constant in `src/config.ts`
- [ ] Add `X-App-Version` header to API responses
- [ ] Create git tag for v1.0.0

**S1-02: Changelog**
- [ ] Create `CHANGELOG.md` in project root
- [ ] Document Phase 1 features as v1.0.0 release
- [ ] Add changelog update instructions to CLAUDE.md

**S1-03: Version Display**
- [ ] Add version to Layout.tsx footer
- [ ] Import version from config

**S1-04: Centralized Configuration**
- [ ] Create `src/config.ts` with:
  - API_URL
  - APP_VERSION
  - DEFAULT_PAGE_SIZE
- [ ] Create `server/config.js` with:
  - PORT
  - GEMINI_MODEL
  - RATE_LIMITS
  - DEFAULT_CORS_ORIGINS
- [ ] Update all hardcoded references

**S1-05: Input Validation**
- [ ] Add validation middleware to Express
- [ ] Validate project name (max 255 chars)
- [ ] Validate description (max 2000 chars)
- [ ] Validate batch size limits (max 100)
- [ ] Validate school/program names (max 500 chars)
- [ ] Add database unique constraint for result versioning

**S1-06: Logger Utility**
- [ ] Create `src/utils/logger.ts`
- [ ] Create `server/utils/logger.js`
- [ ] Replace all console.log/error statements
- [ ] Add conditional logging based on NODE_ENV

---

### Sprint 2: Error Handling & Database (Weeks 3-4)

**Sprint Goal**: Implement robust error handling, optimize database operations

#### User Stories

| ID | Story | Points | Priority |
|----|-------|--------|----------|
| S2-01 | As a user, I want clear error messages when something fails | 5 | P1 |
| S2-02 | As a developer, I want standardized API error responses | 3 | P1 |
| S2-03 | As a developer, I want database date fields as TIMESTAMP | 5 | P2 |
| S2-04 | As a developer, I want bulk operations to use batch inserts | 5 | P2 |
| S2-05 | As a user, I want loading states to be consistent across the app | 3 | P2 |

**Total Story Points**: 21

#### Tasks Breakdown

**S2-01: User Error Feedback**
- [ ] Add toast notification system (or use browser native)
- [ ] Update AppContext to expose error state
- [ ] Show user-friendly error messages for API failures
- [ ] Add retry button for failed operations

**S2-02: Standardized API Errors**
- [ ] Define error response schema:
  ```json
  {
    "error": true,
    "code": "VALIDATION_ERROR",
    "message": "Project name is required",
    "details": {}
  }
  ```
- [ ] Create error middleware in Express
- [ ] Update all catch blocks to use standard format
- [ ] Document error codes in CLAUDE.md

**S2-03: Database Date Migration**
- [ ] Create migration to add new TIMESTAMP columns
- [ ] Backfill data from TEXT to TIMESTAMP
- [ ] Update queries to use new columns
- [ ] Drop old TEXT columns after verification

**S2-04: Batch Operations**
- [ ] Refactor bulk insert to use VALUES clause
- [ ] Add transaction support for atomic operations
- [ ] Implement partial failure handling
- [ ] Add rollback on error

**S2-05: Centralized Loading States**
- [ ] Add loading state to AppContext
- [ ] Create useLoading hook
- [ ] Remove duplicate loading states from components
- [ ] Standardize loading UI (spinner component)

---

### Sprint 3: Testing & Documentation (Weeks 5-6)

**Sprint Goal**: Add test coverage, improve documentation

#### User Stories

| ID | Story | Points | Priority |
|----|-------|--------|----------|
| S3-01 | As a developer, I want unit tests for AppContext | 8 | P2 |
| S3-02 | As a developer, I want API endpoint tests | 8 | P2 |
| S3-03 | As a developer, I want JSDoc comments on exported functions | 3 | P3 |
| S3-04 | As a developer, I want a proper README with setup instructions | 2 | P3 |

**Total Story Points**: 21

#### Tasks Breakdown

**S3-01: Frontend Unit Tests**
- [ ] Configure Vitest for React testing
- [ ] Write tests for AppContext methods:
  - addProject
  - editProject
  - deleteProject
  - addTargets
  - updateResult
- [ ] Write tests for utility functions
- [ ] Achieve 60% coverage target

**S3-02: API Tests**
- [ ] Configure Jest for backend
- [ ] Write tests for /api/projects endpoints
- [ ] Write tests for /api/results endpoints
- [ ] Write tests for validation middleware
- [ ] Mock Gemini API calls

**S3-03: Code Documentation**
- [ ] Add JSDoc to exported functions in services/
- [ ] Add JSDoc to AppContext methods
- [ ] Document component props with TypeScript comments

**S3-04: README Update**
- [ ] Create comprehensive README.md
- [ ] Add installation instructions
- [ ] Add development workflow
- [ ] Add deployment guide
- [ ] Link to CLAUDE.md for architecture details

---

### Sprint 4: Performance & Polish (Weeks 7-8)

**Sprint Goal**: Optimize performance, enhance UX

#### User Stories

| ID | Story | Points | Priority |
|----|-------|--------|----------|
| S4-01 | As a user, I want search to be responsive with large datasets | 3 | P2 |
| S4-02 | As a user, I want to see my most recent projects first | 2 | P3 |
| S4-03 | As a developer, I want extracted utility functions | 5 | P3 |
| S4-04 | As a developer, I want complete TypeScript coverage | 3 | P3 |
| S4-05 | As a user, I want confirmation before destructive actions | 2 | P2 |

**Total Story Points**: 15

#### Tasks Breakdown

**S4-01: Search Optimization**
- [ ] Add debouncing to search input (300ms)
- [ ] Implement virtual scrolling for large result sets (>100 items)
- [ ] Add pagination option for table view

**S4-02: Project Sorting**
- [ ] Add sort options to Dashboard (name, date, status)
- [ ] Remember user's sort preference in localStorage

**S4-03: Utility Extraction**
- [ ] Create `src/utils/csv.ts` for CSV operations
- [ ] Create `src/utils/date.ts` for date formatting
- [ ] Create `src/utils/api.ts` for API call wrapper
- [ ] Update imports across codebase

**S4-04: TypeScript Completion**
- [ ] Define TrendData type
- [ ] Define ChatMessage type
- [ ] Define all API response types
- [ ] Remove all `any` types

**S4-05: Confirmation Dialogs**
- [ ] Review all delete operations
- [ ] Ensure confirmation dialog for bulk deletes
- [ ] Add confirmation for project deletion
- [ ] Consider undo functionality for single deletes

---

## Release Plan

### v1.0.0 - Initial Production Release
**Target Date**: End of Sprint 1
**Contents**: Current feature set with versioning

### v1.1.0 - Stability Release
**Target Date**: End of Sprint 2
**Contents**:
- Input validation
- Standardized error handling
- Database optimizations
- Logger utility

### v1.2.0 - Quality Release
**Target Date**: End of Sprint 3
**Contents**:
- Unit test coverage
- API tests
- Improved documentation

### v1.3.0 - Polish Release
**Target Date**: End of Sprint 4
**Contents**:
- Performance optimizations
- UX improvements
- Utility refactoring

---

## Definition of Done

A story is complete when:
- [ ] Code is written and follows existing patterns
- [ ] TypeScript compiles without errors
- [ ] Manual testing completed
- [ ] Code reviewed (self-review for single developer)
- [ ] Documentation updated if needed
- [ ] CHANGELOG updated
- [ ] No console.log statements introduced

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Gemini API changes | High | Low | Pin API version, monitor deprecation notices |
| Database migration data loss | High | Low | Backup before migration, test on staging |
| Breaking changes in React 19 | Medium | Low | Lock dependency versions |
| Team availability | Medium | Medium | Keep sprints flexible, prioritize P1 items |

---

## Metrics & KPIs

### Development Velocity
- Story points completed per sprint
- Bug count per release
- Time to resolve issues

### Code Quality
- Test coverage percentage
- TypeScript error count
- Console.log count (target: 0)

### User Experience
- Average page load time
- Error rate in production
- Feature adoption (tracked via analytics if added)

---

## Appendix A: Technical Debt Log

| Item | Location | Effort | Priority |
|------|----------|--------|----------|
| Console statements | Multiple files | 3 pts | P1 |
| Hardcoded URLs | 3 files | 2 pts | P1 |
| TEXT date fields | Database | 5 pts | P2 |
| N+1 bulk inserts | results.js | 3 pts | P2 |
| Missing unique constraint | Database | 1 pt | P1 |
| Duplicate loading states | Components | 3 pts | P2 |
| any[] types | 2 locations | 1 pt | P3 |
| Missing JSDoc | Services | 3 pts | P3 |

**Total Technical Debt**: ~21 story points

---

## Appendix B: File Change Impact

### High-Impact Files (Touch Carefully)
- `context/AppContext.tsx` - Central state management
- `server/routes/gemini.js` - AI integration
- `server/db.js` - Database schema

### Medium-Impact Files
- `pages/ProjectDetail.tsx` - Main feature page
- `server/routes/results.js` - Core CRUD operations
- `components/ProjectModals.tsx` - Data entry

### Low-Impact Files (Safe to Modify)
- `components/Layout.tsx` - Shell/navigation
- `pages/Login.tsx` - Authentication
- `pages/Dashboard.tsx` - Overview page

---

*Document maintained by: Development Team*
*Last updated: December 5, 2025*

# Sprint 4: Performance & Polish - Implementation Guide

**Duration**: Weeks 7-8
**Target Version**: v1.4.0
**Status**: 📋 Ready for Implementation
**Created**: December 12, 2025

---

## Executive Summary

Sprint 4 focuses on performance optimization, UX polish, and code maintainability. This sprint addresses remaining technical debt and prepares the codebase for future scaling.

---

## User Stories

### S4-01: Search Optimization (Priority: P2, 3 Points)

**Goal**: Make search responsive with large datasets

**Acceptance Criteria**:
- Search input debounced at 300ms
- Results filter smoothly without UI lag
- Virtual scrolling for result sets >100 items
- Optional pagination toggle for table view

**Implementation Details**:

**1. Use Existing Debounce Hook** (`src/hooks/useDebounce.ts`):

The hook already exists! Apply it to search inputs:

```typescript
// pages/ProjectDetail.tsx
import { useDebounce } from '@/src/hooks/useDebounce';

const [searchInput, setSearchInput] = useState('');
const debouncedSearch = useDebounce(searchInput, 300);

// Use debouncedSearch for filtering
const filteredResults = useMemo(() => {
  return results.filter(r => 
    r.school_name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    r.program_name.toLowerCase().includes(debouncedSearch.toLowerCase())
  );
}, [results, debouncedSearch]);
```

**2. Virtual Scrolling** (Optional Enhancement):

For very large datasets, consider adding `@tanstack/react-virtual`:

```bash
npm install @tanstack/react-virtual
```

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

const parentRef = useRef<HTMLDivElement>(null);

const virtualizer = useVirtualizer({
  count: filteredResults.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 60, // Row height estimate
  overscan: 10,
});

// Render virtual rows
<div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
  <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
    {virtualizer.getVirtualItems().map(virtualRow => (
      <div
        key={virtualRow.key}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: `${virtualRow.size}px`,
          transform: `translateY(${virtualRow.start}px)`,
        }}
      >
        <ResultRow result={filteredResults[virtualRow.index]} />
      </div>
    ))}
  </div>
</div>
```

**Effort**: 2-3 hours

---

### S4-02: Project Sorting (Priority: P3, 2 Points)

**Goal**: Sort projects with persisted preference

**Acceptance Criteria**:
- Sort options: Name (A-Z, Z-A), Date (Newest, Oldest), Status
- Sort preference saved to localStorage
- Visual indicator for active sort
- Applies immediately without page refresh

**Implementation Details**:

**1. Add Sort State to Dashboard** (`pages/Dashboard.tsx`):

```typescript
import { STORAGE_KEYS } from '@/src/config';

type SortOption = 'name-asc' | 'name-desc' | 'date-newest' | 'date-oldest' | 'status';

const [sortBy, setSortBy] = useState<SortOption>(() => {
  const saved = localStorage.getItem(STORAGE_KEYS.SORT_PREFERENCE);
  return (saved as SortOption) || 'date-newest';
});

// Save preference on change
const handleSortChange = (option: SortOption) => {
  setSortBy(option);
  localStorage.setItem(STORAGE_KEYS.SORT_PREFERENCE, option);
};

// Sort projects
const sortedProjects = useMemo(() => {
  const sorted = [...projects];
  switch (sortBy) {
    case 'name-asc':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case 'name-desc':
      return sorted.sort((a, b) => b.name.localeCompare(a.name));
    case 'date-newest':
      return sorted.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    case 'date-oldest':
      return sorted.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    case 'status':
      const statusOrder = { 'Active': 0, 'Completed': 1, 'Idle': 2 };
      return sorted.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
    default:
      return sorted;
  }
}, [projects, sortBy]);
```

**2. Sort Dropdown UI**:

```tsx
<div className="flex items-center gap-2">
  <span className="text-sm text-slate-500">Sort by:</span>
  <select
    value={sortBy}
    onChange={(e) => handleSortChange(e.target.value as SortOption)}
    className="text-sm border rounded px-2 py-1"
  >
    <option value="date-newest">Newest First</option>
    <option value="date-oldest">Oldest First</option>
    <option value="name-asc">Name (A-Z)</option>
    <option value="name-desc">Name (Z-A)</option>
    <option value="status">Status</option>
  </select>
</div>
```

**Effort**: 1-2 hours

---

### S4-03: Utility Extraction (Priority: P3, 5 Points)

**Goal**: Extract duplicated code into reusable utilities

**Acceptance Criteria**:
- CSV operations in dedicated utility
- Date formatting centralized
- API wrapper with error handling
- All imports updated across codebase

**Implementation Details**:

**1. Create CSV Utility** (`src/utils/csv.ts`):

```typescript
/**
 * CSV Utility Functions
 * Handles CSV generation and parsing for data export
 */

export interface CSVOptions {
  filename?: string;
  columns?: string[];
  delimiter?: string;
}

/**
 * Convert array of objects to CSV string
 */
export function toCSV<T extends Record<string, any>>(
  data: T[],
  options: CSVOptions = {}
): string {
  const { columns, delimiter = ',' } = options;
  
  if (data.length === 0) return '';
  
  const headers = columns || Object.keys(data[0]);
  const headerRow = headers.join(delimiter);
  
  const rows = data.map(item =>
    headers.map(header => {
      const value = item[header];
      // Escape quotes and wrap in quotes if contains delimiter
      const stringValue = String(value ?? '');
      if (stringValue.includes(delimiter) || stringValue.includes('"')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    }).join(delimiter)
  );
  
  return [headerRow, ...rows].join('\n');
}

/**
 * Download data as CSV file
 */
export function downloadCSV<T extends Record<string, any>>(
  data: T[],
  filename: string,
  options: CSVOptions = {}
): void {
  const csv = toCSV(data, options);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Parse CSV string to array of objects
 */
export function parseCSV(csvString: string, hasHeaders = true): Record<string, string>[] {
  const lines = csvString.trim().split('\n');
  if (lines.length === 0) return [];
  
  const headers = hasHeaders 
    ? lines[0].split(',').map(h => h.trim())
    : lines[0].split(',').map((_, i) => `column${i}`);
  
  const dataLines = hasHeaders ? lines.slice(1) : lines;
  
  return dataLines.map(line => {
    const values = line.split(',');
    return headers.reduce((obj, header, i) => {
      obj[header] = values[i]?.trim() ?? '';
      return obj;
    }, {} as Record<string, string>);
  });
}
```

**2. Create Date Utility** (`src/utils/date.ts`):

```typescript
/**
 * Date Utility Functions
 * Centralized date formatting and manipulation
 */

/**
 * Format date for display
 */
export function formatDate(
  date: string | Date,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  };
  
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', defaultOptions);
}

/**
 * Format date with time
 */
export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get relative time (e.g., "2 hours ago")
 */
export function getRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return formatDate(d);
}

/**
 * Get current timestamp for filenames
 */
export function getTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

/**
 * Get academic year (e.g., "2025-2026")
 */
export function getAcademicYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  // Academic year starts in September
  if (month >= 8) {
    return `${year}-${year + 1}`;
  }
  return `${year - 1}-${year}`;
}
```

**3. Create API Utility** (`src/utils/api.ts`):

```typescript
/**
 * API Utility Functions
 * Centralized API calls with error handling
 */

import { API_URL } from '@/src/config';

export interface APIError {
  error: true;
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface APIResponse<T> {
  data?: T;
  error?: APIError;
}

/**
 * Make API request with standardized error handling
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<APIResponse<T>> {
  try {
    const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return {
        error: {
          error: true,
          code: data.code || 'API_ERROR',
          message: data.message || response.statusText,
          details: data.details,
        },
      };
    }
    
    return { data };
  } catch (err) {
    return {
      error: {
        error: true,
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Network request failed',
      },
    };
  }
}

/**
 * GET request helper
 */
export async function get<T>(endpoint: string): Promise<APIResponse<T>> {
  return apiRequest<T>(endpoint, { method: 'GET' });
}

/**
 * POST request helper
 */
export async function post<T>(
  endpoint: string,
  body: Record<string, any>
): Promise<APIResponse<T>> {
  return apiRequest<T>(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * PUT request helper
 */
export async function put<T>(
  endpoint: string,
  body: Record<string, any>
): Promise<APIResponse<T>> {
  return apiRequest<T>(endpoint, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

/**
 * DELETE request helper
 */
export async function del<T>(endpoint: string): Promise<APIResponse<T>> {
  return apiRequest<T>(endpoint, { method: 'DELETE' });
}
```

**Effort**: 3-4 hours

---

### S4-04: TypeScript Completion (Priority: P3, 3 Points)

**Goal**: Complete TypeScript coverage with no `any` types

**Acceptance Criteria**:
- TrendData type defined
- ChatMessage type defined
- All API response types defined
- All `any` types removed or replaced

**Implementation Details**:

**1. Add Missing Types** (`types.ts`):

```typescript
// Add to existing types.ts file

/**
 * Trend data for charts
 */
export interface TrendData {
  month: string;
  avgTuition: number;
  count: number;
  year: number;
}

/**
 * Chat message in conversation
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  tokensUsed?: number;
}

/**
 * Conversation metadata
 */
export interface Conversation {
  id: string;
  projectId: string;
  title: string;
  messageCount: number;
  lastMessageAt: string;
  createdAt: string;
}

/**
 * Analytics data structure
 */
export interface AnalyticsData {
  avgTuition: number;
  highestTuition: {
    amount: number;
    school: string;
    program: string;
  };
  lowestTuition: {
    amount: number;
    school: string;
    program: string;
  };
  totalPrograms: number;
  successRate: number;
  stemCount: number;
  nonStemCount: number;
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  components: {
    database: { status: string; latency?: number };
    system: { status: string };
  };
  memory: {
    total: number;
    free: number;
    used: number;
    usedPercentage: number;
  };
  cpu: {
    loadAverage: number[];
    cores: number;
  };
}

/**
 * API log entry
 */
export interface APILogEntry {
  id: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  ipAddress?: string;
  userAgent?: string;
  errorMessage?: string;
  createdAt: string;
}
```

**2. Find and Fix `any` Types**:

Search for `any` in the codebase and replace:

```bash
# Find all any types
grep -r ": any" --include="*.ts" --include="*.tsx" .
```

Common fixes:
- `history: any[]` → `history: ChatMessage[]`
- `data: any` → `data: ExtractionResult[]`
- `event: any` → `event: React.ChangeEvent<HTMLInputElement>`

**Effort**: 2-3 hours

---

### S4-05: Confirmation Dialogs (Priority: P2, 2 Points)

**Goal**: Ensure all destructive actions have confirmation

**Acceptance Criteria**:
- All delete operations have confirmation
- Bulk operations show count in confirmation
- Project deletion warns about losing results
- Optional undo for single item deletes

**Implementation Details**:

**1. Audit Current Dialogs**:

Check these locations:
- `pages/Dashboard.tsx` - Project delete
- `pages/ProjectDetail.tsx` - Result delete, bulk delete
- `components/ChatAssistant.tsx` - Conversation delete
- `pages/AdminPanel.tsx` - Clear logs

**2. Enhance Confirmation Dialog** (`src/components/ConfirmDialog.tsx`):

The component exists. Ensure it's used consistently:

```tsx
// Example usage pattern
const [confirmDelete, setConfirmDelete] = useState<{
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

const handleDeleteProject = (project: Project) => {
  setConfirmDelete({
    isOpen: true,
    title: 'Delete Project',
    message: `Are you sure you want to delete "${project.name}"? This will permanently remove ${project.results_count} extraction results.`,
    onConfirm: async () => {
      await deleteProject(project.id);
      setConfirmDelete({ ...confirmDelete, isOpen: false });
    },
  });
};

// In JSX
<ConfirmDialog
  isOpen={confirmDelete.isOpen}
  title={confirmDelete.title}
  message={confirmDelete.message}
  onConfirm={confirmDelete.onConfirm}
  onCancel={() => setConfirmDelete({ ...confirmDelete, isOpen: false })}
  confirmText="Delete"
  variant="danger"
/>
```

**Effort**: 1-2 hours

---

## Implementation Timeline

### Week 7 (Days 1-5)
- **Day 1**: S4-01 - Search debouncing + virtual scrolling research
- **Day 2**: S4-02 - Project sorting implementation
- **Day 3-4**: S4-03 - Utility extraction (CSV, date, API)
- **Day 5**: S4-03 - Update imports across codebase

### Week 8 (Days 6-10)
- **Day 6-7**: S4-04 - TypeScript type completion
- **Day 8**: S4-05 - Confirmation dialogs audit
- **Day 9**: Testing and bug fixes
- **Day 10**: Documentation, CHANGELOG update, version bump

---

## Success Criteria

**Core Deliverables** (v1.4.0):
- [ ] Search debounced at 300ms
- [ ] Project sorting with localStorage persistence
- [ ] Utility files created: csv.ts, date.ts, api.ts
- [ ] All `any` types replaced
- [ ] All delete operations have confirmation

**Quality Standards**:
- [ ] No TypeScript errors
- [ ] No new console.log statements
- [ ] All imports updated
- [ ] Manual testing complete
- [ ] CHANGELOG updated

**Performance Benchmarks**:
- [ ] Search filter: <100ms response
- [ ] Large dataset (500+ items): No UI lag
- [ ] Sort change: Instant (<50ms)

---

## Files to Create

1. `src/utils/csv.ts` - CSV operations
2. `src/utils/date.ts` - Date formatting
3. `src/utils/api.ts` - API wrapper

---

## Files to Modify

**Frontend**:
- `pages/Dashboard.tsx` - Sorting, confirmation
- `pages/ProjectDetail.tsx` - Debouncing, virtual scroll
- `types.ts` - New type definitions
- `src/config.ts` - Add SORT_PREFERENCE to STORAGE_KEYS

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Virtual scrolling breaks existing UI | Make it optional, test thoroughly |
| Type changes cause compile errors | Incremental changes with testing |
| Utility extraction breaks imports | Update one file at a time |
| Sort preference conflicts | Clear localStorage if schema changes |

---

## Version Bump Checklist

Before releasing v1.4.0:

- [ ] Update `package.json` version to 1.4.0
- [ ] Update `server/package.json` version to 1.4.0
- [ ] Update `src/config.ts` APP_VERSION to '1.4.0'
- [ ] Update `server/config.js` APP_VERSION to '1.4.0'
- [ ] Update CHANGELOG.md with Sprint 4 changes
- [ ] Create git tag: `git tag -a v1.4.0 -m "Sprint 4: Performance & Polish"`

---

**Status**: Ready for Sprint 4 Kickoff
**Last Updated**: December 12, 2025


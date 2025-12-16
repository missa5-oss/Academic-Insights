# AI Search Extraction & Re-run Extraction Evaluation

**Date:** December 8, 2025  
**Evaluated By:** AI Code Assistant  
**Version:** 1.1.0

## Executive Summary

This document evaluates the AI-powered extraction and re-run extraction functionality in the Academic-Insights application. The evaluation covers the extraction flow, error handling, historical tracking, batch processing, and user experience.

## Current Implementation Overview

### Extraction Flow

1. **Initial Extraction** (`handleRunExtraction` in `ProjectDetail.tsx:111`)
   - User adds targets → Creates PENDING results
   - User clicks "Run Extraction" → Calls `simulateExtraction()` → Backend `/api/gemini/extract`
   - Backend uses Gemini API with Google Search grounding
   - Updates existing result with extracted data via `updateResult()`

2. **Re-run Extraction** (Same handler as initial)
   - User clicks "Re-run Extraction" button (RefreshCw icon)
   - Same flow as initial extraction
   - **Issue:** Overwrites existing data instead of creating new version

3. **Historical Price Tracking** (`handleTrackPriceUpdate` in `ProjectDetail.tsx:341`)
   - Only accessible from History Modal
   - Creates new version using `createNewVersion()`
   - Preserves historical data

### Backend Extraction Endpoint

**File:** `server/routes/gemini.js:278`

- Uses Gemini API with Google Search grounding
- Retry logic with exponential backoff (3 retries)
- Source validation and filtering
- Content extraction from grounding metadata
- Confidence scoring based on data completeness

## Issues Identified

### 🔴 Critical Issues

#### 1. **Data Loss on Re-run Extraction**

**Problem:**
- `handleRunExtraction()` calls `updateResult()` which overwrites existing extraction data
- Historical data is lost when re-running extraction
- Users cannot compare old vs new values after re-running

**Impact:** High - Data integrity issue, loss of historical tracking

**Location:** `pages/ProjectDetail.tsx:111-127`

**Current Code:**
```typescript
const handleRunExtraction = async (item: ExtractionResult) => {
  setProcessingItems(prev => ({ ...prev, [item.id]: true }));
  const data = await simulateExtraction(item.school_name, item.program_name);
  updateResult(item.id, {
    ...data,
    extraction_date: new Date().toISOString().split('T')[0]
  });
  // ❌ Overwrites existing data - no version created
};
```

**Recommendation:**
- Re-run extraction should create a new version by default
- Or provide user choice: "Update existing" vs "Create new version"
- Preserve old data for comparison

#### 2. **Inconsistent Historical Tracking**

**Problem:**
- Two separate mechanisms for re-running:
  1. `handleRunExtraction()` - Overwrites data (used by "Re-run Extraction" button)
  2. `handleTrackPriceUpdate()` - Creates new version (used by History Modal)
- Users might not understand the difference
- No clear indication which action preserves history

**Impact:** High - User confusion, inconsistent behavior

**Location:** 
- `pages/ProjectDetail.tsx:111` (overwrites)
- `pages/ProjectDetail.tsx:341` (creates version)

**Recommendation:**
- Unify behavior: Always create new version on re-run
- Or make it explicit with UI choice
- Update button labels to clarify behavior

### 🟡 Medium Priority Issues

#### 3. **Batch Processing Limitations**

**Problem:**
- No error handling per item - if one fails, continues silently
- No progress indication (X of Y completed)
- Fixed 1-second delay might be inefficient
- No cancellation mechanism
- All-or-nothing approach (no partial success tracking)

**Impact:** Medium - Poor user experience for large batches

**Location:** `pages/ProjectDetail.tsx:143-168`

**Current Code:**
```typescript
const handleRunBatch = async () => {
  setIsBatchProcessing(true);
  const pendingItems = filteredResults.filter(r => r.status === ExtractionStatus.PENDING);
  
  for (const item of pendingItems) {
    // ❌ No try-catch per item
    // ❌ No progress tracking
    const data = await simulateExtraction(item.school_name, item.program_name);
    updateResult(item.id, { ...data });
    await new Promise(resolve => setTimeout(resolve, 1000)); // Fixed delay
  }
};
```

**Recommendation:**
- Add error handling per item with retry option
- Show progress: "Processing 5 of 20..."
- Track success/failure counts
- Allow cancellation
- Configurable delay or adaptive rate limiting

#### 4. **Error Handling & User Feedback**

**Problem:**
- Frontend catches errors but doesn't show user-friendly messages
- No retry UI for failed extractions
- Backend retries automatically, but frontend doesn't know
- Failed extractions just show "Failed" status with no context

**Impact:** Medium - Poor error recovery experience

**Location:**
- `services/geminiService.ts:186-269` (frontend error handling)
- `server/routes/gemini.js:278-580` (backend extraction)

**Recommendation:**
- Show toast notifications for extraction failures
- Provide "Retry" button on failed results
- Display error messages in audit modal
- Show retry attempts in UI

#### 5. **Missing Extraction Metadata**

**Problem:**
- No tracking of extraction duration
- No indication of retry attempts
- No source quality metrics
- No extraction method versioning

**Impact:** Low - Limited auditability

**Recommendation:**
- Add `extraction_duration_ms` field
- Track retry attempts in metadata
- Store extraction prompt version
- Add source quality score

### 🟢 Low Priority / Enhancement Opportunities

#### 6. **UI/UX Improvements**

**Issues:**
- "Re-run Extraction" button doesn't indicate it will overwrite data
- History button is separate from re-run (confusing)
- No preview of what will be extracted
- No comparison view after re-running

**Recommendation:**
- Add tooltip: "Re-run will create a new version"
- Combine re-run and history into single action menu
- Show extraction preview before confirming
- Auto-open comparison view after re-run

#### 7. **Performance Optimizations**

**Issues:**
- Sequential batch processing is slow
- No caching of recent extractions
- No deduplication of identical requests

**Recommendation:**
- Parallel processing with rate limiting (e.g., 3 concurrent)
- Cache recent extractions (same school/program within 24h)
- Deduplicate identical requests in batch

#### 8. **Source Validation Enhancement**

**Issues:**
- Blocked domains list is hardcoded
- No user feedback when sources are blocked
- No way to override blocked domains

**Recommendation:**
- Make blocked domains configurable
- Show warning when sources are filtered
- Allow admin override for specific cases

## Positive Aspects

### ✅ Strengths

1. **Robust Backend Retry Logic**
   - Exponential backoff with jitter
   - Handles transient errors gracefully
   - Well-implemented retry configuration

2. **Source Validation**
   - Filters out third-party sites
   - Validates .edu domains
   - Extracts actual page content for audit

3. **Comprehensive Data Extraction**
   - Extracts multiple data points (tuition, credits, fees, STEM status)
   - Calculates derived values (total cost)
   - Preserves original stated tuition

4. **Historical Tracking Infrastructure**
   - Database schema supports versioning
   - API endpoints for history queries
   - Version increment logic is correct

5. **Error Boundaries**
   - Graceful error handling prevents crashes
   - User-friendly error messages

## Recommendations Summary

### Immediate Actions (High Priority)

1. **Fix Data Loss Issue**
   - Modify `handleRunExtraction()` to create new version instead of overwriting
   - Or add user choice dialog: "Update existing" vs "Create new version"

2. **Unify Re-run Behavior**
   - Make re-run extraction always create new version
   - Update UI to reflect this behavior
   - Remove confusion between re-run and track update

3. **Improve Batch Processing**
   - Add error handling per item
   - Show progress indicator
   - Track success/failure counts

### Short-term Improvements (Medium Priority)

4. **Enhanced Error Handling**
   - User-friendly error messages
   - Retry UI for failed extractions
   - Display error context in audit modal

5. **Better User Feedback**
   - Toast notifications for extraction status
   - Progress indicators for batch operations
   - Clear indication of what action will do

### Long-term Enhancements (Low Priority)

6. **Performance Optimizations**
   - Parallel batch processing
   - Caching mechanism
   - Request deduplication

7. **Advanced Features**
   - Extraction preview
   - Comparison view
   - Source quality metrics

## Code Quality Assessment

### Backend (`server/routes/gemini.js`)

**Strengths:**
- Well-structured retry logic
- Comprehensive error handling
- Good logging practices
- Proper source validation

**Areas for Improvement:**
- Extract retry config to centralized config
- Add extraction metadata tracking
- Consider extraction result caching

### Frontend (`pages/ProjectDetail.tsx`)

**Strengths:**
- Clean component structure
- Good state management
- Proper loading states

**Areas for Improvement:**
- Fix data loss on re-run
- Add error handling in batch processing
- Improve user feedback

### Service Layer (`services/geminiService.ts`)

**Strengths:**
- Clean separation of concerns
- Good error handling
- Proper TypeScript types

**Areas for Improvement:**
- Add retry logic on frontend
- Better error messages
- Extraction result caching

## Testing Recommendations

### Unit Tests Needed

1. **Extraction Service**
   - Test error handling
   - Test retry logic
   - Test data transformation

2. **Re-run Extraction**
   - Test version creation
   - Test data preservation
   - Test error scenarios

3. **Batch Processing**
   - Test partial failures
   - Test cancellation
   - Test progress tracking

### Integration Tests Needed

1. **End-to-End Extraction Flow**
   - Test initial extraction
   - Test re-run extraction
   - Test historical tracking

2. **Error Scenarios**
   - Test API failures
   - Test network timeouts
   - Test invalid responses

## Conclusion

The extraction functionality is well-implemented with robust backend retry logic and comprehensive data extraction. However, there are critical issues with data loss on re-run extraction and inconsistent historical tracking behavior that need immediate attention.

**Priority Actions:**
1. Fix re-run extraction to preserve historical data
2. Unify extraction behavior across the application
3. Improve batch processing error handling
4. Enhance user feedback and error messages

**Overall Assessment:** ⚠️ **Good foundation, but critical data integrity issues need fixing**

---

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Project architecture and implementation details
- [CHANGELOG.md](../CHANGELOG.md) - Version history
- [AI_AGENT_COMPARISON.md](../AI_AGENT_COMPARISON.md) - AI extraction improvements






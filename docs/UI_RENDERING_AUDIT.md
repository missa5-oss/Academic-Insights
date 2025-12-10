# UI Rendering Issue Audit Report

**Date:** December 8, 2025  
**Issue:** Extraction results not rendering properly in UI  
**Status:** Root cause identified - database schema missing fields

---

## Problem Summary

The extraction API successfully returns data including `calculated_total_cost` and `additional_fees`, but these fields are not being displayed in the UI because they are not being persisted to the database.

---

## Root Cause Analysis

### 1. Database Schema Missing Columns

The `extraction_results` table schema (defined in `server/db.js`) does not include:
- `calculated_total_cost` (TEXT) - The calculated tuition-only total (cost_per_credit × total_credits)
- `additional_fees` (TEXT) - Technology fees, student services, etc. (separate from tuition)

**Current Schema (lines 39-62 in `server/db.js`):**
```sql
CREATE TABLE IF NOT EXISTS extraction_results (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  school_name TEXT NOT NULL,
  program_name TEXT NOT NULL,
  tuition_amount TEXT,
  tuition_period TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  cost_per_credit TEXT,
  total_credits TEXT,
  program_length TEXT,
  remarks TEXT,
  -- ❌ MISSING: calculated_total_cost TEXT
  -- ❌ MISSING: additional_fees TEXT
  location_data JSONB,
  confidence_score TEXT NOT NULL,
  status TEXT NOT NULL,
  source_url TEXT NOT NULL,
  validated_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  extraction_date TEXT NOT NULL,
  raw_content TEXT NOT NULL,
  is_flagged BOOLEAN DEFAULT FALSE,
  extraction_version INTEGER DEFAULT 1,
  extracted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

### 2. API Response Includes Missing Fields

The extraction endpoint (`server/routes/gemini.js`) correctly returns:
- `calculated_total_cost: "$160083"` (line 534)
- `additional_fees: formatCurrency(extractedData.additional_fees) || null` (line 538)

### 3. Database Operations Don't Persist These Fields

**INSERT Operations (`server/routes/results.js`):**
- Line 138-143: INSERT statement doesn't include `calculated_total_cost` or `additional_fees`
- Line 178-183: Bulk INSERT also missing these fields

**UPDATE Operations (`server/routes/results.js`):**
- Line 216-239: UPDATE statement doesn't include `calculated_total_cost` or `additional_fees` in the SET clause

### 4. Frontend Mapping is Correct

The frontend service (`services/geminiService.ts`) correctly maps these fields:
- Line 235: `calculated_total_cost: data.calculated_total_cost || null`
- Line 237: `additional_fees: data.additional_fees || null`

However, when results are retrieved from the database, these fields are `null` or `undefined` because they were never saved.

---

## Impact

### Fields Not Displayed in UI

1. **`calculated_total_cost`** - Should appear in:
   - Audit Modal (`components/AuditModal.tsx` line 122-135) - Shows comparison between stated tuition and calculated total
   - Data export CSV (`pages/ProjectDetail.tsx` line 191) - Missing from export

2. **`additional_fees`** - Should appear in:
   - Audit Modal (if implemented)
   - Data export CSV (line 197) - Field exists in export headers but data is always empty

### Test Extraction Example

From the test extraction for USC Marshall Part-Time MBA:
- ✅ API returned: `calculated_total_cost: "$160083"`
- ✅ API returned: `additional_fees: null`
- ❌ Database stored: `calculated_total_cost: null` (field doesn't exist)
- ❌ Database stored: `additional_fees: null` (field doesn't exist)
- ❌ UI displays: Missing calculated total cost comparison in Audit Modal

---

## Solution

### Step 1: Add Database Migrations

Add migration code to `server/db.js` after the `is_stem` migration (around line 200):

```javascript
// Add calculated_total_cost column if it doesn't exist (migration)
try {
  await sql`
    ALTER TABLE extraction_results
    ADD COLUMN IF NOT EXISTS calculated_total_cost TEXT DEFAULT NULL
  `;
  logger.info('Migration: calculated_total_cost column added');
} catch (error) {
  logger.debug('Migration: calculated_total_cost column already exists');
}

// Add additional_fees column if it doesn't exist (migration)
try {
  await sql`
    ALTER TABLE extraction_results
    ADD COLUMN IF NOT EXISTS additional_fees TEXT DEFAULT NULL
  `;
  logger.info('Migration: additional_fees column added');
} catch (error) {
  logger.debug('Migration: additional_fees column already exists');
}
```

### Step 2: Update INSERT Statements

**Single INSERT (`server/routes/results.js` line 127-160):**

Add to the INSERT column list (line 138-143):
```javascript
INSERT INTO extraction_results (
  id, project_id, school_name, program_name, tuition_amount,
  tuition_period, academic_year, cost_per_credit, total_credits,
  program_length, remarks, calculated_total_cost, additional_fees,  // ← ADD THESE
  location_data, confidence_score,
  status, source_url, validated_sources, extraction_date, raw_content,
  actual_program_name, user_comments
)
VALUES (
  ${id}, ${project_id}, ${school_name}, ${program_name}, ${tuition_amount},
  ${tuition_period}, ${academic_year}, ${cost_per_credit}, ${total_credits},
  ${program_length}, ${remarks}, ${calculated_total_cost}, ${additional_fees},  // ← ADD THESE
  ${JSON.stringify(location_data)}, ${confidence_score},
  ${status}, ${source_url}, ${JSON.stringify(validated_sources)}, ${extraction_date}, ${raw_content},
  ${actual_program_name || null}, ${user_comments || null}
)
```

**Bulk INSERT (`server/routes/results.js` line 163-203):**

Add to the INSERT column list (line 178-183):
```javascript
INSERT INTO extraction_results (
  id, project_id, school_name, program_name, tuition_amount,
  tuition_period, academic_year, cost_per_credit, total_credits,
  program_length, remarks, calculated_total_cost, additional_fees,  // ← ADD THESE
  location_data, confidence_score,
  status, source_url, validated_sources, extraction_date, raw_content,
  actual_program_name, user_comments
)
VALUES (
  ${id}, ${project_id}, ${school_name}, ${program_name}, ${tuition_amount},
  ${tuition_period}, ${academic_year}, ${cost_per_credit}, ${total_credits},
  ${program_length}, ${remarks}, ${calculated_total_cost}, ${additional_fees},  // ← ADD THESE
  ${JSON.stringify(location_data)}, ${confidence_score},
  ${status}, ${source_url}, ${JSON.stringify(validated_sources)}, ${extraction_date}, ${raw_content},
  ${actual_program_name || null}, ${user_comments || null}
)
```

### Step 3: Update UPDATE Statement

**UPDATE (`server/routes/results.js` line 206-246):**

Add to the destructuring (line 208-214):
```javascript
const {
  tuition_amount, tuition_period, academic_year, cost_per_credit,
  total_credits, program_length, remarks, calculated_total_cost, additional_fees,  // ← ADD THESE
  location_data,
  confidence_score, status, source_url, validated_sources,
  extraction_date, raw_content, is_flagged,
  actual_program_name, user_comments, is_stem, updated_at
} = req.body;
```

Add to the SET clause (line 216-239):
```javascript
SET
  tuition_amount = COALESCE(${tuition_amount}, tuition_amount),
  tuition_period = COALESCE(${tuition_period}, tuition_period),
  academic_year = COALESCE(${academic_year}, academic_year),
  cost_per_credit = COALESCE(${cost_per_credit}, cost_per_credit),
  total_credits = COALESCE(${total_credits}, total_credits),
  program_length = COALESCE(${program_length}, program_length),
  remarks = COALESCE(${remarks}, remarks),
  calculated_total_cost = COALESCE(${calculated_total_cost}, calculated_total_cost),  // ← ADD THIS
  additional_fees = COALESCE(${additional_fees}, additional_fees),  // ← ADD THIS
  location_data = COALESCE(${location_data ? JSON.stringify(location_data) : null}, location_data),
  ...
```

### Step 4: Update TypeScript Types (Optional Verification)

The TypeScript types in `types.ts` already include these fields (lines 61, 63), so no changes needed:
```typescript
calculated_total_cost?: string | null; // cost_per_credit × total_credits when both available
additional_fees?: string | null; // Technology fees, student services, etc.
```

---

## Testing Checklist

After implementing the fix:

- [ ] Run database migrations (restart server to trigger)
- [ ] Verify columns exist: `SELECT calculated_total_cost, additional_fees FROM extraction_results LIMIT 1;`
- [ ] Run a new extraction (USC Marshall Part-Time MBA)
- [ ] Verify `calculated_total_cost` is saved to database
- [ ] Verify `additional_fees` is saved to database (if present in API response)
- [ ] Check Audit Modal displays calculated total cost comparison
- [ ] Check CSV export includes calculated_total_cost and additional_fees with data
- [ ] Verify existing records (without these fields) still load correctly (should show null)

---

## Files to Modify

1. ✅ `server/db.js` - Add migration code for new columns
2. ✅ `server/routes/results.js` - Update INSERT and UPDATE statements
3. ✅ No frontend changes needed (already handles these fields correctly)

---

## Additional Notes

- The API response structure is correct - the issue is purely database persistence
- Frontend code already handles these fields correctly
- This is a backward-compatible change (existing records will have NULL values)
- The migration will run automatically on server restart

---

## Related Code References

- **API Response:** `server/routes/gemini.js:534, 538`
- **Frontend Mapping:** `services/geminiService.ts:235, 237`
- **UI Display:** `components/AuditModal.tsx:122-135`
- **Database Schema:** `server/db.js:39-62`
- **Database Operations:** `server/routes/results.js:127-246`

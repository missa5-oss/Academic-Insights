# Database Schema Audit - extraction_results Table

**Date:** December 10, 2025  
**Table:** `extraction_results`  
**Total Columns:** 27

---

## Complete Column List

| # | Column Name | Data Type | Nullable | Default | Notes |
|---|------------|-----------|----------|---------|-------|
| 1 | `id` | TEXT | NO | NULL | Primary Key |
| 2 | `project_id` | TEXT | NO | NULL | Foreign Key → projects(id) |
| 3 | `school_name` | TEXT | NO | NULL | Required |
| 4 | `program_name` | TEXT | NO | NULL | Required |
| 5 | `tuition_amount` | TEXT | YES | NULL | Main tuition field |
| 6 | `tuition_period` | TEXT | NO | NULL | Required (e.g., "per year", "full program") |
| 7 | `academic_year` | TEXT | NO | NULL | Required (e.g., "2024-2025") |
| 8 | `cost_per_credit` | TEXT | YES | NULL | Per-credit cost |
| 9 | `total_credits` | TEXT | YES | NULL | Total credits required |
| 10 | `program_length` | TEXT | YES | NULL | Duration (e.g., "2 years", "18 months") |
| 11 | `remarks` | TEXT | YES | NULL | Additional notes |
| 12 | `location_data` | JSONB | YES | NULL | Campus location (address, map_url, lat/lng) |
| 13 | `confidence_score` | TEXT | NO | NULL | CHECK: 'High', 'Medium', 'Low' |
| 14 | `status` | TEXT | NO | NULL | CHECK: 'Success', 'Not Found', 'Pending', 'Failed' |
| 15 | `source_url` | TEXT | NO | NULL | Primary source URL |
| 16 | `validated_sources` | JSONB | NO | `'[]'::jsonb` | Array of source objects |
| 17 | `extraction_date` | TEXT | NO | NULL | Date string (YYYY-MM-DD) |
| 18 | `raw_content` | TEXT | NO | NULL | Content summary from extraction |
| 19 | `is_flagged` | BOOLEAN | YES | `false` | Manual flag for review |
| 20 | `extraction_version` | INTEGER | YES | `1` | Version number for history |
| 21 | `extracted_at` | TIMESTAMP | YES | `CURRENT_TIMESTAMP` | When extraction ran |
| 22 | `actual_program_name` | TEXT | YES | NULL | Official program name from website |
| 23 | `user_comments` | TEXT | YES | NULL | User-editable comments |
| 24 | `is_stem` | BOOLEAN | YES | NULL | STEM designation (true/false/null) |
| 25 | `updated_at` | TIMESTAMP | YES | NULL | Last update timestamp |
| 26 | `calculated_total_cost` | TEXT | YES | NULL | cost_per_credit × total_credits |
| 27 | `additional_fees` | TEXT | YES | NULL | Fees separate from tuition |

---

## Schema Analysis

### Required Fields (NOT NULL)
- `id`, `project_id`, `school_name`, `program_name`
- `tuition_period`, `academic_year`
- `confidence_score`, `status`, `source_url`
- `validated_sources` (defaults to empty array `[]`)
- `extraction_date`, `raw_content`

### Optional Fields (NULLABLE)
- All tuition/metadata fields: `tuition_amount`, `cost_per_credit`, `total_credits`, etc.
- `calculated_total_cost`, `additional_fees` (recently added)
- `location_data`, `remarks`, `actual_program_name`, `user_comments`
- `is_stem`, `is_flagged`
- Timestamps: `extracted_at`, `updated_at`

### Data Type Issues

1. **TEXT for Numeric Fields:**
   - `tuition_amount`, `cost_per_credit`, `calculated_total_cost`, `additional_fees` are TEXT
   - This is intentional to preserve formatting (e.g., "$160,073 total")
   - ✅ Correct design choice

2. **TEXT for Dates:**
   - `extraction_date` is TEXT (not DATE/TIMESTAMP)
   - `extracted_at` is TIMESTAMP (proper type)
   - ⚠️ Inconsistency: `extraction_date` should probably be DATE or removed in favor of `extracted_at`

3. **JSONB Fields:**
   - `location_data`: `{ address, map_url, latitude, longitude }`
   - `validated_sources`: `[{ title, url, raw_content }]`
   - ✅ Correct use of JSONB

---

## Comparison with API Response

### API Returns (`server/routes/gemini.js`)

```javascript
{
  tuition_amount: "$160,073 total",           // ✅ Maps to column 5
  tuition_period: "full program",             // ✅ Maps to column 6
  academic_year: "2024-2025",                 // ✅ Maps to column 7
  cost_per_credit: "$2,541",                  // ✅ Maps to column 8
  total_credits: "63",                         // ✅ Maps to column 9
  calculated_total_cost: "$160083",           // ✅ Maps to column 26
  program_length: "33 months",                // ✅ Maps to column 10
  actual_program_name: "Part-Time MBA...",    // ✅ Maps to column 22
  is_stem: false,                             // ✅ Maps to column 24
  additional_fees: null,                      // ✅ Maps to column 27
  remarks: "...",                              // ✅ Maps to column 11
  confidence_score: "Medium",                 // ✅ Maps to column 13
  status: "Success",                          // ✅ Maps to column 14
  source_url: "...",                          // ✅ Maps to column 15
  validated_sources: [...],                   // ✅ Maps to column 16
  raw_content: "..."                          // ✅ Maps to column 18
}
```

**All API fields map correctly to database columns.** ✅

---

## Comparison with UI Expectations

### UI Displays (`components/AuditModal.tsx`, `pages/ProjectDetail.tsx`)

**Fields Used:**
- `tuition_amount` (line 118) - ✅ Column 5
- `calculated_total_cost` (line 122) - ✅ Column 26
- `cost_per_credit` (line 132) - ✅ Column 8
- `total_credits` (line 132) - ✅ Column 9
- `validated_sources` (line 411) - ✅ Column 16
- `raw_content` (line 503) - ✅ Column 18
- `additional_fees` (line 313) - ✅ Column 27
- `actual_program_name` (line 331) - ✅ Column 22
- `is_stem` (line 335) - ✅ Column 24
- `location_data` (line 302) - ✅ Column 12

**All UI fields map correctly to database columns.** ✅

---

## Potential Issues

### Issue 1: Required Fields with NULL Defaults

**Problem:** Several required fields (NOT NULL) have NULL defaults:
- `tuition_period` (NOT NULL, default NULL)
- `academic_year` (NOT NULL, default NULL)
- `confidence_score` (NOT NULL, default NULL)
- `status` (NOT NULL, default NULL)
- `source_url` (NOT NULL, default NULL)
- `extraction_date` (NOT NULL, default NULL)
- `raw_content` (NOT NULL, default NULL)

**Impact:** These fields MUST be provided on INSERT, or PostgreSQL will error.

**Fix:** Either:
1. Make them nullable (allow NULL)
2. Provide default values (e.g., `tuition_period DEFAULT 'N/A'`)

### Issue 2: Inconsistent Date Handling

**Problem:** Two date fields:
- `extraction_date` (TEXT) - String format
- `extracted_at` (TIMESTAMP) - Proper timestamp

**Impact:** Redundant, potential for inconsistency.

**Recommendation:** Consider removing `extraction_date` and using only `extracted_at`.

### Issue 3: validated_sources Default

**Current:** `validated_sources JSONB NOT NULL DEFAULT '[]'::jsonb`

**Status:** ✅ Good - empty array is better than NULL for JSONB arrays.

---

## Recommendations

### 1. Fix Required Fields with NULL Defaults

**Option A: Make them nullable** (if they can legitimately be missing)
```sql
ALTER TABLE extraction_results 
  ALTER COLUMN tuition_period DROP NOT NULL,
  ALTER COLUMN academic_year DROP NOT NULL,
  ALTER COLUMN confidence_score DROP NOT NULL,
  ALTER COLUMN status DROP NOT NULL,
  ALTER COLUMN source_url DROP NOT NULL,
  ALTER COLUMN extraction_date DROP NOT NULL,
  ALTER COLUMN raw_content DROP NOT NULL;
```

**Option B: Add default values** (if they should always have a value)
```sql
ALTER TABLE extraction_results 
  ALTER COLUMN tuition_period SET DEFAULT 'N/A',
  ALTER COLUMN academic_year SET DEFAULT '2025-2026',
  ALTER COLUMN confidence_score SET DEFAULT 'Low',
  ALTER COLUMN status SET DEFAULT 'Pending',
  ALTER COLUMN source_url SET DEFAULT '',
  ALTER COLUMN extraction_date SET DEFAULT '',
  ALTER COLUMN raw_content SET DEFAULT '';
```

### 2. Standardize Date Fields

**Recommendation:** Keep `extracted_at` (TIMESTAMP), remove `extraction_date` (TEXT) after migration.

---

## Schema Summary

✅ **All 27 columns are present and correctly typed**  
✅ **API response maps to all columns**  
✅ **UI expects all columns**  
⚠️ **Some required fields have NULL defaults (needs fix)**  
⚠️ **Date field redundancy (extraction_date vs extracted_at)**

---

## Next Steps

1. Fix required fields with NULL defaults
2. Verify INSERT/UPDATE statements handle all fields
3. Test data flow: API → Database → UI

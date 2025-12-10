# Extraction UI Rendering Fixes

**Date:** December 10, 2025  
**Status:** Issues identified, fixes needed

---

## Issues Identified

### Issue 1: Empty Tuition Amount

**Problem:** The main `tuition_amount` field is showing empty in the UI.

**Root Causes:**
1. Extraction might be returning `status: 'Not Found'` which sets `tuition_amount: null`
2. The `formatCurrency()` function might be returning null for empty values
3. Database UPDATE might not be saving the value correctly

**Fix Required:**
- Verify extraction is not incorrectly returning "Not Found"
- Ensure `formatCurrency()` handles null gracefully
- Add logging to track when `tuition_amount` becomes null

### Issue 2: Validated Sources Showing Google Link

**Problem:** The "Validated Official Sources" section shows "LEGACY SOURCE" with a Google search URL and "Program not found at this school."

**Root Causes:**
1. When extraction returns `status: 'Not Found'`, `validated_sources: []` is returned
2. When `validated_sources` is empty, UI falls back to showing `source_url` (Google search URL)
3. The `raw_content` shows "Program not found at this school." which comes from the "Not Found" response

**Fix Required:**
- Verify why extraction is returning "Not Found" when it should find the program
- Check if grounding chunks are being extracted properly
- Ensure validated sources are populated even when status is "Not Found" (if sources were found)

---

## Code Issues Found

### 1. UPDATE Statement COALESCE Logic

**Location:** `server/routes/results.js:226-246`

**Issue:** The COALESCE logic means if `tuition_amount` is `null` in the update, it keeps the existing value. But if the extraction returns `null`, it will overwrite a good value with `null`.

**Current Code:**
```javascript
tuition_amount = COALESCE(${tuition_amount}, tuition_amount),
```

**Problem:** If `tuition_amount` is explicitly `null` (from "Not Found" response), it will set the field to null, overwriting any existing value.

**Fix:** Should check if the value is `undefined` vs `null`:
- `undefined` = don't update (keep existing)
- `null` = explicitly set to null (from "Not Found")

### 2. Validated Sources Empty Array Handling

**Location:** `server/routes/results.js:239`

**Issue:** When `validated_sources` is an empty array `[]`, it gets serialized and saved. But the UI treats empty array as "no sources" and shows fallback.

**Current Code:**
```javascript
validated_sources = COALESCE(${validated_sources ? JSON.stringify(validated_sources) : null}, validated_sources),
```

**Problem:** Empty array `[]` is truthy, so it gets saved as `"[]"`. UI then sees empty array and shows "LEGACY SOURCE".

**Fix:** Should check if array has length > 0 before saving, or handle empty arrays differently.

### 3. "Not Found" Early Return

**Location:** `server/routes/gemini.js:314-333`

**Issue:** When AI returns "Not Found", the endpoint returns early with empty `validated_sources` even if Google Search found sources.

**Current Code:**
```javascript
if (extractedData.status === 'Not Found') {
  return res.json({
    validated_sources: [],  // Always empty for "Not Found"
    raw_content: 'Program not found at this school.'
  });
}
```

**Problem:** Even if Google Search found official sources, they're discarded if AI says "Not Found".

**Fix:** Should still populate `validated_sources` from grounding chunks even if program is "Not Found", so user can verify.

---

## Recommended Fixes

### Fix 1: Preserve Validated Sources Even for "Not Found"

**File:** `server/routes/gemini.js`

**Change:** Move the "Not Found" check to AFTER source extraction, so sources are still included.

```javascript
// BEFORE: Early return (line 314)
if (extractedData.status === 'Not Found') {
  return res.json({ ... });
}

// AFTER: Extract sources first, then check status
// ... extract sources code ...
if (extractedData.status === 'Not Found') {
  return res.json({
    ...,
    validated_sources: validatedSources,  // Include sources even if "Not Found"
  });
}
```

### Fix 2: Don't Overwrite Good Data with Null

**File:** `server/routes/results.js`

**Change:** Only update `tuition_amount` if it's not explicitly null (or handle null differently).

```javascript
// Current:
tuition_amount = COALESCE(${tuition_amount}, tuition_amount),

// Better: Only update if value is provided and not null
tuition_amount = CASE 
  WHEN ${tuition_amount} IS NOT NULL THEN ${tuition_amount}
  ELSE tuition_amount
END,
```

### Fix 3: Handle Empty Validated Sources Array

**File:** `server/routes/results.js`

**Change:** Don't save empty arrays, or handle them as "no update".

```javascript
// Current:
validated_sources = COALESCE(${validated_sources ? JSON.stringify(validated_sources) : null}, validated_sources),

// Better: Check array length
validated_sources = CASE
  WHEN ${validated_sources && validated_sources.length > 0} THEN ${JSON.stringify(validated_sources)}
  WHEN ${validated_sources === null} THEN NULL
  ELSE validated_sources
END,
```

---

## Testing Plan

1. **Test Successful Extraction:**
   - Run extraction for USC Marshall Part-Time MBA
   - Verify `tuition_amount` is saved
   - Verify `validated_sources` has 3 items
   - Check UI displays both correctly

2. **Test "Not Found" Extraction:**
   - Run extraction for non-existent program
   - Verify sources are still included (if found)
   - Verify UI shows sources even with "Not Found" status

3. **Test Data Persistence:**
   - Run extraction
   - Refresh page
   - Verify data persists in UI
   - Check database directly

---

## Files to Modify

1. `server/routes/gemini.js` - Move "Not Found" check after source extraction
2. `server/routes/results.js` - Fix UPDATE statement to handle null/empty better
3. Add logging to track data flow

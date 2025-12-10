# Extraction to UI Rendering Audit

**Date:** December 10, 2025  
**Issues Reported:**
1. Main tuition field (`tuition_amount`) showing empty
2. Validated Official Sources showing "Program not found" with Google search link instead of actual sources

---

## Issue Analysis

### Issue 1: Empty Tuition Amount Field

**Root Cause:**
The `tuition_amount` field can be empty/null in several scenarios:

1. **"Not Found" Status** (`server/routes/gemini.js:314-333`):
   - When extraction returns `status: 'Not Found'`, the API returns `tuition_amount: null`
   - This happens when the AI determines the program doesn't exist at the school

2. **Format Currency Issue** (`server/routes/gemini.js:529`):
   - `formatCurrency(tuitionAmount)` might return null if `tuitionAmount` is null
   - If the extraction doesn't find a total tuition OR per-credit + credits, `tuitionAmount` stays null

3. **Database Storage Issue**:
   - The field might not be saved properly if it's null
   - The database column accepts TEXT and NULL values

**Code Flow:**
```javascript
// Line 499: tuitionAmount starts as extractedData.tuition_amount or null
let tuitionAmount = extractedData.tuition_amount || null;

// Line 502-509: Only calculates if no total but has per-credit + credits
if (!tuitionAmount && costPerCreditRaw && totalCreditsRaw) {
  // Calculate from per-credit × credits
}

// Line 529: Format and return
tuition_amount: formatCurrency(tuitionAmount),  // Could be null
```

**UI Display** (`components/AuditModal.tsx:118`):
```tsx
{data.tuition_amount || <span className="text-slate-400 italic text-sm">Not found</span>}
```

### Issue 2: Validated Sources Showing Google Link

**Root Cause:**
The `validated_sources` array is empty, causing the UI to fall back to "LEGACY SOURCE" display.

**Scenarios Where `validated_sources` is Empty:**

1. **"Not Found" Status** (`server/routes/gemini.js:330`):
   ```javascript
   if (extractedData.status === 'Not Found') {
     return res.json({
       validated_sources: [],  // Empty array
       raw_content: 'Program not found at this school.'
     });
   }
   ```

2. **No Grounding Chunks** (`server/routes/gemini.js:352-465`):
   - If `groundingChunks` is empty or null, `validatedSources` stays empty
   - If all sources are blocked (third-party sites), `validatedSources` is empty
   - If no valid `.edu` sources found, `validatedSources` is empty

3. **Fallback to Google URL** (`server/routes/gemini.js:468-474`):
   ```javascript
   if (validatedSources.length > 0) {
     primarySourceUrl = validatedSources[0].url;
   } else {
     primarySourceUrl = `https://www.google.com/search?q=...`;  // Fallback
   }
   ```

**UI Display** (`components/AuditModal.tsx:526-548`):
- When `data.validated_sources` is empty or null, shows "LEGACY SOURCE" section
- Displays `data.source_url` (which is the Google search fallback URL)
- Shows `data.raw_content` (which says "Program not found at this school.")

---

## Data Flow Analysis

### Successful Extraction Flow (Expected)

1. **API Response** (`server/routes/gemini.js:528-545`):
   ```json
   {
     "tuition_amount": "$160,073 total",
     "calculated_total_cost": "$160083",
     "status": "Success",
     "validated_sources": [
       {"title": "usc.edu", "url": "...", "raw_content": "..."}
     ],
     "raw_content": "The first year of core courses..."
   }
   ```

2. **Frontend Mapping** (`services/geminiService.ts:226-257`):
   - Maps API response to `ExtractionResult` type
   - All fields should be preserved

3. **Database Storage** (`server/routes/results.js:206-246`):
   - UPDATE statement should save all fields including `tuition_amount` and `validated_sources`

4. **UI Display**:
   - `AuditModal.tsx:118` shows `tuition_amount`
   - `AuditModal.tsx:411-525` shows `validated_sources` array

### Problem Flow (Current Issue)

1. **Extraction Returns "Not Found"**:
   - API returns `tuition_amount: null`
   - API returns `validated_sources: []`
   - API returns `raw_content: 'Program not found at this school.'`

2. **Database Stores Null/Empty**:
   - `tuition_amount` is NULL in database
   - `validated_sources` is empty array `[]`

3. **UI Shows Fallback**:
   - Tuition field shows "Not found"
   - Sources section shows "LEGACY SOURCE" with Google search URL

---

## Potential Root Causes

### 1. Extraction Actually Returning "Not Found"

**Check:**
- Logs show extraction started but may have returned "Not Found"
- The AI might be incorrectly determining the program doesn't exist
- The prompt might need adjustment

**Evidence from Logs:**
- Latest extraction at `19:23:52` started but no completion log
- Previous extraction at `19:18:43` was successful with tuition "$160,073 total"

### 2. Grounding Chunks Not Being Extracted

**Check:**
- `groundingChunks` array might be empty
- `groundingSupports` might be empty
- Google Search grounding might not be returning results

**Code Location:**
- `server/routes/gemini.js:352-353` - Gets grounding chunks
- `server/routes/gemini.js:355-465` - Processes and validates sources

### 3. Data Not Being Saved to Database

**Check:**
- UPDATE statement might not be saving `tuition_amount` properly
- `validated_sources` JSONB might not be serialized correctly
- Database transaction might be failing silently

**Code Location:**
- `server/routes/results.js:206-246` - UPDATE statement
- `context/AppContext.tsx:258-291` - Frontend update call

---

## Recommended Fixes

### Fix 1: Verify Extraction Status

**Action:** Check if the extraction is actually returning "Not Found" or if it's successful but data isn't being saved.

**Steps:**
1. Check browser console for extraction response
2. Check server logs for "Extraction success" message
3. Verify the extraction actually found the program

### Fix 2: Ensure Grounding Chunks Are Processed

**Action:** Verify that grounding chunks are being extracted and processed correctly.

**Code Check:**
- `server/routes/gemini.js:352-353` - Should have grounding chunks
- `server/routes/gemini.js:355-465` - Should populate `validatedSources`

### Fix 3: Verify Database Update

**Action:** Ensure the UPDATE statement is saving all fields correctly.

**Code Check:**
- `server/routes/results.js:233-234` - Should include `calculated_total_cost` and `additional_fees`
- Verify JSONB serialization for `validated_sources`

### Fix 4: Add Better Error Handling

**Action:** Add logging to track where data is being lost.

**Add Logging:**
- Log when `validatedSources` is empty and why
- Log when `tuitionAmount` is null and why
- Log database UPDATE results

---

## Testing Checklist

- [ ] Run a new extraction for USC Marshall Part-Time MBA
- [ ] Check browser console for API response
- [ ] Check server logs for extraction completion
- [ ] Verify `tuition_amount` is in API response
- [ ] Verify `validated_sources` array has items in API response
- [ ] Check database to see if data was saved
- [ ] Verify UI displays the data correctly
- [ ] Check if "Not Found" status is being returned incorrectly

---

## Files to Review

1. `server/routes/gemini.js` - Extraction endpoint logic
2. `server/routes/results.js` - Database UPDATE statement
3. `services/geminiService.ts` - Frontend API mapping
4. `context/AppContext.tsx` - State management and database sync
5. `components/AuditModal.tsx` - UI display logic

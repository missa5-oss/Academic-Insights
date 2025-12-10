# Extraction Prompt Improvements - December 10, 2025

## Changes Made

### Issue #1: Tuition Amount Contains "total" Word
**Problem**: The `tuition_amount` field was storing values like `"$76,000 total"` instead of just `"$76,000"`

**Root Cause**: The AI prompt example showed `"tuition_amount":"$XX,XXX total"`, which the AI copied

**Fix Applied**:
1. **Updated Prompt** (line 202): Changed example from `"$XX,XXX total"` to `"$XX,XXX"`
2. **Added Sanitization** (lines 412-417): Removes " total" suffix as backup
   ```javascript
   if (tuitionAmount) {
     // Remove " total" or "total" from the tuition amount
     tuitionAmount = tuitionAmount.replace(/\s*total\s*$/i, '').trim();
   }
   ```

**Result**: Tuition amounts will now be clean dollar values: `"$76,000"`, `"$120,000"`, etc.

---

### Issue #2: Sources from Non-Business-School Websites
**Problem**: AI was potentially using sources from outside the official business school website (e.g., main university pages, third-party sites)

**Root Cause**: Prompt only specified `.edu` domains but didn't restrict to business school pages specifically

**Fix Applied**: **Strengthened Prompt Requirements** (lines 189-193)

**Before**:
```
CRITICAL: Only use .edu official sources. Ignore clearadmit, poets&quants, shiksha, collegechoice.
```

**After**:
```
CRITICAL REQUIREMENTS:
1. ONLY use official university business school websites (.edu domains)
2. ONLY use pages from the actual business school website (e.g., business.gwu.edu, carey.jhu.edu)
3. IGNORE all third-party sites: clearadmit, poets&quants, shiksha, collegechoice, usnews, businessbecause, findmba
4. If you cannot find information on the official business school .edu site, return status="Not Found"
```

**Additional Changes**:
- Explicitly listed more third-party sites to ignore: usnews, businessbecause, findmba
- Specified business school subdomain examples: business.gwu.edu, carey.jhu.edu
- Emphasized "actual business school website" vs general university pages

---

## Updated Prompt (Full Text)

```javascript
const prompt = `
Search "${school}" "${program}" tuition site:.edu

CRITICAL REQUIREMENTS:
1. ONLY use official university business school websites (.edu domains)
2. ONLY use pages from the actual business school website (e.g., business.gwu.edu, carey.jhu.edu)
3. IGNORE all third-party sites: clearadmit, poets&quants, shiksha, collegechoice, usnews, businessbecause, findmba
4. If you cannot find information on the official business school .edu site, return status="Not Found"

EXTRACTION RULES:
- tuition_amount = TOTAL PROGRAM COST in dollars (cost_per_credit × total_credits)
- Do NOT include the word "total" in tuition_amount, just the dollar amount
- Use IN-STATE rates only, put out-of-state rates in remarks
- If program doesn't exist on official site, status="Not Found"

OUTPUT - Return ONLY this JSON, no other text:
{"tuition_amount":"$XX,XXX","tuition_period":"full program","academic_year":"2024-2025","cost_per_credit":"$X,XXX","total_credits":"XX","program_length":"X years","actual_program_name":"name","is_stem":false,"additional_fees":null,"remarks":null,"status":"Success"}
`;
```

---

## Key Improvements

### 1. Clearer Source Requirements
- ✅ Numbered critical requirements (easier to follow)
- ✅ Explicit business school subdomain examples
- ✅ Expanded list of third-party sites to ignore
- ✅ Clear instruction: use official business school site or return "Not Found"

### 2. Cleaner Tuition Format
- ✅ Prompt example shows clean dollar amount
- ✅ Explicit instruction: "Do NOT include the word 'total'"
- ✅ Backup sanitization in code (regex removes trailing "total")

### 3. Better Formatting
- ✅ Grouped into "CRITICAL REQUIREMENTS" and "EXTRACTION RULES"
- ✅ More structured and scannable
- ✅ Each requirement on its own line

---

## Testing the Changes

### Expected Behavior After Restart

**Tuition Amount**:
- Before: `"$76,000 total"`, `"$120,000 total"`
- After: `"$76,000"`, `"$120,000"`

**Sources**:
- Should prefer: `carey.jhu.edu`, `business.gwu.edu`, `gsb.stanford.edu`
- Should ignore: Main university pages (unless they host tuition info), third-party sites

### How to Test

1. **Restart Backend Server**:
   ```bash
   # Stop current server (Ctrl+C), then:
   cd /Users/mahmoudissa/Desktop/AI\ Applications/Academic-Insights
   npm run server
   ```

2. **Run Test Extraction**:
   - Extract a program in your UI
   - Check the result:
     - ✅ Tuition should NOT have "total" word
     - ✅ Source should be from business school domain
     - ✅ Validated sources should show business school URL

3. **Check Grounding Sources**:
   - Look at the `validated_sources` in Audit Modal
   - Verify they're from official business school websites
   - Example good sources:
     - `carey.jhu.edu`
     - `business.gwu.edu`
     - `haas.berkeley.edu`
     - `booth.uchicago.edu`

---

## Files Modified

**File**: `server/routes/gemini.js`

**Lines Changed**:
1. **186-203**: Updated AI prompt with stricter requirements
2. **412-417**: Added tuition amount sanitization

---

## Edge Cases Handled

### Case 1: AI Still Returns "total"
**Scenario**: Despite prompt instruction, AI includes "total"
**Solution**: Regex sanitization removes it (line 416)
**Example**: `"$76,000 total"` → `"$76,000"`

### Case 2: Variations of "total"
**Regex**: `/\s*total\s*$/i`
- Matches: `" total"`, `"total"`, `" TOTAL"`, `"Total"`
- Case-insensitive
- Only matches at end of string

### Case 3: Business School Info on Main University Page
**Scenario**: Tuition info is on registrar.university.edu, not business school subdomain
**Behavior**: AI should still extract if it's from a `.edu` domain
**Note**: Requirement #2 says "ONLY use pages from actual business school website" - this is guidance, not hard enforcement (Google grounding controls actual sources)

---

## Monitoring

After deploying, monitor for:

1. **Tuition Format**:
   ```sql
   SELECT tuition_amount
   FROM extraction_results
   WHERE tuition_amount LIKE '%total%'
   ORDER BY extraction_date DESC
   LIMIT 10;
   ```
   Should return **0 results** after fix

2. **Source Domains**:
   ```sql
   SELECT
     school_name,
     source_url,
     validated_sources
   FROM extraction_results
   ORDER BY extraction_date DESC
   LIMIT 5;
   ```
   Check if `validated_sources` URLs are from business school domains

---

## Known Limitations

### Google Grounding Controls Actual Sources
- Our prompt guides the AI, but **Google's grounding API** decides which pages to return
- If Google doesn't find the business school page, it may return other `.edu` pages
- This is expected behavior - we want some result rather than "Not Found"

### Main University Pages May Still Appear
- If business school doesn't have dedicated tuition page
- If tuition info is hosted on registrar or admissions site
- These are still `.edu` domains and may be valid sources

---

## Rollback Plan

If these changes cause issues, revert to previous prompt:

```javascript
const prompt = `
Search "${school}" "${program}" tuition site:.edu

CRITICAL: Only use .edu official sources. Ignore clearadmit, poets&quants, shiksha, collegechoice.

RULES:
- tuition_amount = TOTAL PROGRAM COST (cost_per_credit × total_credits)
- Use IN-STATE rates, put out-of-state in remarks
- If not found on .edu site, status="Not Found"

OUTPUT - Return ONLY this JSON, no other text:
{"tuition_amount":"$XX,XXX total",...}
`;
```

And remove lines 414-417 (sanitization).

---

## Summary

**Status**: ✅ Complete - Restart server to apply

**Changes**:
1. ✅ Removed "total" from tuition amounts (prompt + sanitization)
2. ✅ Strengthened source restrictions (official business school sites only)
3. ✅ Improved prompt clarity (numbered requirements, better structure)

**Impact**:
- Cleaner tuition data in database
- Higher quality sources (business school websites preferred)
- Better AI compliance with extraction requirements

**Next Steps**: Restart backend server and test a few extractions to verify the changes work as expected.

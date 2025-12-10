# Multi-Query Extraction Solution

**Date:** December 8, 2025  
**Problem:** Google Search was not returning accurate results because the extraction prompt requested too much information (11+ fields) that are often spread across different pages.

## Problem Analysis

The original extraction prompt asked for:
- Tuition information (cost_per_credit, stated_tuition, tuition_period, academic_year)
- Curriculum information (total_credits, program_length)
- Program details (actual_program_name, is_stem)
- Additional data (additional_fees, remarks)

**Issue:** These fields are typically found on different pages:
- **Tuition & Fees page**: Contains cost_per_credit, stated_tuition, fees
- **Curriculum/Requirements page**: Contains total_credits, program_length
- **Program Overview page**: Contains actual_program_name, is_stem designation

A single Google Search query trying to find all this information on one page often fails or returns incomplete results.

## Solution: Focused Multi-Query Approach

Instead of one complex query, we now use **two focused searches**:

### Step 1: Tuition Extraction (Primary)
- **Focus**: Find the official tuition and fees page
- **Extracts**: `stated_tuition`, `tuition_period`, `academic_year`, `cost_per_credit`, `additional_fees`, `remarks`
- **Purpose**: Get the core financial information

### Step 2: Credits Extraction (Secondary - Conditional)
- **Trigger**: Only runs if `cost_per_credit` or `total_credits` is missing from Step 1
- **Focus**: Find the official curriculum or program requirements page
- **Extracts**: `total_credits`, `program_length`, `actual_program_name`, `is_stem`
- **Purpose**: Fill in missing curriculum/program details

### Step 3: Data Merging
- Combines results from both searches
- Tuition data takes priority (more reliable)
- Credits data fills gaps where tuition data is missing
- Calculates `calculated_total_cost` if both `cost_per_credit` and `total_credits` are available

### Step 4: Source Aggregation
- Combines grounding chunks from both searches
- Deduplicates sources by URL
- Provides up to 3 validated sources for audit trail

## Benefits

1. **Better Accuracy**: Each search is focused on finding specific information, leading to more accurate results
2. **Efficient**: Only does second search if needed (conditional execution)
3. **Cost-Effective**: Most extractions only require 1 API call (tuition). Second call only when credits are missing
4. **Better Source Coverage**: Combines sources from both searches for comprehensive audit trail
5. **Maintains Speed**: Still fast for most cases (single search), only slower when credits search is needed

## Implementation Details

### New Functions

1. **`extractTuitionInfo(ai, school, program)`**
   - Focused prompt for tuition/fees data
   - Returns JSON with tuition-specific fields
   - Uses Google Search grounding

2. **`extractCreditsInfo(ai, school, program)`**
   - Focused prompt for curriculum/credits data
   - Returns JSON with credits/program-specific fields
   - Uses Google Search grounding

### Modified Endpoint

**`POST /api/gemini/extract`** now:
1. Calls `extractTuitionInfo()` first
2. Checks if program exists (early return if "Not Found")
3. Conditionally calls `extractCreditsInfo()` if credits are missing
4. Merges data from both extractions
5. Combines sources from both searches
6. Calculates confidence based on data completeness
7. Returns unified result

### Confidence Scoring

Enhanced to reflect data completeness:
- **High**: Has `cost_per_credit`, `total_credits`, and `calculated_total_cost`
- **Medium**: Has `stated_tuition` but missing credits
- **Low**: Missing key tuition data

## Performance Impact

- **Best Case** (credits found in tuition search): 1 API call (same as before)
- **Typical Case** (credits on separate page): 2 API calls (~2x slower, but more accurate)
- **Worst Case** (both searches needed): 2 API calls

**Trade-off**: Slightly slower for some cases, but significantly more accurate results.

## Testing Recommendations

1. Test with schools where tuition and credits are on different pages
2. Verify that conditional logic works (only searches credits when needed)
3. Check that source aggregation combines sources correctly
4. Validate confidence scoring reflects data completeness

## Future Enhancements

Potential improvements:
1. Cache credits data per school (credits rarely change)
2. Parallel execution of both searches (if credits are always needed)
3. Add more focused searches for other missing fields (STEM designation, etc.)
4. Implement retry logic with different search strategies if first attempt fails

---

**Status**: ✅ Implemented and ready for testing

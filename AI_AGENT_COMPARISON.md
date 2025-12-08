# AI Agent Search Comparison: Old vs Current Version

## Executive Summary

**Old Version (Better Performance):** Simple, concise prompt that trusted Gemini's search capabilities  
**Current Version (Issues):** Over-engineered with excessive validation that may be blocking valid results

---

## Key Differences

### 1. **Prompt Structure**

#### OLD VERSION (Simple & Effective)
```javascript
const prompt = `
  Act as a strict tuition data extraction agent.

  Target: "${school}" "${program}"

  CRITICAL RULES:
  1. SOURCE VERIFICATION: You must ONLY extract data from the OFFICIAL university or business school website...
  2. MULTI-SOURCE VALIDATION: Attempt to find up to 2 distinct official pages...
  3. IN-STATE PREFERENCE: If the website lists both "In-State" and "Out-of-State" tuition...
  4. CONFIDENCE SCORING: If you CANNOT find the "total_credits"...
  5. STATUS: If you cannot find the data on the official website...

  Task: Search for the official tuition and fees...
  
  JSON Schema: { ... }
`;
```

**Characteristics:**
- ✅ Concise and direct
- ✅ Clear rules without excessive structure
- ✅ Trusts Gemini to interpret instructions
- ✅ ~50 lines total

#### CURRENT VERSION (Complex & Verbose)
```javascript
const prompt = `
<ROLE>...</ROLE>
<TARGET>...</TARGET>
<CRITICAL_SCHOOL_MATCHING>
⚠️ EXTREMELY IMPORTANT: You MUST ONLY return data from "${school}".
- DO NOT return data from any other university...
- Examples of WRONG behavior: ...
</CRITICAL_SCHOOL_MATCHING>
<SEARCH_STRATEGY>...</SEARCH_STRATEGY>
<SOURCE_REQUIREMENTS>...</SOURCE_REQUIREMENTS>
<EXTRACTION_RULES>...</EXTRACTION_RULES>
<OUTPUT_FORMAT>...</OUTPUT_FORMAT>
`;
```

**Characteristics:**
- ❌ XML-like structure (may confuse model)
- ❌ Very verbose (~100+ lines)
- ❌ Excessive warnings and examples
- ❌ May be overwhelming the model

---

### 2. **Source Validation**

#### OLD VERSION
```javascript
// Simple deduplication
const uniqueUrls = new Set();
validatedSources = webChunks.filter((item) => {
    if (uniqueUrls.has(item.url)) return false;
    uniqueUrls.add(item.url);
    return true;
}).slice(0, 3);
```

**Approach:**
- ✅ Trusts Gemini's search results
- ✅ Simple deduplication
- ✅ No aggressive filtering
- ✅ Accepts all grounding chunks

#### CURRENT VERSION
```javascript
// Complex validation chain
1. isOfficialBusinessSchoolUrl() - checks 30+ blocked domains
2. urlMatchesSchool() - validates school name matching
3. extractSchoolIdentifiers() - maps school names to domains
4. Filtering: official > needs verification > unofficial
5. Base URL deduplication
6. Content fetching and sanitization
```

**Approach:**
- ❌ Multiple validation layers
- ❌ May reject valid sources
- ❌ School matching may be too strict
- ❌ Complex filtering logic

---

### 3. **School Matching Logic**

#### OLD VERSION
- **No school matching validation**
- Trusted Gemini to find the right school
- Simple prompt: "Target: ${school} ${program}"

#### CURRENT VERSION
```javascript
function extractSchoolIdentifiers(schoolName) {
    // Maps school names to expected domains
    // Checks if URL matches school
    // May reject valid sources if mapping is incomplete
}
```

**Issues:**
- ❌ Hardcoded school mappings (may miss schools)
- ❌ May reject valid sources if school name doesn't match exactly
- ❌ Over-aggressive filtering

---

### 4. **Content Processing**

#### OLD VERSION
- **No content fetching**
- Relied on Gemini's grounding metadata
- Simple source URLs only

#### CURRENT VERSION
```javascript
// Fetches content from each URL
fetchUrlContent(source.url, 10000)
// Sanitizes for database
sanitizeForDatabase(text)
// Removes null chars, binary content, etc.
```

**Issues:**
- ❌ Additional HTTP requests (slower)
- ❌ May fail on redirect URLs
- ❌ More points of failure

---

### 5. **Confidence Scoring**

#### OLD VERSION
```javascript
// Simple rule-based
if (!data.total_credits) {
    confidence_score = "Low"
} else {
    confidence_score = data.confidence_score || "Medium"
}
```

#### CURRENT VERSION
```javascript
// Multi-factor scoring (0-100 points)
- Source Quality: 0-30 pts
- Data Completeness: 0-40 pts
- Data Freshness: 0-15 pts
- Cross-Validation: 0-15 pts
```

**Issues:**
- ❌ More complex, may not be more accurate
- ❌ Penalizes sources that don't match school (even if correct)

---

## Why Old Version Performed Better

### 1. **Simplicity = Better Results**
- Gemini works better with clear, concise instructions
- Less structure = more flexibility for the model
- Trusts Gemini's built-in search capabilities

### 2. **Less Validation = More Sources**
- Old version accepted all grounding chunks
- Current version filters aggressively, may reject valid sources
- School matching may be too strict

### 3. **Faster Processing**
- No content fetching = faster responses
- Less processing = fewer errors
- Simpler code = easier to debug

### 4. **Better Prompt Design**
- Old prompt was direct and actionable
- Current prompt is verbose with XML structure
- Too many warnings may confuse the model

---

## Recommendations

### Option 1: Revert to Old Version (Simplest)
- Remove XML structure
- Remove school matching validation
- Remove content fetching
- Keep simple deduplication
- Restore original prompt structure

### Option 2: Hybrid Approach (Recommended)
- Keep old prompt structure (concise)
- Add minimal school validation (only block obvious wrong schools)
- Keep simple confidence scoring
- Remove content fetching (use grounding metadata only)
- Keep in-state tuition preference (this is good)

### Option 3: Fix Current Version
- Simplify prompt (remove XML structure)
- Make school matching less strict (whitelist approach instead of blacklist)
- Remove content fetching for redirect URLs
- Simplify confidence scoring

---

## Specific Issues in Current Version

1. **School Matching Too Strict**
   - Hardcoded mappings may miss schools
   - May reject valid sources from correct school
   - Example: "Robert H. Smith" → may not match "smith.umd.edu" if mapping incomplete

2. **Verbose Prompt**
   - XML structure may confuse model
   - Too many warnings/examples
   - May dilute the core instructions

3. **Over-Validation**
   - Multiple validation layers
   - May reject valid sources
   - Complex filtering logic

4. **Content Fetching Issues**
   - Redirect URLs may fail
   - Additional HTTP requests slow down process
   - More points of failure

---

## Action Items

1. **Simplify the prompt** - Remove XML structure, keep it concise
2. **Relax school matching** - Make it less strict, use whitelist approach
3. **Remove content fetching** - Trust Gemini's grounding metadata
4. **Simplify confidence scoring** - Keep it simple like old version
5. **Test with known problematic schools** - Verify improvements


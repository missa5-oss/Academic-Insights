/**
 * Verifier Agent
 *
 * Purpose: Validate extracted tuition data for accuracy and consistency
 *
 * Responsibilities:
 * - Cross-check calculations (stated vs. calculated total)
 * - Verify source reliability (is this the right school?)
 * - Flag inconsistencies for human review
 * - Determine final confidence score with reasoning
 * - Request retry if data quality is poor
 */

import logger from '../utils/logger.js';
import { GEMINI_CONFIG } from '../config.js';

/**
 * Verification result structure
 * @typedef {Object} VerificationResult
 * @property {string} status - 'verified' | 'needs_review' | 'retry_recommended' | 'failed'
 * @property {string} confidence - 'High' | 'Medium' | 'Low'
 * @property {string[]} issues - List of identified issues
 * @property {string[]} validations - List of passed validations
 * @property {string} reasoning - Explanation of confidence score
 * @property {boolean} retryRecommended - Whether extraction should be retried
 * @property {string|null} suggestedSearchQuery - Alternative query if retry recommended
 * @property {Object} corrections - Suggested corrections to extracted data
 */

/**
 * Parse a currency string to a number
 * @param {string|null} value - Currency string like "$50,000" or "50000"
 * @returns {number|null} - Parsed number or null
 */
function parseCurrency(value) {
  if (!value) return null;
  const cleaned = String(value).replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Extract domain from URL
 * @param {string} url - Full URL
 * @returns {string|null} - Domain or null
 */
function extractDomain(url) {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Check if a domain is likely from the target school
 * @param {string} domain - URL domain
 * @param {string} schoolName - School name to match
 * @returns {boolean}
 */
function domainMatchesSchool(domain, schoolName) {
  if (!domain || !schoolName) return false;

  const normalizedSchool = schoolName.toLowerCase()
    .replace(/university|college|school|of|the|business/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();

  const normalizedDomain = domain
    .replace(/\.edu$|\.com$|\.org$/i, '')
    .replace(/www\.|business\.|graduate\.|mba\./gi, '')
    .replace(/[^a-z0-9]/g, '');

  // Check for common patterns
  const schoolWords = schoolName.toLowerCase().split(/\s+/);
  const significantWords = schoolWords.filter(w =>
    w.length > 3 && !['university', 'college', 'school', 'the', 'of', 'and'].includes(w)
  );

  // Check if any significant word appears in domain
  return significantWords.some(word => normalizedDomain.includes(word)) ||
         normalizedDomain.includes(normalizedSchool.substring(0, 5));
}

/**
 * Perform mathematical verification of tuition calculations
 * @param {Object} extractedData - Extracted tuition data
 * @returns {Object} - Math verification result
 */
function verifyMathCalculations(extractedData) {
  const result = {
    passed: true,
    issues: [],
    validations: []
  };

  const tuitionAmount = parseCurrency(extractedData.tuition_amount);
  const costPerCredit = parseCurrency(extractedData.cost_per_credit);
  const totalCredits = parseCurrency(extractedData.total_credits);
  const calculatedTotalCost = parseCurrency(extractedData.calculated_total_cost);

  // Check if we can verify the calculation
  if (costPerCredit && totalCredits) {
    const expectedTotal = costPerCredit * totalCredits;

    if (tuitionAmount) {
      const difference = Math.abs(tuitionAmount - expectedTotal);
      const percentDiff = (difference / expectedTotal) * 100;

      if (percentDiff <= 5) {
        result.validations.push(`Math verified: $${costPerCredit.toLocaleString()} × ${totalCredits} credits = $${expectedTotal.toLocaleString()} (matches stated tuition within 5%)`);
      } else if (percentDiff <= 15) {
        result.issues.push(`Minor discrepancy: calculated $${expectedTotal.toLocaleString()} vs stated $${tuitionAmount.toLocaleString()} (${percentDiff.toFixed(1)}% difference - may include fees)`);
      } else {
        result.passed = false;
        result.issues.push(`Significant discrepancy: calculated $${expectedTotal.toLocaleString()} vs stated $${tuitionAmount.toLocaleString()} (${percentDiff.toFixed(1)}% difference)`);
      }
    }

    if (calculatedTotalCost) {
      const calcDiff = Math.abs(calculatedTotalCost - expectedTotal);
      if (calcDiff > expectedTotal * 0.01) {
        result.issues.push(`calculated_total_cost ($${calculatedTotalCost.toLocaleString()}) doesn't match cost_per_credit × total_credits ($${expectedTotal.toLocaleString()})`);
      }
    }
  } else if (tuitionAmount && !costPerCredit && !totalCredits) {
    result.issues.push('Cannot verify calculation: missing cost_per_credit and total_credits');
  }

  return result;
}

/**
 * Verify source reliability
 * @param {Object} extractedData - Extracted data with sources
 * @param {string} schoolName - Target school name
 * @returns {Object} - Source verification result
 */
function verifySourceReliability(extractedData, schoolName) {
  const result = {
    passed: true,
    issues: [],
    validations: []
  };

  const sourceUrl = extractedData.source_url;
  const validatedSources = extractedData.validated_sources || [];

  // Check primary source
  if (sourceUrl) {
    const domain = extractDomain(sourceUrl);

    if (domain) {
      if (domain.endsWith('.edu')) {
        result.validations.push(`Primary source is .edu domain: ${domain}`);

        if (domainMatchesSchool(domain, schoolName)) {
          result.validations.push(`Domain appears to match school: ${schoolName}`);
        } else {
          result.issues.push(`Domain ${domain} may not match target school "${schoolName}" - verify manually`);
        }
      } else if (domain.includes('vertexaisearch') || domain.includes('google')) {
        // Google grounding redirect - acceptable but note it
        result.validations.push('Source is Google grounding redirect (normal behavior)');
      } else {
        result.issues.push(`Primary source is not .edu: ${domain}`);
        result.passed = false;
      }
    }
  } else {
    result.issues.push('No primary source URL provided');
    result.passed = false;
  }

  // Check validated sources
  if (validatedSources.length === 0) {
    result.issues.push('No validated sources available for verification');
  } else {
    const eduSources = validatedSources.filter(s => {
      const d = extractDomain(s.url);
      return d && (d.endsWith('.edu') || d.includes('vertexaisearch'));
    });

    if (eduSources.length > 0) {
      result.validations.push(`${eduSources.length} of ${validatedSources.length} sources are .edu or grounded`);
    }

    // Check for source content
    const sourcesWithContent = validatedSources.filter(s =>
      s.raw_content && s.raw_content.length > 100 &&
      !s.raw_content.includes('No extractable text')
    );

    if (sourcesWithContent.length > 0) {
      result.validations.push(`${sourcesWithContent.length} sources have extractable content`);
    } else {
      result.issues.push('No sources have substantial extractable content');
    }
  }

  return result;
}

/**
 * Verify data completeness
 * @param {Object} extractedData - Extracted tuition data
 * @returns {Object} - Completeness verification result
 */
function verifyDataCompleteness(extractedData) {
  const result = {
    passed: true,
    issues: [],
    validations: [],
    completenessScore: 0
  };

  const requiredFields = ['tuition_amount', 'tuition_period', 'academic_year'];
  const importantFields = ['cost_per_credit', 'total_credits', 'program_length'];
  const optionalFields = ['actual_program_name', 'is_stem', 'additional_fees', 'remarks'];

  // Check required fields
  let requiredPresent = 0;
  for (const field of requiredFields) {
    if (extractedData[field] && extractedData[field] !== 'N/A') {
      requiredPresent++;
      result.validations.push(`Required field present: ${field}`);
    } else {
      result.issues.push(`Missing required field: ${field}`);
      result.passed = false;
    }
  }

  // Check important fields
  let importantPresent = 0;
  for (const field of importantFields) {
    if (extractedData[field]) {
      importantPresent++;
    }
  }

  if (importantPresent === importantFields.length) {
    result.validations.push('All calculation fields present (cost_per_credit, total_credits, program_length)');
  } else if (importantPresent > 0) {
    const missing = importantFields.filter(f => !extractedData[f]);
    result.issues.push(`Missing calculation fields: ${missing.join(', ')}`);
  } else {
    result.issues.push('No calculation fields present - cannot verify total');
  }

  // Check optional fields
  let optionalPresent = 0;
  for (const field of optionalFields) {
    if (extractedData[field] !== null && extractedData[field] !== undefined) {
      optionalPresent++;
    }
  }

  // Calculate completeness score (0-100)
  result.completenessScore = Math.round(
    (requiredPresent / requiredFields.length * 50) +
    (importantPresent / importantFields.length * 35) +
    (optionalPresent / optionalFields.length * 15)
  );

  result.validations.push(`Data completeness score: ${result.completenessScore}/100`);

  return result;
}

/**
 * Verify data plausibility
 * @param {Object} extractedData - Extracted tuition data
 * @param {string} programName - Program name for context
 * @returns {Object} - Plausibility verification result
 */
function verifyDataPlausibility(extractedData, programName) {
  const result = {
    passed: true,
    issues: [],
    validations: []
  };

  const tuitionAmount = parseCurrency(extractedData.tuition_amount);
  const costPerCredit = parseCurrency(extractedData.cost_per_credit);
  const totalCredits = parseCurrency(extractedData.total_credits);

  // Check tuition is in reasonable range for MBA/graduate programs
  if (tuitionAmount) {
    if (tuitionAmount < 5000) {
      result.issues.push(`Tuition $${tuitionAmount.toLocaleString()} seems too low for a graduate program`);
      result.passed = false;
    } else if (tuitionAmount > 300000) {
      result.issues.push(`Tuition $${tuitionAmount.toLocaleString()} seems unusually high - verify this is total program cost, not annual`);
    } else {
      result.validations.push(`Tuition $${tuitionAmount.toLocaleString()} is within plausible range for graduate programs`);
    }
  }

  // Check cost per credit is reasonable
  if (costPerCredit) {
    if (costPerCredit < 100) {
      result.issues.push(`Cost per credit $${costPerCredit} seems too low`);
    } else if (costPerCredit > 5000) {
      result.issues.push(`Cost per credit $${costPerCredit.toLocaleString()} is very high - verify accuracy`);
    } else {
      result.validations.push(`Cost per credit $${costPerCredit.toLocaleString()} is within typical range`);
    }
  }

  // Check total credits is reasonable
  if (totalCredits) {
    if (totalCredits < 20) {
      result.issues.push(`Total credits ${totalCredits} seems low for MBA program`);
    } else if (totalCredits > 100) {
      result.issues.push(`Total credits ${totalCredits} seems high - verify this is correct`);
    } else {
      result.validations.push(`Total credits ${totalCredits} is within typical range (30-60 for MBA)`);
    }
  }

  // Check academic year is current
  const academicYear = extractedData.academic_year;
  if (academicYear) {
    const currentYear = new Date().getFullYear();
    const yearMatch = academicYear.match(/(\d{4})/);
    if (yearMatch) {
      const year = parseInt(yearMatch[1]);
      if (year < currentYear - 1) {
        result.issues.push(`Academic year ${academicYear} may be outdated`);
      } else {
        result.validations.push(`Academic year ${academicYear} is current`);
      }
    }
  }

  return result;
}

/**
 * Use Gemini to perform intelligent verification
 * @param {Object} ai - Gemini AI client
 * @param {Object} extractedData - Extracted tuition data
 * @param {string} schoolName - Target school name
 * @param {string} programName - Target program name
 * @param {Object} ruleBasedResults - Results from rule-based verification
 * @returns {Promise<Object>} - AI verification result
 */
async function performAIVerification(ai, extractedData, schoolName, programName, ruleBasedResults) {
  const prompt = `
You are a data verification agent. Your job is to verify the accuracy of extracted tuition data.

EXTRACTED DATA:
- School: ${schoolName}
- Program: ${programName}
- Tuition Amount: ${extractedData.tuition_amount || 'Not found'}
- Cost Per Credit: ${extractedData.cost_per_credit || 'Not found'}
- Total Credits: ${extractedData.total_credits || 'Not found'}
- Program Length: ${extractedData.program_length || 'Not found'}
- Academic Year: ${extractedData.academic_year || 'Not found'}
- STEM Status: ${extractedData.is_stem ? 'Yes' : 'No'}
- Status: ${extractedData.status}

RULE-BASED VERIFICATION RESULTS:
Issues Found: ${ruleBasedResults.allIssues.length > 0 ? ruleBasedResults.allIssues.join('; ') : 'None'}
Validations Passed: ${ruleBasedResults.allValidations.length > 0 ? ruleBasedResults.allValidations.join('; ') : 'None'}

SOURCE CONTENT SAMPLE:
${extractedData.raw_content ? extractedData.raw_content.substring(0, 1500) : 'No source content available'}

TASK:
1. Review the extracted data for accuracy
2. Check if the source content supports the extracted values
3. Identify any red flags or inconsistencies
4. Recommend whether to accept, flag for review, or retry extraction

OUTPUT - Return ONLY this JSON:
{
  "verification_status": "verified|needs_review|retry_recommended",
  "confidence_adjustment": "increase|maintain|decrease",
  "key_finding": "One sentence summary of verification result",
  "source_supports_data": true|false,
  "suggested_correction": null or {"field": "value"},
  "alternative_search_query": null or "suggested query if retry needed"
}
`;

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_CONFIG.MODEL,
      contents: prompt
    });

    const text = response.text || '';

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return null;
  } catch (error) {
    logger.warn('AI verification failed, using rule-based results only', { error: error.message });
    return null;
  }
}

/**
 * Main verification function
 * @param {Object} ai - Gemini AI client
 * @param {Object} extractedData - Data from extractor agent
 * @param {string} schoolName - Target school name
 * @param {string} programName - Target program name
 * @param {Object} options - Verification options
 * @returns {Promise<VerificationResult>}
 */
export async function verifyExtraction(ai, extractedData, schoolName, programName, options = {}) {
  const { useAIVerification = true } = options;

  logger.info(`Starting verification for: ${schoolName} - ${programName}`);

  // Handle failed or not found extractions
  if (extractedData.status === 'Failed' || extractedData.status === 'Not Found') {
    return {
      status: extractedData.status === 'Not Found' ? 'verified' : 'failed',
      confidence: 'Low',
      issues: [extractedData.status === 'Not Found' ? 'Program not found at this school' : 'Extraction failed'],
      validations: [],
      reasoning: extractedData.status === 'Not Found'
        ? 'Program confirmed not available at this institution'
        : 'Extraction failed - recommend retry with different search strategy',
      retryRecommended: extractedData.status === 'Failed',
      suggestedSearchQuery: extractedData.status === 'Failed'
        ? `"${schoolName}" "${programName}" graduate tuition fees official`
        : null,
      corrections: {}
    };
  }

  // Perform rule-based verifications
  const mathVerification = verifyMathCalculations(extractedData);
  const sourceVerification = verifySourceReliability(extractedData, schoolName);
  const completenessVerification = verifyDataCompleteness(extractedData);
  const plausibilityVerification = verifyDataPlausibility(extractedData, programName);

  // Aggregate results
  const allIssues = [
    ...mathVerification.issues,
    ...sourceVerification.issues,
    ...completenessVerification.issues,
    ...plausibilityVerification.issues
  ];

  const allValidations = [
    ...mathVerification.validations,
    ...sourceVerification.validations,
    ...completenessVerification.validations,
    ...plausibilityVerification.validations
  ];

  const allPassed = mathVerification.passed &&
                    sourceVerification.passed &&
                    completenessVerification.passed &&
                    plausibilityVerification.passed;

  // Perform AI verification if enabled
  let aiVerification = null;
  if (useAIVerification && ai) {
    aiVerification = await performAIVerification(
      ai,
      extractedData,
      schoolName,
      programName,
      { allIssues, allValidations }
    );
  }

  // Determine final status and confidence
  let status = 'verified';
  let confidence = extractedData.confidence_score || 'Medium';
  let retryRecommended = false;
  let suggestedSearchQuery = null;

  // Adjust based on rule-based verification
  if (!allPassed) {
    if (allIssues.length >= 3 || !completenessVerification.passed) {
      status = 'retry_recommended';
      retryRecommended = true;
      suggestedSearchQuery = `"${schoolName}" "${programName}" MBA tuition 2024 2025 site:.edu`;
    } else {
      status = 'needs_review';
    }
  }

  // Adjust based on AI verification
  if (aiVerification) {
    if (aiVerification.verification_status === 'retry_recommended') {
      status = 'retry_recommended';
      retryRecommended = true;
      suggestedSearchQuery = aiVerification.alternative_search_query || suggestedSearchQuery;
    } else if (aiVerification.verification_status === 'needs_review' && status === 'verified') {
      status = 'needs_review';
    }

    // Adjust confidence
    if (aiVerification.confidence_adjustment === 'increase' && confidence !== 'High') {
      confidence = confidence === 'Low' ? 'Medium' : 'High';
    } else if (aiVerification.confidence_adjustment === 'decrease' && confidence !== 'Low') {
      confidence = confidence === 'High' ? 'Medium' : 'Low';
    }

    // Add AI finding to validations/issues
    if (aiVerification.key_finding) {
      if (aiVerification.source_supports_data) {
        allValidations.push(`AI verification: ${aiVerification.key_finding}`);
      } else {
        allIssues.push(`AI verification: ${aiVerification.key_finding}`);
      }
    }
  }

  // Build reasoning
  const reasoning = buildReasoning(status, confidence, allIssues, allValidations, completenessVerification.completenessScore);

  // Build corrections if AI suggested any
  const corrections = aiVerification?.suggested_correction || {};

  const result = {
    status,
    confidence,
    issues: allIssues,
    validations: allValidations,
    reasoning,
    retryRecommended,
    suggestedSearchQuery,
    corrections,
    completenessScore: completenessVerification.completenessScore,
    aiVerificationUsed: !!aiVerification
  };

  logger.info(`Verification complete for: ${schoolName} - ${programName}`, {
    status: result.status,
    confidence: result.confidence,
    issueCount: result.issues.length,
    validationCount: result.validations.length,
    retryRecommended: result.retryRecommended
  });

  return result;
}

/**
 * Build human-readable reasoning for confidence score
 */
function buildReasoning(status, confidence, issues, validations, completenessScore) {
  const parts = [];

  if (status === 'verified') {
    parts.push('Data verification passed.');
  } else if (status === 'needs_review') {
    parts.push('Data requires manual review due to minor issues.');
  } else if (status === 'retry_recommended') {
    parts.push('Data quality insufficient - retry recommended.');
  }

  parts.push(`Confidence: ${confidence}.`);

  if (completenessScore >= 80) {
    parts.push(`Data completeness: ${completenessScore}% (excellent).`);
  } else if (completenessScore >= 60) {
    parts.push(`Data completeness: ${completenessScore}% (good).`);
  } else {
    parts.push(`Data completeness: ${completenessScore}% (needs improvement).`);
  }

  if (issues.length > 0) {
    parts.push(`Issues: ${issues.length} found.`);
  }

  if (validations.length > 0) {
    parts.push(`Validations: ${validations.length} passed.`);
  }

  return parts.join(' ');
}

export default {
  verifyExtraction
};

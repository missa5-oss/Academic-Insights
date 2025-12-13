/**
 * AI Usage Logger Utility
 *
 * Tracks AI API calls with detailed metrics including token usage, costs, and tool calling.
 * Part of Admin Panel AI Observability Enhancement.
 */

import { sql } from '../db.js';
import logger from './logger.js';

// Gemini 2.5 Flash pricing (as of 2024)
const PRICING = {
  input: 0.075 / 1_000_000,   // $0.075 per 1M input tokens
  output: 0.30 / 1_000_000,    // $0.30 per 1M output tokens
  googleSearch: 0.005,         // Estimated $0.005 per search
  googleMaps: 0.002           // Estimated $0.002 per lookup
};

/**
 * Generate unique ID for AI usage log entries
 */
function generateLogId() {
  return `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Extract token usage from Gemini API response
 * @param {Object} response - Gemini API response object
 * @returns {Object} Token counts {inputTokens, outputTokens, totalTokens}
 */
export function extractTokenUsage(response) {
  const usage = response.usageMetadata || {};
  return {
    inputTokens: usage.promptTokenCount || 0,
    outputTokens: usage.candidatesTokenCount || 0,
    totalTokens: usage.totalTokenCount || 0
  };
}

/**
 * Extract tool usage from Gemini API response
 * @param {Object} response - Gemini API response object
 * @returns {Array} Array of tool usage objects
 */
export function extractToolUsage(response) {
  const tools = [];
  const groundingMetadata = response.candidates?.[0]?.groundingMetadata;

  if (groundingMetadata?.groundingChunks) {
    const chunks = groundingMetadata.groundingChunks;
    const hasSearchResults = chunks.some(c => c.web?.uri && !c.web.uri.includes('maps'));
    const hasMapResults = chunks.some(c => c.web?.uri?.includes('maps'));

    if (hasSearchResults) {
      tools.push({
        type: 'googleSearch',
        success: chunks.filter(c => c.web?.uri && !c.web.uri.includes('maps')).length > 0,
        resultsCount: chunks.filter(c => c.web?.uri && !c.web.uri.includes('maps')).length
      });
    }

    if (hasMapResults) {
      tools.push({
        type: 'googleMaps',
        success: chunks.filter(c => c.web?.uri?.includes('maps')).length > 0,
        resultsCount: chunks.filter(c => c.web?.uri?.includes('maps')).length
      });
    }
  }

  return tools;
}

/**
 * Calculate costs based on token usage and tools
 * @param {Object} params - Cost calculation parameters
 * @returns {Object} Cost breakdown
 */
function calculateCosts({ inputTokens = 0, outputTokens = 0, toolsUsed = [] }) {
  const inputCost = inputTokens * PRICING.input;
  const outputCost = outputTokens * PRICING.output;

  let toolCost = 0;
  toolsUsed.forEach(tool => {
    if (tool.type === 'googleSearch') {
      toolCost += PRICING.googleSearch;
    } else if (tool.type === 'googleMaps') {
      toolCost += PRICING.googleMaps;
    }
  });

  const totalCost = inputCost + outputCost + toolCost;

  return {
    inputCost: parseFloat(inputCost.toFixed(6)),
    outputCost: parseFloat(outputCost.toFixed(6)),
    toolCost: parseFloat(toolCost.toFixed(6)),
    totalCost: parseFloat(totalCost.toFixed(6))
  };
}

/**
 * Categorize error type for analytics
 * @param {Error} error - Error object
 * @returns {string} Error category
 */
export function categorizeError(error) {
  if (!error) return 'unknown';

  const message = error.message || '';
  const code = error.code || '';

  // Rate limiting
  if (message.includes('429') || message.includes('quota') || message.includes('rate limit')) {
    return 'rate_limit';
  }

  // Timeout
  if (message.includes('timeout') || message.includes('DEADLINE_EXCEEDED') || code.includes('DEADLINE_EXCEEDED')) {
    return 'timeout';
  }

  // Parsing errors
  if (message.includes('parse') || message.includes('JSON') || message.includes('Failed to parse')) {
    return 'parsing_error';
  }

  // Tool failures
  if (message.includes('tool') || message.includes('grounding') || message.includes('search')) {
    return 'tool_failure';
  }

  // API errors
  if (code.includes('UNAVAILABLE') || message.includes('503') || message.includes('unavailable')) {
    return 'api_unavailable';
  }

  // Resource exhaustion
  if (code.includes('RESOURCE_EXHAUSTED') || message.includes('RESOURCE_EXHAUSTED')) {
    return 'resource_exhausted';
  }

  // Internal errors
  if (code.includes('INTERNAL') || message.includes('500') || message.includes('internal')) {
    return 'internal_error';
  }

  // Unknown
  return 'unknown';
}

/**
 * Log AI API call with detailed metrics
 * @param {Object} params - AI usage parameters
 * @returns {Promise<string>} Log entry ID
 */
export async function logAiUsage({
  apiLogId = null,
  endpoint,
  model,
  operationType,
  response = null,
  inputTokens = null,
  outputTokens = null,
  toolsUsed = null,
  aiResponseTime = null,
  retryCount = 0,
  success = true,
  error = null,
  requestMetadata = null,
  responseMetadata = null
}) {
  try {
    // Extract token usage from response if not provided
    let tokens = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    if (response) {
      tokens = extractTokenUsage(response);
      if (!toolsUsed) {
        toolsUsed = extractToolUsage(response);
      }
    }

    // Use provided tokens if available
    if (inputTokens !== null) tokens.inputTokens = inputTokens;
    if (outputTokens !== null) tokens.outputTokens = outputTokens;
    if (tokens.totalTokens === 0 && tokens.inputTokens + tokens.outputTokens > 0) {
      tokens.totalTokens = tokens.inputTokens + tokens.outputTokens;
    }

    // Calculate costs
    const costs = calculateCosts({
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
      toolsUsed: toolsUsed || []
    });

    // Determine error type if failed
    let errorType = null;
    let errorMessage = null;
    if (!success && error) {
      errorType = categorizeError(error);
      errorMessage = error.message || String(error);
    }

    const logId = generateLogId();

    // Insert into database
    await sql`
      INSERT INTO ai_usage_logs (
        id, api_log_id, endpoint, model, operation_type,
        input_tokens, output_tokens, total_tokens, tools_used,
        input_cost, output_cost, tool_cost, total_cost,
        ai_response_time_ms, retry_count,
        success, error_type, error_message,
        request_metadata, response_metadata
      )
      VALUES (
        ${logId},
        ${apiLogId},
        ${endpoint},
        ${model},
        ${operationType},
        ${tokens.inputTokens},
        ${tokens.outputTokens},
        ${tokens.totalTokens},
        ${toolsUsed ? JSON.stringify(toolsUsed) : null},
        ${costs.inputCost},
        ${costs.outputCost},
        ${costs.toolCost},
        ${costs.totalCost},
        ${aiResponseTime},
        ${retryCount},
        ${success},
        ${errorType},
        ${errorMessage},
        ${requestMetadata ? JSON.stringify(requestMetadata) : null},
        ${responseMetadata ? JSON.stringify(responseMetadata) : null}
      )
    `;

    logger.debug('AI usage logged', {
      id: logId,
      endpoint,
      operationType,
      tokens: tokens.totalTokens,
      cost: costs.totalCost,
      success
    });

    return logId;
  } catch (error) {
    // Don't throw - logging should never break the API
    logger.warn('Failed to log AI usage', { error: error.message, endpoint, operationType });
    return null;
  }
}

export default {
  logAiUsage,
  extractTokenUsage,
  extractToolUsage,
  categorizeError
};


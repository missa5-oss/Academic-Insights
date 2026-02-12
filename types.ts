
export enum ConfidenceScore {
  HIGH = 'High',
  MEDIUM = 'Medium',
  LOW = 'Low'
}

export enum ExtractionStatus {
  SUCCESS = 'Success',
  NOT_FOUND = 'Not Found',
  PENDING = 'Pending',
  FAILED = 'Failed'
}

export interface ValidatedSource {
  title: string;
  url: string;
  raw_content?: string; // HTML/text snippet from this source
}

export interface LocationData {
  address: string;
  latitude: number | null;
  longitude: number | null;
  map_url: string;
}

export interface User {
  name: string;
  email: string;
  role: 'Admin' | 'Analyst';
  initials: string;
}

export interface ConfidenceDetails {
  score: number;
  max_score: number;
  factors: string[];
}

export interface SourceValidation {
  is_business_school_site: boolean;
  source_domain: string | null;
  primary_source_valid: boolean;
}

// ==========================================
// Agentic Extraction: Verification Types
// ==========================================

/**
 * Verification status from the Verifier Agent
 */
export type VerificationStatus = 'verified' | 'needs_review' | 'retry_recommended' | 'failed' | 'skipped';

/**
 * Verification result from the Verifier Agent
 */
export interface VerificationResult {
  status: VerificationStatus;
  issues: string[];
  validations: string[];
  reasoning: string;
  completenessScore: number;
  retryRecommended: boolean;
}

export interface ExtractionResult {
  id: string;
  project_id: string;
  school_name: string;
  program_name: string;
  
  // Tuition Data
  tuition_amount: string | null; // Calculated total or stated tuition (primary display field)
  stated_tuition?: string | null; // EXACT tuition as stated on website (e.g., "$1,850 per credit")
  tuition_period: string; // e.g. "per year", "per credit", "full program (calculated)"
  academic_year: string;

  // Detailed Metadata
  cost_per_credit?: string | null;
  total_credits?: string | null;
  calculated_total_cost?: string | null; // cost_per_credit × total_credits when both available
  program_length?: string | null;
  additional_fees?: string | null; // Technology fees, student services, etc.
  remarks?: string | null;

  // Geographic Data
  location_data?: LocationData | null;

  // Confidence & Validation
  confidence_score: ConfidenceScore;
  confidence_details?: ConfidenceDetails; // Detailed breakdown of confidence factors
  source_validation?: SourceValidation; // Source quality validation info
  status: ExtractionStatus;

  source_url: string; // Primary source for table view
  validated_sources: ValidatedSource[]; // Top 3 sources for audit

  extraction_date: string;
  raw_content: string; // Summary of content found on official page

  // Manual flagging for errors
  is_flagged?: boolean;

  // Historical tracking
  extraction_version: number; // Version number for tracking price changes over time
  extracted_at: string; // ISO timestamp of when this version was extracted
  updated_at?: string; // ISO timestamp of when this result was last updated (for audit trail)

  // Additional audit fields
  actual_program_name?: string | null; // Official program name as displayed on school website
  user_comments?: string | null; // User-editable comments/notes
  is_stem?: boolean; // Whether the program is STEM designated (false if not explicitly stated)

  // Verification agent results
  verification?: VerificationResult; // Results from the verification agent
  verification_status?: VerificationStatus; // Quick access to verification status
  retry_count?: number; // Number of extraction retry attempts
}

export interface Project {
  id: string;
  name: string;
  description: string;
  created_at: string;
  last_run: string;
  status: 'Active' | 'Completed' | 'Idle';
  results_count: number;
}

export interface ApiUsageMetric {
  date: string;
  tokens_used: number;
  tavily_calls: number;
  cost_estimate: number;
}

// ==========================================
// Sprint 4: Additional Type Definitions
// ==========================================

/**
 * Trend data for charts (US1.2)
 */
export interface TrendData {
  date: string;
  avgTuition: number;
  count: number;
}

/**
 * Chat message in conversation (US2.3)
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  tokensUsed?: number;
}

/**
 * Conversation metadata (US2.3)
 */
export interface Conversation {
  id: string;
  projectId: string;
  title: string;
  messageCount: number;
  lastMessageAt: string;
  createdAt: string;
}

/**
 * Analytics data structure (US1.1)
 */
export interface AnalyticsData {
  avgTuition: number;
  highestTuition: {
    amount: string;
    school: string;
    program: string;
  } | null;
  lowestTuition: {
    amount: string;
    school: string;
    program: string;
  } | null;
  totalPrograms: number;
  successRate: number;
  stemPrograms: number;
  nonStemPrograms: number;
  totalResults: number;
}

/**
 * Health check response (US3.3)
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  components: {
    database: { status: string; latency?: number };
    system: { status: string };
  };
  memory: {
    total: number;
    free: number;
    used: number;
    usedPercentage: number;
  };
  cpu: {
    loadAverage: number[];
    cores: number;
  };
}

/**
 * API log entry (US3.1)
 */
export interface APILogEntry {
  id: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  ipAddress?: string;
  userAgent?: string;
  errorMessage?: string;
  createdAt: string;
}

/**
 * Summary metrics from AI analysis (US2.1)
 */
export interface SummaryMetrics {
  totalPrograms: number;
  successfulExtractions: number;
  avgTuition: number;
  medianTuition: number;
  minTuition: number;
  maxTuition: number;
  stemPrograms: number;
  nonStemPrograms: number;
  dataQuality: {
    high: number;
    medium: number;
    low: number;
  };
}

/**
 * Database statistics (US3.4)
 */
export interface DatabaseStats {
  projects: number;
  extraction_results: number;
  conversations: number;
  conversation_messages: number;
  project_summaries: number;
  api_logs: number;
}

/**
 * Admin metrics response (US3.4)
 */
export interface AdminMetrics {
  summary: {
    totalProjects: number;
    totalResults: number;
    totalConversations: number;
  };
  statusBreakdown: Record<string, number>;
  confidenceBreakdown: Record<string, number>;
  dailyExtractions: Array<{
    date: string;
    count: number;
    successRate: number;
  }>;
  apiAnalytics: {
    totalRequests: number;
    avgResponseTime: number;
    errorRate: number;
    topEndpoints: Array<{
      path: string;
      count: number;
    }>;
  };
}

/**
 * Master data result with project name (Admin Panel)
 * Used for consolidated view of all successful extractions
 */
export interface MasterDataResult extends ExtractionResult {
  project_name: string;
}

// ==========================================
// LLM Observability Types (Admin Dashboard)
// ==========================================

/**
 * Source from grounding search
 */
export interface GroundingSource {
  url: string;
  title: string;
  snippet?: string;
}

/**
 * Tool usage info from AI extraction
 */
export interface ToolUsageInfo {
  type: string;
  success: boolean;
  resultsCount?: number;
  sources?: GroundingSource[];
}

/**
 * Request metadata logged for each extraction
 */
export interface ExtractionRequestMetadata {
  school: string;
  program: string;
}

/**
 * Response metadata logged for each extraction
 */
export interface ExtractionResponseMetadata {
  status: string;
  confidence_score?: string;
  has_tuition?: boolean;
  sources_count?: number;
  verification_status?: string;
  verification_issues?: number;
  program_variation_used?: string;
}

/**
 * Detailed extraction log for LLM observability dashboard
 */
export interface ExtractionLog {
  id: string;
  endpoint: string;
  model: string;
  operation_type: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  tools_used: ToolUsageInfo[] | null;
  input_cost: number;
  output_cost: number;
  tool_cost: number;
  total_cost: number;
  ai_response_time_ms: number;
  retry_count: number;
  success: boolean;
  error_type?: string;
  error_message?: string;
  request_metadata: ExtractionRequestMetadata;
  response_metadata: ExtractionResponseMetadata;
  created_at: string;
}

/**
 * AI Usage metrics summary for dashboard
 */
export interface AiUsageSummary {
  total_calls: number;
  total_tokens: number;
  total_cost: number;
  avg_response_time: number;
  success_count: number;
  failure_count: number;
}

/**
 * AI Usage breakdown by operation type
 */
export interface AiUsageByOperation {
  operation_type: string;
  calls: number;
  tokens: number;
  cost: number;
  avg_response_time: number;
  success_rate: number;
}

/**
 * Complete AI Usage metrics response
 */
export interface AiUsageMetrics {
  summary: AiUsageSummary;
  byOperation: AiUsageByOperation[];
  daily: Array<{
    date: string;
    calls: number;
    tokens: number;
    cost: number;
    failures: number;
  }>;
  toolUsage: Array<{
    tool_type: string;
    usage_count: number;
    success_count: number;
  }>;
  errors: Array<{
    error_type: string;
    count: number;
  }>;
  period: string;
}

/**
 * AI Cost breakdown response
 */
export interface AiCostBreakdown {
  costs: Array<{
    date: string;
    operation_type: string;
    input_cost: number;
    output_cost: number;
    tool_cost: number;
    total_cost: number;
  }>;
  totalsByOperation: Array<{
    operation_type: string;
    input_cost: number;
    output_cost: number;
    tool_cost: number;
    total_cost: number;
  }>;
  period: string;
}

// ==========================================
// Dashboard Enhancement: Cross-Project Analytics Types
// ==========================================

/**
 * Cross-project analytics aggregates (Dashboard hero stats)
 */
export interface CrossProjectAnalytics {
  avgTuition: number;
  tuitionRange: { min: number; max: number };
  totalPrograms: number;
  stemPercentage: number;
  stemCount: number;
  nonStemCount: number;
  recentExtractions: number; // Last 7 days
  projectBreakdown: Array<{
    projectId: string;
    name: string;
    avgTuition: number;
    count: number;
  }>;
}

/**
 * Market positioning data for scatter plot
 */
export interface MarketPositionData {
  tuition: number;
  isStem: boolean;
  school: string;
  program: string;
  projectId: string;
  projectName: string;
}

/**
 * Tuition distribution histogram bin
 */
export interface TuitionDistributionBin {
  range: string; // e.g., "30-50k"
  count: number;
  percentage: number;
}

/**
 * AI-generated market recommendations response
 */
export interface RecommendationsResponse {
  recommendations: string; // Markdown formatted
  metrics: {
    avgTuition: number;
    stemPremium: number;
    medianTuition: number;
  };
  cached: boolean;
  generatedAt: string;
}

/**
 * Data quality metrics for dashboard
 */
export interface DataQualityMetrics {
  successRate: number; // Percentage
  staleDays: number; // Average age of extractions
  flaggedCount: number;
  failedCount: number;
  pendingCount: number;
  statusBreakdown: Record<string, number>; // e.g., { "Success": 112, "Pending": 3 }
}

/**
 * Recent activity trend data (30 days)
 */
export interface ActivityTrendData {
  date: string; // YYYY-MM-DD
  successCount: number;
  failureCount: number;
  totalCount: number;
}

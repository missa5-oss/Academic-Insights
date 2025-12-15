
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

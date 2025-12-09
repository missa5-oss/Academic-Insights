
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

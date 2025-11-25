
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

export interface ExtractionResult {
  id: string;
  project_id: string;
  school_name: string;
  program_name: string;
  tuition_amount: string | null;
  tuition_period: string; // e.g. "per year", "per credit"
  academic_year: string;
  
  // Detailed Metadata
  cost_per_credit?: string | null;
  total_credits?: string | null;
  program_length?: string | null;
  remarks?: string | null;

  // Geographic Data
  location_data?: LocationData | null;

  confidence_score: ConfidenceScore;
  status: ExtractionStatus;
  
  source_url: string; // Primary source for table view
  validated_sources: ValidatedSource[]; // Top 2 sources for audit

  extraction_date: string;
  raw_content: string; // Simulated raw HTML/Text for auditing
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

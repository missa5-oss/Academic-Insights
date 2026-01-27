import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

// Note: Logger imported after dotenv so IS_PRODUCTION is properly set
import logger from './utils/logger.js';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Create Neon SQL client
export const sql = neon(process.env.DATABASE_URL);

// Initialize database schema
export async function initializeDatabase() {
  try {
    // Create projects table
    await sql`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_run TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('Active', 'Completed', 'Idle')),
        results_count INTEGER NOT NULL DEFAULT 0
      )
    `;

    // Create extraction_results table
    await sql`
      CREATE TABLE IF NOT EXISTS extraction_results (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        school_name TEXT NOT NULL,
        program_name TEXT NOT NULL,
        tuition_amount TEXT,
        tuition_period TEXT NOT NULL,
        academic_year TEXT NOT NULL,
        cost_per_credit TEXT,
        total_credits TEXT,
        program_length TEXT,
        remarks TEXT,
        location_data JSONB,
        confidence_score TEXT NOT NULL CHECK (confidence_score IN ('High', 'Medium', 'Low')),
        status TEXT NOT NULL CHECK (status IN ('Success', 'Not Found', 'Pending', 'Failed')),
        source_url TEXT NOT NULL,
        validated_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
        extraction_date TEXT NOT NULL,
        raw_content TEXT NOT NULL,
        is_flagged BOOLEAN DEFAULT FALSE,
        extraction_version INTEGER DEFAULT 1,
        extracted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create index for faster project lookups
    await sql`
      CREATE INDEX IF NOT EXISTS idx_results_project_id
      ON extraction_results(project_id)
    `;

    // Add is_flagged column if it doesn't exist (migration)
    try {
      await sql`
        ALTER TABLE extraction_results
        ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT FALSE
      `;
      logger.info('Migration: is_flagged column added');
    } catch (error) {
      // Column might already exist, ignore error
      logger.debug('Migration: is_flagged column already exists or migration failed');
    }

    // Add historical tracking columns if they don't exist (migration)
    try {
      await sql`
        ALTER TABLE extraction_results
        ADD COLUMN IF NOT EXISTS extraction_version INTEGER DEFAULT 1
      `;
      logger.info('Migration: extraction_version column added');
    } catch (error) {
      logger.debug('Migration: extraction_version column already exists');
    }

    try {
      await sql`
        ALTER TABLE extraction_results
        ADD COLUMN IF NOT EXISTS extracted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      `;
      logger.info('Migration: extracted_at column added');
    } catch (error) {
      logger.debug('Migration: extracted_at column already exists');
    }

    // Backfill extracted_at for existing records (use extraction_date as fallback)
    try {
      await sql`
        UPDATE extraction_results
        SET extracted_at = TO_TIMESTAMP(extraction_date, 'YYYY-MM-DD HH24:MI')
        WHERE extracted_at IS NULL AND extraction_date IS NOT NULL
      `;
      logger.info('Migration: Backfilled extracted_at from extraction_date');
    } catch (error) {
      logger.debug('Migration: extracted_at backfill skipped or failed');
    }

    // Create index for historical queries (version + time-based lookups)
    try {
      await sql`
        CREATE INDEX IF NOT EXISTS idx_results_history
        ON extraction_results(project_id, school_name, program_name, extraction_version)
      `;
      logger.info('Index: idx_results_history created');
    } catch (error) {
      logger.debug('Index: idx_results_history already exists');
    }

    // Add unique constraint for result versioning (prevents duplicate versions)
    try {
      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_results_unique_version
        ON extraction_results(project_id, school_name, program_name, extraction_version)
      `;
      logger.info('Constraint: unique version index created');
    } catch (error) {
      logger.debug('Constraint: unique version index already exists or failed');
    }

    // Create index for status filtering (common query pattern)
    try {
      await sql`
        CREATE INDEX IF NOT EXISTS idx_results_status
        ON extraction_results(project_id, status)
      `;
      logger.info('Index: idx_results_status created');
    } catch (error) {
      logger.debug('Index: idx_results_status already exists');
    }

    // Create index for confidence filtering
    try {
      await sql`
        CREATE INDEX IF NOT EXISTS idx_results_confidence
        ON extraction_results(project_id, confidence_score)
      `;
      logger.info('Index: idx_results_confidence created');
    } catch (error) {
      logger.debug('Index: idx_results_confidence already exists');
    }

    // Create index for extraction_date sorting (frequently used ORDER BY)
    try {
      await sql`
        CREATE INDEX IF NOT EXISTS idx_results_extraction_date
        ON extraction_results(project_id, extraction_date DESC)
      `;
      logger.info('Index: idx_results_extraction_date created');
    } catch (error) {
      logger.debug('Index: idx_results_extraction_date already exists');
    }

    // Sprint 5: Performance Optimization - Add missing composite indexes
    // Composite index for common filter combinations (project_id, status, confidence)
    try {
      await sql`
        CREATE INDEX IF NOT EXISTS idx_results_project_status_confidence
        ON extraction_results(project_id, status, confidence_score)
      `;
      logger.info('Index: idx_results_project_status_confidence created');
    } catch (error) {
      logger.debug('Index: idx_results_project_status_confidence already exists');
    }

    // Index for trends queries (project_id, extracted_at DESC)
    try {
      await sql`
        CREATE INDEX IF NOT EXISTS idx_results_project_extracted_at
        ON extraction_results(project_id, extracted_at DESC)
      `;
      logger.info('Index: idx_results_project_extracted_at created');
    } catch (error) {
      logger.debug('Index: idx_results_project_extracted_at already exists');
    }

    // Index for history lookups (project_id, school_name, program_name)
    try {
      await sql`
        CREATE INDEX IF NOT EXISTS idx_results_school_program
        ON extraction_results(project_id, school_name, program_name)
      `;
      logger.info('Index: idx_results_school_program created');
    } catch (error) {
      logger.debug('Index: idx_results_school_program already exists');
    }

    // Add actual_program_name column if it doesn't exist (migration)
    try {
      await sql`
        ALTER TABLE extraction_results
        ADD COLUMN IF NOT EXISTS actual_program_name TEXT DEFAULT NULL
      `;
      logger.info('Migration: actual_program_name column added');
    } catch (error) {
      logger.debug('Migration: actual_program_name column already exists');
    }

    // Add user_comments column if it doesn't exist (migration)
    try {
      await sql`
        ALTER TABLE extraction_results
        ADD COLUMN IF NOT EXISTS user_comments TEXT DEFAULT NULL
      `;
      logger.info('Migration: user_comments column added');
    } catch (error) {
      logger.debug('Migration: user_comments column already exists');
    }

    // Add is_stem column if it doesn't exist (migration)
    try {
      await sql`
        ALTER TABLE extraction_results
        ADD COLUMN IF NOT EXISTS is_stem BOOLEAN DEFAULT NULL
      `;
      logger.info('Migration: is_stem column added');
    } catch (error) {
      logger.debug('Migration: is_stem column already exists');
    }

    // Add updated_at column for audit trail (migration)
    try {
      await sql`
        ALTER TABLE extraction_results
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NULL
      `;
      logger.info('Migration: updated_at column added');
    } catch (error) {
      logger.debug('Migration: updated_at column already exists');
    }

    // Create index for updated_at sorting (audit trail queries)
    try {
      await sql`
        CREATE INDEX IF NOT EXISTS idx_results_updated_at
        ON extraction_results(project_id, updated_at DESC)
      `;
      logger.info('Index: idx_results_updated_at created');
    } catch (error) {
      logger.debug('Index: idx_results_updated_at already exists');
    }

    // ==========================================
    // Sprint 2: AI Features Enhancement Tables
    // ==========================================

    // Create conversations table (US2.3)
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          title TEXT NOT NULL DEFAULT 'Untitled Conversation',
          message_count INTEGER DEFAULT 0,
          last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      logger.info('Table: conversations created');
    } catch (error) {
      logger.debug('Table: conversations already exists');
    }

    // Create conversation_messages table (US2.3)
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS conversation_messages (
          id TEXT PRIMARY KEY,
          conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
          role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
          content TEXT NOT NULL,
          tokens_used INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      logger.info('Table: conversation_messages created');
    } catch (error) {
      logger.debug('Table: conversation_messages already exists');
    }

    // Create index for conversation lookups by project
    try {
      await sql`
        CREATE INDEX IF NOT EXISTS idx_conversations_project
        ON conversations(project_id, last_message_at DESC)
      `;
      logger.info('Index: idx_conversations_project created');
    } catch (error) {
      logger.debug('Index: idx_conversations_project already exists');
    }

    // Create index for message lookups by conversation
    try {
      await sql`
        CREATE INDEX IF NOT EXISTS idx_messages_conversation
        ON conversation_messages(conversation_id, created_at ASC)
      `;
      logger.info('Index: idx_messages_conversation created');
    } catch (error) {
      logger.debug('Index: idx_messages_conversation already exists');
    }

    // Create project_summaries table for caching (US2.5)
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS project_summaries (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          data_hash TEXT NOT NULL,
          response JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + interval '24 hours')
        )
      `;
      logger.info('Table: project_summaries created');
    } catch (error) {
      logger.debug('Table: project_summaries already exists');
    }

    // Create unique index for summary caching
    try {
      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_summaries_project_hash
        ON project_summaries(project_id, data_hash)
      `;
      logger.info('Index: idx_summaries_project_hash created');
    } catch (error) {
      logger.debug('Index: idx_summaries_project_hash already exists');
    }

    // Create project_analysis_history table for persistent storage (US2.5 enhancement)
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS project_analysis_history (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          analysis_content TEXT NOT NULL,
          metrics JSONB,
          data_hash TEXT NOT NULL,
          cached BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_by TEXT
        )
      `;
      logger.info('Table: project_analysis_history created');
    } catch (error) {
      logger.debug('Table: project_analysis_history already exists');
    }

    // Create index for analysis history lookups by project
    try {
      await sql`
        CREATE INDEX IF NOT EXISTS idx_analysis_history_project
        ON project_analysis_history(project_id, created_at DESC)
      `;
      logger.info('Index: idx_analysis_history_project created');
    } catch (error) {
      logger.debug('Index: idx_analysis_history_project already exists');
    }

    // Create index for analysis history by data_hash (deduplication)
    try {
      await sql`
        CREATE INDEX IF NOT EXISTS idx_analysis_history_hash
        ON project_analysis_history(project_id, data_hash, created_at DESC)
      `;
      logger.info('Index: idx_analysis_history_hash created');
    } catch (error) {
      logger.debug('Index: idx_analysis_history_hash already exists');
    }

    // Add additional_fees column if it doesn't exist (Sprint 2 context enhancement)
    try {
      await sql`
        ALTER TABLE extraction_results
        ADD COLUMN IF NOT EXISTS additional_fees TEXT DEFAULT NULL
      `;
      logger.info('Migration: additional_fees column added');
    } catch (error) {
      logger.debug('Migration: additional_fees column already exists');
    }

    // Add stated_tuition column if it doesn't exist
    try {
      await sql`
        ALTER TABLE extraction_results
        ADD COLUMN IF NOT EXISTS stated_tuition TEXT DEFAULT NULL
      `;
      logger.info('Migration: stated_tuition column added');
    } catch (error) {
      logger.debug('Migration: stated_tuition column already exists');
    }

    // Add calculated_total_cost column if it doesn't exist
    try {
      await sql`
        ALTER TABLE extraction_results
        ADD COLUMN IF NOT EXISTS calculated_total_cost TEXT DEFAULT NULL
      `;
      logger.info('Migration: calculated_total_cost column added');
    } catch (error) {
      logger.debug('Migration: calculated_total_cost column already exists');
    }

    // ==========================================
    // Sprint 3: Admin Observability Tables
    // ==========================================

    // Create api_logs table for request tracking (US3.1)
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS api_logs (
          id TEXT PRIMARY KEY,
          method TEXT NOT NULL,
          path TEXT NOT NULL,
          status_code INTEGER NOT NULL,
          duration_ms INTEGER NOT NULL,
          ip_address TEXT,
          user_agent TEXT,
          request_body JSONB,
          error_message TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      logger.info('Table: api_logs created');
    } catch (error) {
      logger.debug('Table: api_logs already exists');
    }

    // Create index for api_logs queries
    try {
      await sql`
        CREATE INDEX IF NOT EXISTS idx_api_logs_created_at
        ON api_logs(created_at DESC)
      `;
      logger.info('Index: idx_api_logs_created_at created');
    } catch (error) {
      logger.debug('Index: idx_api_logs_created_at already exists');
    }

    // Create index for api_logs path queries
    try {
      await sql`
        CREATE INDEX IF NOT EXISTS idx_api_logs_path
        ON api_logs(path, created_at DESC)
      `;
      logger.info('Index: idx_api_logs_path created');
    } catch (error) {
      logger.debug('Index: idx_api_logs_path already exists');
    }

    // Create system_metrics table for periodic snapshots (US3.3)
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS system_metrics (
          id TEXT PRIMARY KEY,
          metric_type TEXT NOT NULL,
          metric_value JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      logger.info('Table: system_metrics created');
    } catch (error) {
      logger.debug('Table: system_metrics already exists');
    }

    // Create index for system_metrics queries
    try {
      await sql`
        CREATE INDEX IF NOT EXISTS idx_system_metrics_type
        ON system_metrics(metric_type, created_at DESC)
      `;
      logger.info('Index: idx_system_metrics_type created');
    } catch (error) {
      logger.debug('Index: idx_system_metrics_type already exists');
    }

    // ==========================================
    // AI Usage Tracking Tables
    // ==========================================

    // Create ai_usage_logs table for AI observability
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS ai_usage_logs (
          id TEXT PRIMARY KEY,
          api_log_id TEXT REFERENCES api_logs(id) ON DELETE SET NULL,
          endpoint TEXT NOT NULL,
          model TEXT NOT NULL,
          operation_type TEXT NOT NULL,
          input_tokens INTEGER,
          output_tokens INTEGER,
          total_tokens INTEGER,
          tools_used JSONB,
          input_cost DECIMAL(10, 6),
          output_cost DECIMAL(10, 6),
          tool_cost DECIMAL(10, 6),
          total_cost DECIMAL(10, 6),
          ai_response_time_ms INTEGER,
          retry_count INTEGER DEFAULT 0,
          success BOOLEAN NOT NULL,
          error_type TEXT,
          error_message TEXT,
          request_metadata JSONB,
          response_metadata JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      logger.info('Table: ai_usage_logs created');
    } catch (error) {
      logger.debug('Table: ai_usage_logs already exists');
    }

    // Create indexes for ai_usage_logs queries
    try {
      await sql`
        CREATE INDEX IF NOT EXISTS idx_ai_usage_endpoint
        ON ai_usage_logs(endpoint, created_at DESC)
      `;
      logger.info('Index: idx_ai_usage_endpoint created');
    } catch (error) {
      logger.debug('Index: idx_ai_usage_endpoint already exists');
    }

    try {
      await sql`
        CREATE INDEX IF NOT EXISTS idx_ai_usage_operation
        ON ai_usage_logs(operation_type, created_at DESC)
      `;
      logger.info('Index: idx_ai_usage_operation created');
    } catch (error) {
      logger.debug('Index: idx_ai_usage_operation already exists');
    }

    try {
      await sql`
        CREATE INDEX IF NOT EXISTS idx_ai_usage_success
        ON ai_usage_logs(success, created_at DESC)
      `;
      logger.info('Index: idx_ai_usage_success created');
    } catch (error) {
      logger.debug('Index: idx_ai_usage_success already exists');
    }

    try {
      await sql`
        CREATE INDEX IF NOT EXISTS idx_ai_usage_cost
        ON ai_usage_logs(created_at DESC, total_cost)
      `;
      logger.info('Index: idx_ai_usage_cost created');
    } catch (error) {
      logger.debug('Index: idx_ai_usage_cost already exists');
    }

    // ==========================================
    // Agentic Extraction: Verification Tracking
    // ==========================================

    // Add verification_data column for storing verification agent results
    try {
      await sql`
        ALTER TABLE extraction_results
        ADD COLUMN IF NOT EXISTS verification_data JSONB DEFAULT NULL
      `;
      logger.info('Migration: verification_data column added');
    } catch (error) {
      logger.debug('Migration: verification_data column already exists');
    }

    // Add verification_status column for quick filtering
    try {
      await sql`
        ALTER TABLE extraction_results
        ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT NULL
      `;
      logger.info('Migration: verification_status column added');
    } catch (error) {
      logger.debug('Migration: verification_status column already exists');
    }

    // Add retry_count column for tracking extraction attempts
    try {
      await sql`
        ALTER TABLE extraction_results
        ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0
      `;
      logger.info('Migration: retry_count column added');
    } catch (error) {
      logger.debug('Migration: retry_count column already exists');
    }

    // Create index for verification status filtering
    try {
      await sql`
        CREATE INDEX IF NOT EXISTS idx_results_verification_status
        ON extraction_results(project_id, verification_status)
      `;
      logger.info('Index: idx_results_verification_status created');
    } catch (error) {
      logger.debug('Index: idx_results_verification_status already exists');
    }

    // ==========================================
    // Phase 2: Enhanced Attribution (Google Search Grounding)
    // ==========================================

    // Add search_query column for search transparency
    try {
      await sql`
        ALTER TABLE extraction_results
        ADD COLUMN IF NOT EXISTS search_query TEXT DEFAULT NULL
      `;
      logger.info('Migration: search_query column added');
    } catch (error) {
      logger.debug('Migration: search_query column already exists');
    }

    // Add inline_citations column for grounding attribution
    try {
      await sql`
        ALTER TABLE extraction_results
        ADD COLUMN IF NOT EXISTS inline_citations JSONB DEFAULT NULL
      `;
      logger.info('Migration: inline_citations column added');
    } catch (error) {
      logger.debug('Migration: inline_citations column already exists');
    }

    // ==========================================
    // Phase 3: Quota Management (Google Search Grounding)
    // ==========================================

    // Create google_search_quota_tracking table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS google_search_quota_tracking (
          id TEXT PRIMARY KEY,
          date DATE NOT NULL DEFAULT CURRENT_DATE,
          queries_used INTEGER NOT NULL DEFAULT 0,
          quota_limit INTEGER NOT NULL DEFAULT 1000000,
          last_query_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(date)
        )
      `;
      logger.info('Table: google_search_quota_tracking created');
    } catch (error) {
      logger.debug('Table: google_search_quota_tracking already exists');
    }

    // Create index for date-based quota queries
    try {
      await sql`
        CREATE INDEX IF NOT EXISTS idx_quota_date
        ON google_search_quota_tracking(date DESC)
      `;
      logger.info('Index: idx_quota_date created');
    } catch (error) {
      logger.debug('Index: idx_quota_date already exists');
    }

    // Sprint 5: Performance Optimization - Create materialized view for analytics
    try {
      await sql`
        CREATE MATERIALIZED VIEW IF NOT EXISTS project_analytics AS
        SELECT
          project_id,
          COUNT(*) as total_results,
          COUNT(*) FILTER (WHERE status = 'Success') as success_count,
          COUNT(*) FILTER (WHERE status = 'Success' AND tuition_amount IS NOT NULL) as success_with_tuition_count,
          COUNT(*) FILTER (WHERE is_stem = true) as stem_count,
          COUNT(*) FILTER (WHERE is_stem = false) as non_stem_count,
          MAX(extracted_at) as last_update
        FROM extraction_results
        GROUP BY project_id
      `;
      logger.info('Materialized view: project_analytics created');
    } catch (error) {
      logger.debug('Materialized view: project_analytics already exists or creation failed');
    }

    // Create index on materialized view for faster lookups
    try {
      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_project_analytics_project_id
        ON project_analytics(project_id)
      `;
      logger.info('Index: idx_project_analytics_project_id created');
    } catch (error) {
      logger.debug('Index: idx_project_analytics_project_id already exists');
    }

    logger.info('Database schema initialized successfully');
  } catch (error) {
    logger.error('Database initialization error', error);
    throw error;
  }
}

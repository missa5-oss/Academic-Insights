import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

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
      console.log('✅ Migration: is_flagged column added');
    } catch (error) {
      // Column might already exist, ignore error
      console.log('ℹ️  Migration: is_flagged column already exists or migration failed');
    }

    // Add historical tracking columns if they don't exist (migration)
    try {
      await sql`
        ALTER TABLE extraction_results
        ADD COLUMN IF NOT EXISTS extraction_version INTEGER DEFAULT 1
      `;
      console.log('✅ Migration: extraction_version column added');
    } catch (error) {
      console.log('ℹ️  Migration: extraction_version column already exists');
    }

    try {
      await sql`
        ALTER TABLE extraction_results
        ADD COLUMN IF NOT EXISTS extracted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      `;
      console.log('✅ Migration: extracted_at column added');
    } catch (error) {
      console.log('ℹ️  Migration: extracted_at column already exists');
    }

    // Backfill extracted_at for existing records (use extraction_date as fallback)
    try {
      await sql`
        UPDATE extraction_results
        SET extracted_at = TO_TIMESTAMP(extraction_date, 'YYYY-MM-DD HH24:MI')
        WHERE extracted_at IS NULL AND extraction_date IS NOT NULL
      `;
      console.log('✅ Migration: Backfilled extracted_at from extraction_date');
    } catch (error) {
      console.log('ℹ️  Migration: extracted_at backfill skipped or failed');
    }

    // Create index for historical queries (version + time-based lookups)
    try {
      await sql`
        CREATE INDEX IF NOT EXISTS idx_results_history
        ON extraction_results(project_id, school_name, program_name, extraction_version)
      `;
      console.log('✅ Index: idx_results_history created');
    } catch (error) {
      console.log('ℹ️  Index: idx_results_history already exists');
    }

    // Add actual_program_name column if it doesn't exist (migration)
    try {
      await sql`
        ALTER TABLE extraction_results
        ADD COLUMN IF NOT EXISTS actual_program_name TEXT DEFAULT NULL
      `;
      console.log('✅ Migration: actual_program_name column added');
    } catch (error) {
      console.log('ℹ️  Migration: actual_program_name column already exists');
    }

    // Add user_comments column if it doesn't exist (migration)
    try {
      await sql`
        ALTER TABLE extraction_results
        ADD COLUMN IF NOT EXISTS user_comments TEXT DEFAULT NULL
      `;
      console.log('✅ Migration: user_comments column added');
    } catch (error) {
      console.log('ℹ️  Migration: user_comments column already exists');
    }

    // Add is_stem column if it doesn't exist (migration)
    try {
      await sql`
        ALTER TABLE extraction_results
        ADD COLUMN IF NOT EXISTS is_stem BOOLEAN DEFAULT NULL
      `;
      console.log('✅ Migration: is_stem column added');
    } catch (error) {
      console.log('ℹ️  Migration: is_stem column already exists');
    }

    console.log('✅ Database schema initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    throw error;
  }
}

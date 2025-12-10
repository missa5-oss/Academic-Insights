/**
 * Diagnostic script to check validated_sources in database
 * Run with: node server/check-sources.js
 */

import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const sql = neon(process.env.DATABASE_URL);

async function checkSources() {
  console.log('🔍 Checking validated_sources in database...\n');

  try {
    // Get recent results
    const results = await sql`
      SELECT
        school_name,
        program_name,
        status,
        confidence_score,
        source_url,
        validated_sources,
        extraction_date
      FROM extraction_results
      WHERE status = 'Success'
      ORDER BY extraction_date DESC
      LIMIT 5
    `;

    console.log(`Found ${results.length} recent successful extractions\n`);

    for (const result of results) {
      console.log('='.repeat(80));
      console.log(`${result.school_name} - ${result.program_name}`);
      console.log(`Status: ${result.status} | Confidence: ${result.confidence_score}`);
      console.log(`Extracted: ${result.extraction_date}`);
      console.log(`Source URL: ${result.source_url}`);

      console.log('\n📦 validated_sources field:');
      if (result.validated_sources) {
        if (Array.isArray(result.validated_sources)) {
          console.log(`  ✅ Is Array: ${result.validated_sources.length} source(s)`);

          result.validated_sources.forEach((source, idx) => {
            console.log(`\n  Source #${idx + 1}:`);
            console.log(`    Title: ${source.title || 'N/A'}`);
            console.log(`    URL: ${source.url || 'N/A'}`);
            console.log(`    Has raw_content: ${!!source.raw_content}`);
            if (source.raw_content) {
              console.log(`    Content length: ${source.raw_content.length} chars`);
              const preview = source.raw_content.substring(0, 100).replace(/\n/g, ' ');
              console.log(`    Preview: ${preview}...`);
            }
          });
        } else {
          console.log(`  ⚠️  Not an array:`, typeof result.validated_sources);
          console.log(`  Value:`, JSON.stringify(result.validated_sources).substring(0, 200));
        }
      } else {
        console.log(`  ❌ Field is null/undefined`);
        console.log(`  THIS IS WHY UI SHOWS "Sources Not Found"`);
      }
      console.log('');
    }

    // Check for patterns
    console.log('\n' + '='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));

    const withSources = results.filter(r => r.validated_sources && Array.isArray(r.validated_sources) && r.validated_sources.length > 0);
    const withoutSources = results.filter(r => !r.validated_sources || !Array.isArray(r.validated_sources) || r.validated_sources.length === 0);

    console.log(`Results WITH validated_sources: ${withSources.length}`);
    console.log(`Results WITHOUT validated_sources: ${withoutSources.length}`);

    if (withoutSources.length > 0) {
      console.log('\n⚠️  ISSUE FOUND:');
      console.log(`${withoutSources.length} successful extraction(s) have no validated_sources`);
      console.log('This explains why the UI shows "Sources Not Found"');
      console.log('\nPossible causes:');
      console.log('1. Google Search grounding is not returning groundingChunks');
      console.log('2. Backend is not properly extracting/storing them');
      console.log('3. Database migration issue (old extractions before this feature)');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

checkSources().catch(console.error);

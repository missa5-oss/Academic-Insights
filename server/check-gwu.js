import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

const sql = neon(process.env.DATABASE_URL);

const results = await sql`
  SELECT
    school_name,
    program_name,
    status,
    confidence_score,
    tuition_amount,
    validated_sources,
    raw_content,
    extraction_date
  FROM extraction_results
  WHERE school_name LIKE '%George Washington%'
  ORDER BY extraction_date DESC
  LIMIT 1
`;

if (results.length > 0) {
  const result = results[0];
  console.log('\n=== George Washington University - Part-Time MBA ===\n');
  console.log('School:', result.school_name);
  console.log('Program:', result.program_name);
  console.log('Status:', result.status);
  console.log('Confidence:', result.confidence_score);
  console.log('Tuition:', result.tuition_amount);
  console.log('Extracted:', result.extraction_date);
  console.log('\nValidated Sources:');
  if (result.validated_sources && Array.isArray(result.validated_sources)) {
    console.log(`  Count: ${result.validated_sources.length}`);
    result.validated_sources.forEach((source, idx) => {
      console.log(`\n  Source ${idx + 1}:`);
      console.log(`    Title: ${source.title}`);
      console.log(`    URL: ${source.url?.substring(0, 80)}...`);
      console.log(`    Has content: ${!!source.raw_content}`);
      if (source.raw_content) {
        console.log(`    Content length: ${source.raw_content.length} chars`);
        console.log(`    Preview: ${source.raw_content.substring(0, 150)}...`);
      }
    });
  } else {
    console.log('  ❌ None (validated_sources is empty or null)');
  }

  console.log('\nMain raw_content field:');
  if (result.raw_content) {
    console.log(`  Length: ${result.raw_content.length} chars`);
    console.log(`  Preview: ${result.raw_content.substring(0, 300)}...`);
  } else {
    console.log('  ❌ Empty');
  }
} else {
  console.log('No George Washington results found');
}

/**
 * Diagnostic script to test Gemini extraction and inspect grounding chunks
 * Run with: node test-extraction-debug.js
 */

import fetch from 'node-fetch';

async function testExtraction() {
  console.log('🔍 Testing Gemini extraction with grounding chunks inspection...\n');

  const testCases = [
    { school: 'Johns Hopkins University', program: 'MBA' },
    { school: 'Harvard Business School', program: 'MBA' },
    { school: 'Stanford University', program: 'MBA' }
  ];

  for (const testCase of testCases) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Testing: ${testCase.school} - ${testCase.program}`);
    console.log('='.repeat(80));

    try {
      const response = await fetch('http://localhost:3001/api/gemini/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testCase)
      });

      if (!response.ok) {
        console.error(`❌ HTTP Error: ${response.status} ${response.statusText}`);
        const errorText = await response.text();
        console.error('Error response:', errorText);
        continue;
      }

      const result = await response.json();

      console.log('\n📊 Extraction Result:');
      console.log('  Status:', result.status);
      console.log('  Confidence:', result.confidence_score);
      console.log('  Tuition:', result.tuition_amount);
      console.log('  Program:', result.actual_program_name);
      console.log('  Source URL:', result.source_url);

      console.log('\n🔗 Validated Sources:');
      if (result.validated_sources && result.validated_sources.length > 0) {
        console.log(`  ✅ Found ${result.validated_sources.length} validated source(s)`);
        result.validated_sources.forEach((source, idx) => {
          console.log(`\n  Source #${idx + 1}:`);
          console.log(`    Title: ${source.title}`);
          console.log(`    URL: ${source.url}`);
          console.log(`    Content Length: ${source.raw_content?.length || 0} chars`);

          if (source.raw_content) {
            const preview = source.raw_content.substring(0, 200).replace(/\n/g, ' ');
            console.log(`    Content Preview: ${preview}...`);

            // Check for error messages
            if (source.raw_content.includes('Could not fetch content')) {
              console.log(`    ⚠️  WARNING: Could not fetch content from URL`);
            }
            if (source.raw_content.includes('No extractable text content found')) {
              console.log(`    ⚠️  WARNING: No extractable text content found`);
            }
          } else {
            console.log(`    ⚠️  WARNING: No raw_content field`);
          }
        });
      } else {
        console.log('  ❌ No validated sources found!');
        console.log('  This is the ROOT CAUSE of "Sources Not Found" in UI');
      }

      console.log('\n📝 Raw Content Summary:');
      if (result.raw_content) {
        const preview = result.raw_content.substring(0, 300).replace(/\n/g, ' ');
        console.log(`  Length: ${result.raw_content.length} chars`);
        console.log(`  Preview: ${preview}...`);
      } else {
        console.log('  ⚠️  No raw_content in main result');
      }

    } catch (error) {
      console.error(`❌ Error:`, error.message);
      console.error('Stack:', error.stack);
    }

    // Wait between requests to avoid rate limiting
    console.log('\n⏳ Waiting 5 seconds before next test...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  console.log('\n\n' + '='.repeat(80));
  console.log('🎯 DIAGNOSIS COMPLETE');
  console.log('='.repeat(80));
  console.log('\nIf validated_sources is empty, the issue is:');
  console.log('  1. Google Search grounding is not returning groundingChunks');
  console.log('  2. OR groundingChunks.web.uri is missing');
  console.log('  3. OR the backend is not properly extracting them');
  console.log('\nCheck server logs for:');
  console.log('  - "Grounding sources for..." (should show URLs)');
  console.log('  - "No grounding chunks returned..." (indicates Google issue)');
  console.log('  - "Extraction response structure..." (shows metadata)');
}

testExtraction().catch(console.error);

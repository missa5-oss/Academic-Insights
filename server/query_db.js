import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const sql = postgres(DATABASE_URL);

(async () => {
  try {
    const result = await sql`SELECT validated_sources FROM extraction_results WHERE school_name LIKE '%Georgetown%' LIMIT 1`;
    if (result.length > 0) {
      console.log('Raw validated_sources from DB:');
      console.log(JSON.stringify(result[0].validated_sources, null, 2));
    } else {
      console.log('No Georgetown record found');
    }
    await sql.end();
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    await sql.end();
    process.exit(1);
  }
})();

// Script to run migration via Supabase Management API
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://lbvuymzkbdymawnfoucp.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxidnV5bXprYmR5bWF3bmZvdWNwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTcyNDQ1MCwiZXhwIjoyMDk3MzAwNDUwfQ.tZQQVjwr2BumaWnJQND25ZMIXeLX0HB2xP52pWtMP7A';

async function runMigration() {
  const sqlFile = fs.readFileSync(path.join(__dirname, '../supabase/migration.sql'), 'utf-8');
  
  // Split SQL into individual statements
  const statements = sqlFile
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`Found ${statements.length} SQL statements`);
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i] + ';';
    // Skip comments-only blocks
    const cleanStmt = stmt.replace(/--[^\n]*/g, '').trim();
    if (cleanStmt === ';' || cleanStmt.length < 5) continue;
    
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({}),
      });
      // rpc won't work for DDL, we need the SQL endpoint
    } catch (e) {
      // expected
    }
  }
  
  // Use the Supabase SQL API (pg-meta)
  console.log('Running full migration via SQL API...');
  const res = await fetch(`${SUPABASE_URL}/pg/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ query: sqlFile }),
  });
  
  if (res.ok) {
    console.log('✅ Migration completed successfully!');
  } else {
    const text = await res.text();
    console.log(`Status: ${res.status}`);
    console.log(`Response: ${text}`);
    console.log('\n⚠️ If this failed, please run the SQL manually in Supabase SQL Editor');
    console.log('   Go to: https://supabase.com/dashboard/project/lbvuymzkbdymawnfoucp/sql');
    console.log('   Paste the contents of supabase/migration.sql and click RUN');
  }
}

runMigration().catch(console.error);

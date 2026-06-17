// Simplified seed script using Supabase REST API directly
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://lbvuymzkbdymawnfoucp.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxidnV5bXprYmR5bWF3bmZvdWNwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTcyNDQ1MCwiZXhwIjoyMDk3MzAwNDUwfQ.tZQQVjwr2BumaWnJQND25ZMIXeLX0HB2xP52pWtMP7A';

function parseApostila(markdown) {
  const chunks = [];
  const lines = markdown.split('\n');
  let currentSection = '';
  let currentTitle = '';
  let currentContent = [];
  let inCodeBlock = false;

  const flushChunk = () => {
    if (currentTitle && currentContent.length > 0) {
      const content = currentContent.join('\n').trim();
      if (content.length > 50) {
        chunks.push({
          title: currentTitle.replace(/^#+\s*/, '').trim().slice(0, 255),
          content: content.slice(0, 2000),
          section: currentSection || 'Geral',
          source: 'apostila',
        });
      }
    }
    currentContent = [];
  };

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      currentContent.push(line);
      continue;
    }
    if (inCodeBlock) { currentContent.push(line); continue; }
    if (line.startsWith('## ')) {
      flushChunk();
      currentSection = line.replace(/^##\s*/, '').trim();
      currentTitle = line;
      continue;
    }
    if (line.startsWith('### ') || line.startsWith('#### ')) {
      flushChunk();
      currentTitle = line;
      continue;
    }
    if (line.startsWith('# ') && !line.startsWith('## ')) {
      flushChunk();
      currentSection = line.replace(/^#\s*/, '').trim();
      currentTitle = line;
      continue;
    }
    if (currentTitle) currentContent.push(line);
  }
  flushChunk();
  return chunks;
}

async function testConnection() {
  console.log('Testing Supabase connection...');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/knowledge_chunks?select=count`, {
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Prefer': 'count=exact',
    },
  });
  console.log(`Status: ${res.status}`);
  if (res.status === 404 || res.status === 400) {
    console.log('❌ Table knowledge_chunks does not exist yet.');
    console.log('   Please run the migration SQL first!');
    console.log('   Go to: https://supabase.com/dashboard/project/lbvuymzkbdymawnfoucp/sql/new');
    console.log('   Paste the contents of supabase/migration.sql and click RUN');
    return false;
  }
  if (res.ok) {
    console.log('✅ Connection OK, table exists!');
    return true;
  }
  console.log(`Response: ${await res.text()}`);
  return false;
}

async function seed() {
  const ok = await testConnection();
  if (!ok) return;

  // Read apostila
  const apostilaPath = path.resolve(__dirname, '../../apostila_upsay.md');
  let content;
  try {
    content = fs.readFileSync(apostilaPath, 'utf-8');
    console.log(`📄 Apostila: ${(content.length / 1024).toFixed(0)}KB`);
  } catch (e) {
    console.error('❌ apostila_upsay.md not found at:', apostilaPath);
    return;
  }

  const chunks = parseApostila(content);
  console.log(`📦 ${chunks.length} chunks parsed`);

  // Delete old apostila chunks
  console.log('🗑️ Cleaning old chunks...');
  await fetch(`${SUPABASE_URL}/rest/v1/knowledge_chunks?source=eq.apostila`, {
    method: 'DELETE',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
  });

  // Insert in batches
  const BATCH = 50;
  let inserted = 0;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/knowledge_chunks`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(batch),
    });
    if (res.ok) {
      inserted += batch.length;
      console.log(`  ✅ ${inserted}/${chunks.length}`);
    } else {
      const err = await res.text();
      console.error(`  ❌ Batch error: ${err}`);
    }
  }
  console.log(`\n🎉 Done! ${inserted} chunks inserted.`);
}

seed().catch(console.error);

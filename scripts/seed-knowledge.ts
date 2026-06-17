/**
 * Script para popular o banco de dados com os chunks da apostila UpSay
 * 
 * Uso: 
 *   1. Configure as variáveis de ambiente NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
 *   2. Execute: npx tsx scripts/seed-knowledge.ts
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface Chunk {
  title: string;
  content: string;
  section: string;
  source: string;
}

/**
 * Parse a apostila markdown em chunks por seção
 */
function parseApostila(markdown: string): Chunk[] {
  const chunks: Chunk[] = [];
  const lines = markdown.split('\n');
  
  let currentSection = '';
  let currentTitle = '';
  let currentContent: string[] = [];
  let inCodeBlock = false;

  const flushChunk = () => {
    if (currentTitle && currentContent.length > 0) {
      const content = currentContent.join('\n').trim();
      // Only add chunks with meaningful content (more than 50 chars)
      if (content.length > 50) {
        chunks.push({
          title: currentTitle.replace(/^#+\s*/, '').trim(),
          content: content.slice(0, 2000), // Max 2000 chars per chunk
          section: currentSection || 'Geral',
          source: 'apostila',
        });
      }
    }
    currentContent = [];
  };

  for (const line of lines) {
    // Track code blocks to avoid splitting inside them
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      currentContent.push(line);
      continue;
    }

    if (inCodeBlock) {
      currentContent.push(line);
      continue;
    }

    // H2 = Section
    if (line.startsWith('## ')) {
      flushChunk();
      currentSection = line.replace(/^##\s*/, '').trim();
      currentTitle = line;
      continue;
    }

    // H3 or H4 = New chunk
    if (line.startsWith('### ') || line.startsWith('#### ')) {
      flushChunk();
      currentTitle = line;
      continue;
    }

    // H1 = Top-level section
    if (line.startsWith('# ') && !line.startsWith('# ')) {
      flushChunk();
      currentSection = line.replace(/^#\s*/, '').trim();
      currentTitle = line;
      continue;
    }

    // Regular content
    if (currentTitle) {
      currentContent.push(line);
    }
  }

  // Don't forget the last chunk
  flushChunk();

  return chunks;
}

async function seed() {
  console.log('🌱 Iniciando seed da base de conhecimento...');
  
  // Read apostila
  const apostilaPath = resolve(__dirname, '../../apostila_upsay.md');
  let apostilaContent: string;
  
  try {
    apostilaContent = readFileSync(apostilaPath, 'utf-8');
    console.log(`📄 Apostila carregada: ${(apostilaContent.length / 1024).toFixed(0)}KB`);
  } catch {
    console.error(`❌ Arquivo não encontrado: ${apostilaPath}`);
    console.log('   Certifique-se de que apostila_upsay.md está na pasta pai do projeto');
    process.exit(1);
  }

  // Parse chunks
  const chunks = parseApostila(apostilaContent);
  console.log(`📦 ${chunks.length} chunks extraídos da apostila`);

  // Also add the system guide
  try {
    const guidePath = resolve(__dirname, '../../.gemini/antigravity-ide/knowledge/upsay-whaticket-system-guide/artifacts/upsay-complete-guide.md');
    const guideContent = readFileSync(guidePath, 'utf-8');
    const guideChunks = parseApostila(guideContent);
    chunks.push(...guideChunks);
    console.log(`📦 +${guideChunks.length} chunks do guia de operações`);
  } catch {
    console.log('⚠️ Guia de operações não encontrado, pulando...');
  }

  // Clear existing apostila chunks
  console.log('🗑️ Limpando chunks antigos da apostila...');
  await supabase.from('knowledge_chunks').delete().eq('source', 'apostila');

  // Insert in batches of 50
  const BATCH_SIZE = 50;
  let inserted = 0;

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('knowledge_chunks').insert(batch);
    
    if (error) {
      console.error(`❌ Erro no batch ${i}: ${error.message}`);
    } else {
      inserted += batch.length;
      console.log(`  ✅ Inseridos: ${inserted}/${chunks.length}`);
    }
  }

  console.log(`\n🎉 Seed completo! ${inserted} chunks inseridos na base de conhecimento.`);
}

seed().catch(console.error);

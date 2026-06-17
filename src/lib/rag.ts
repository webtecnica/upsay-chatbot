import { getSupabaseAdmin } from './supabase';

export interface KnowledgeChunk {
  id: string;
  title: string;
  content: string;
  section: string;
  source: string;
}

/**
 * Search knowledge base using PostgreSQL full-text search
 * Falls back to ILIKE pattern matching if FTS returns no results
 */
export async function searchKnowledge(query: string, limit = 3): Promise<KnowledgeChunk[]> {
  const supabase = getSupabaseAdmin();

  // Normalize query for FTS
  const ftsQuery = query
    .toLowerCase()
    .replace(/[^\w\sáàâãéèêíïóôõúüç]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .join(' & ');

  if (!ftsQuery) return [];

  // Try full-text search first
  const { data: ftsResults } = await supabase
    .from('knowledge_chunks')
    .select('id, title, content, section, source')
    .textSearch('search_vector', ftsQuery, { config: 'portuguese' })
    .limit(limit);

  if (ftsResults && ftsResults.length > 0) {
    return ftsResults;
  }

  // Fallback: ILIKE search on individual words
  const words = query.split(/\s+/).filter(w => w.length > 3).slice(0, 3);
  if (words.length === 0) return [];

  let queryBuilder = supabase
    .from('knowledge_chunks')
    .select('id, title, content, section, source');

  for (const word of words) {
    queryBuilder = queryBuilder.or(`title.ilike.%${word}%,content.ilike.%${word}%`);
  }

  const { data: likeResults } = await queryBuilder.limit(limit);
  return likeResults || [];
}

/**
 * Search frequent questions for similar queries
 */
export async function searchFrequentQuestions(query: string, limit = 2): Promise<{ question: string; answer: string }[]> {
  const supabase = getSupabaseAdmin();
  const normalized = normalizeQuestion(query);
  const words = normalized.split(/\s+/).filter(w => w.length > 3).slice(0, 3);
  
  if (words.length === 0) return [];

  let queryBuilder = supabase
    .from('frequent_questions')
    .select('question, answer')
    .not('answer', 'is', null);

  for (const word of words) {
    queryBuilder = queryBuilder.ilike('normalized_question', `%${word}%`);
  }

  const { data } = await queryBuilder.order('count', { ascending: false }).limit(limit);
  return data || [];
}

/**
 * Track a question for frequency analysis
 */
export async function trackQuestion(question: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const normalized = normalizeQuestion(question);

  // Try to find existing
  const { data: existing } = await supabase
    .from('frequent_questions')
    .select('id, count')
    .eq('normalized_question', normalized)
    .single();

  if (existing) {
    await supabase
      .from('frequent_questions')
      .update({ count: existing.count + 1, last_asked_at: new Date().toISOString() })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('frequent_questions')
      .insert({ question, normalized_question: normalized });
  }
}

/**
 * Build RAG context from search results
 */
export function buildRagContext(chunks: KnowledgeChunk[]): string {
  if (chunks.length === 0) return '';
  return chunks
    .map((c, i) => `[${i + 1}] ${c.title}\n${c.content.slice(0, 800)}`)
    .join('\n\n');
}

/**
 * Build FAQ context from frequent questions
 */
export function buildFaqContext(faqs: { question: string; answer: string }[]): string {
  if (faqs.length === 0) return '';
  return faqs
    .map(f => `P: ${f.question}\nR: ${f.answer}`)
    .join('\n\n');
}

/**
 * Normalize a question for grouping
 */
function normalizeQuestion(q: string): string {
  return q
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

import { NextRequest, NextResponse } from 'next/server';
import { callDeepSeek } from '@/lib/deepseek';
import { searchKnowledge, searchFrequentQuestions, trackQuestion, buildRagContext, buildFaqContext } from '@/lib/rag';
import { buildPrompt } from '@/lib/prompts';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { message, sessionId } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Mensagem é obrigatória' }, { status: 400 });
    }

    const sid = sessionId || crypto.randomUUID();
    const supabase = getSupabaseAdmin();

    // 1. Get or create conversation
    let { data: conversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('session_id', sid)
      .single();

    if (!conversation) {
      const { data: newConv } = await supabase
        .from('conversations')
        .insert({ session_id: sid })
        .select('id')
        .single();
      conversation = newConv;
    }

    // 2. Get conversation history (last 5 messages)
    const { data: historyRows } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversation!.id)
      .order('created_at', { ascending: true })
      .limit(10);

    const history = (historyRows || []).map(h => ({
      role: h.role,
      content: h.content,
    }));

    // 3. Search knowledge base (RAG)
    const chunks = await searchKnowledge(message, 3);
    const ragContext = buildRagContext(chunks);

    // 4. Search frequent questions
    const faqs = await searchFrequentQuestions(message, 2);
    const faqContext = buildFaqContext(faqs);

    // 5. Build optimized prompt
    const { system, messages } = buildPrompt(ragContext, faqContext, history, message);

    // 6. Call DeepSeek
    const { content: answer, usage } = await callDeepSeek(system, messages);

    // 7. Save messages
    await supabase.from('messages').insert([
      {
        conversation_id: conversation!.id,
        role: 'user',
        content: message,
        tokens_used: 0,
      },
      {
        conversation_id: conversation!.id,
        role: 'assistant',
        content: answer,
        tokens_used: usage.total_tokens,
      },
    ]);

    // 8. Track question for learning (fire and forget)
    trackQuestion(message).catch(() => {});

    return NextResponse.json({
      answer,
      sessionId: sid,
      usage: {
        total: usage.total_tokens,
        cached: usage.prompt_cache_hit_tokens || 0,
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor. Tente novamente.' },
      { status: 500 }
    );
  }
}

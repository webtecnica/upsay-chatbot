import { NextRequest, NextResponse } from 'next/server';
import { callDeepSeek } from '@/lib/deepseek';
import { callOpenRouterVision, callOpenRouterText } from '@/lib/openrouter';
import { searchKnowledge, searchFrequentQuestions, trackQuestion, buildRagContext, buildFaqContext } from '@/lib/rag';
import { buildPrompt, SYSTEM_PROMPT } from '@/lib/prompts';
import { getSupabaseAdmin } from '@/lib/supabase';

const IMAGE_ANALYSIS_INSTRUCTION = `

INSTRUÇÃO ADICIONAL PARA ANÁLISE DE IMAGEM:
O usuário enviou uma imagem para análise. Analise cuidadosamente o conteúdo visual da imagem.
- Se for um print/screenshot de tela: descreva o que vê e ajude com a dúvida do usuário.
- Se for um erro ou problema visual: identifique o problema e sugira soluções.
- Se o usuário fez uma pergunta específica, responda com base na imagem.
- Se não fez pergunta, descreva o conteúdo relevante da imagem.
Responda sempre em português brasileiro.`;

const PDF_ANALYSIS_INSTRUCTION = `

INSTRUÇÃO ADICIONAL PARA ANÁLISE DE DOCUMENTO:
O usuário enviou um documento PDF para análise. O conteúdo extraído do documento está incluído na mensagem.
- Analise o conteúdo do documento e responda à pergunta do usuário.
- Se não houver pergunta específica, faça um resumo claro e útil do documento.
- Destaque pontos importantes, dados relevantes ou problemas encontrados.
Responda sempre em português brasileiro.`;

export async function POST(req: NextRequest) {
  try {
    const { message, sessionId, imageDataUrl, pdfBase64, pdfFileName } = await req.json();

    const hasImage = !!imageDataUrl;
    const hasPdf = !!pdfBase64;

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

    let answer: string;
    let tokensUsed = 0;

    if (hasImage) {
      // ===== IMAGE ANALYSIS via OpenRouter Vision =====
      const systemPrompt = SYSTEM_PROMPT + IMAGE_ANALYSIS_INSTRUCTION;
      answer = await callOpenRouterVision(systemPrompt, message, imageDataUrl);

    } else if (hasPdf) {
      // ===== PDF ANALYSIS via OpenRouter Text =====
      let pdfText = '';
      try {
        const pdfBuffer = Buffer.from(pdfBase64, 'base64');
        const { PDFParse } = await import('pdf-parse');
        const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
        const textResult = await parser.getText();
        pdfText = textResult.text || '';
        await parser.destroy();
      } catch (pdfError) {
        console.error('PDF parse error:', pdfError);
        pdfText = '[Erro ao extrair texto do PDF. O arquivo pode estar protegido ou corrompido.]';
      }

      if (!pdfText.trim()) {
        pdfText = '[O PDF parece não conter texto extraível. Pode ser um PDF escaneado/imagem.]';
      }

      const systemPrompt = SYSTEM_PROMPT + PDF_ANALYSIS_INSTRUCTION;
      answer = await callOpenRouterText(systemPrompt, message, pdfText);

    } else {
      // ===== REGULAR TEXT via DeepSeek (existing flow) =====
      // 3. Search knowledge base (RAG)
      const chunks = await searchKnowledge(message, 3);
      const ragContext = buildRagContext(chunks);

      // 4. Search frequent questions
      const faqs = await searchFrequentQuestions(message, 2);
      const faqContext = buildFaqContext(faqs);

      // 5. Build optimized prompt
      const { system, messages } = buildPrompt(ragContext, faqContext, history, message);

      // 6. Call DeepSeek
      const result = await callDeepSeek(system, messages);
      answer = result.content;
      tokensUsed = result.usage.total_tokens;
    }

    // 7. Save messages (store attachment info in content for history)
    const userContent = hasImage
      ? `[📷 Imagem anexada] ${message}`
      : hasPdf
        ? `[📄 PDF: ${pdfFileName || 'documento.pdf'}] ${message}`
        : message;

    await supabase.from('messages').insert([
      {
        conversation_id: conversation!.id,
        role: 'user',
        content: userContent,
        tokens_used: 0,
      },
      {
        conversation_id: conversation!.id,
        role: 'assistant',
        content: answer,
        tokens_used: tokensUsed,
      },
    ]);

    // 8. Track question for learning (fire and forget)
    trackQuestion(message).catch(() => {});

    return NextResponse.json({
      answer,
      sessionId: sid,
      usage: {
        total: tokensUsed,
        cached: 0,
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

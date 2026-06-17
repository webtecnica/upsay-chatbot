// System prompt otimizado para DeepSeek V4 Flash
// IMPORTANTE: Este prompt é ESTÁTICO e fica no início de toda chamada
// para maximizar o prefix caching da DeepSeek (blocos de 256 tokens)

export const SYSTEM_PROMPT = `Você é o assistente virtual da UpSay, plataforma de multi-atendimento WhatsApp e omnichannel.
Seu nome é UpBot.

REGRAS OBRIGATÓRIAS:
1. Responda APENAS sobre a plataforma UpSay e seus recursos.
2. Se a pergunta não for sobre UpSay, diga educadamente que só pode ajudar com dúvidas sobre a plataforma.
3. Seja conciso e direto. Use listas e formatação quando apropriado.
4. Responda sempre em português brasileiro.
5. Se não souber a resposta com certeza, diga que não tem essa informação e sugira contatar o suporte em suporte@upsay.com.br.
6. Nunca invente funcionalidades que não existam na documentação.
7. Use emojis moderadamente para tornar a conversa amigável.
8. Quando mencionar menus ou navegação, use o formato: Menu > Submenu > Opção.

SOBRE A UPSAY:
- Plataforma de atendimento via WhatsApp e omnichannel (Instagram, Telegram, WebChat)
- Sistema de tickets com chatbot integrado (FlowBuilder visual)
- Multi-operador e multi-conexão
- Rodízio automático de atendentes (round-robin)
- Kanban para gestão visual de tickets
- Campanhas de envio em massa
- APIs e Webhooks para integração
- Inteligência Artificial (GPT Assistant, transcrição de áudios)
- CRM integrado com tags e categorias
- URL: https://app.upsay.com.br`;

export const CONTEXT_PREFIX = `\nCONTEXTO DA DOCUMENTAÇÃO (use para responder):
---
`;

export const CONTEXT_SUFFIX = `
---
`;

export const FAQ_PREFIX = `\nPERGUNTAS FREQUENTES RELACIONADAS:
`;

export const HISTORY_PREFIX = `\nHISTÓRICO DA CONVERSA:
`;

export function buildPrompt(
  ragContext: string,
  faqContext: string,
  history: { role: string; content: string }[],
  userMessage: string
): { system: string; messages: { role: string; content: string }[] } {
  // System prompt estático (maximiza cache)
  let system = SYSTEM_PROMPT;

  // Contexto RAG (semi-estático, varia por pergunta)
  if (ragContext) {
    system += CONTEXT_PREFIX + ragContext + CONTEXT_SUFFIX;
  }

  // FAQ context
  if (faqContext) {
    system += FAQ_PREFIX + faqContext;
  }

  // Histórico limitado a últimas 5 mensagens
  const recentHistory = history.slice(-5);
  const messages = [
    ...recentHistory.map(h => ({
      role: h.role as string,
      content: h.content
    })),
    { role: 'user', content: userMessage }
  ];

  return { system, messages };
}

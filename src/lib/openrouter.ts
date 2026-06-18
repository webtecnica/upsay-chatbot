const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODEL = 'openai/gpt-4.1-nano';

interface OpenRouterResponse {
  choices: {
    message: { role: string; content: string };
  }[];
}

/**
 * Call OpenRouter with an image for vision analysis.
 * imageDataUrl should be a base64 data URL like "data:image/jpeg;base64,..."
 */
export async function callOpenRouterVision(
  systemPrompt: string,
  userText: string,
  imageDataUrl: string
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured');

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://upsay.com.br',
      'X-Title': 'UpBot',
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: userText },
            {
              type: 'image_url',
              image_url: { url: imageDataUrl },
            },
          ],
        },
      ],
      temperature: 0.3,
      max_tokens: 1200,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('OpenRouter Vision error:', error);
    throw new Error(`OpenRouter API error: ${response.status}`);
  }

  const data: OpenRouterResponse = await response.json();
  return data.choices[0]?.message?.content || 'Não consegui analisar a imagem.';
}

/**
 * Call OpenRouter with extra text context (e.g., extracted PDF text).
 */
export async function callOpenRouterText(
  systemPrompt: string,
  userText: string,
  documentText: string
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured');

  const truncatedDoc = documentText.slice(0, 12000); // Limit context size

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://upsay.com.br',
      'X-Title': 'UpBot',
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `${userText}\n\n--- CONTEÚDO DO DOCUMENTO ---\n${truncatedDoc}\n--- FIM DO DOCUMENTO ---`,
        },
      ],
      temperature: 0.3,
      max_tokens: 1200,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('OpenRouter Text error:', error);
    throw new Error(`OpenRouter API error: ${response.status}`);
  }

  const data: OpenRouterResponse = await response.json();
  return data.choices[0]?.message?.content || 'Não consegui analisar o documento.';
}

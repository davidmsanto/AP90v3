// Cliente unificado para chamadas de IA (Gemini ou OpenAI)

export type AIProvider = 'gemini' | 'openai';

export interface AISettings {
  provider: AIProvider;
  apiKey: string;
  model?: string;
}

const STORAGE_KEY_API = 'ap90_ai_api_key';
const STORAGE_KEY_PROVIDER = 'ap90_ai_provider';

export function getAISettings(): AISettings {
  const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (import.meta as any).env?.VITE_OPENAI_API_KEY || '';
  const storedKey = localStorage.getItem(STORAGE_KEY_API) || envKey;
  const storedProvider = (localStorage.getItem(STORAGE_KEY_PROVIDER) as AIProvider) || 'gemini';
  
  return {
    provider: storedProvider,
    apiKey: storedKey,
    model: storedProvider === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o-mini',
  };
}

export function saveAISettings(provider: AIProvider, apiKey: string): void {
  localStorage.setItem(STORAGE_KEY_PROVIDER, provider);
  localStorage.setItem(STORAGE_KEY_API, apiKey.trim());
}

export async function callAIJson<T = any>(prompt: string, systemInstruction?: string): Promise<T> {
  const { provider, apiKey, model } = getAISettings();

  if (!apiKey) {
    throw new Error('CHAVE_NAO_CONFIGURADA');
  }

  if (provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-1.5-flash'}:generateContent?key=${apiKey}`;
    
    const body: any = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Erro na API Gemini (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error('Resposta da IA veio vazia');
    }

    return JSON.parse(rawText) as T;
  } else {
    // OpenAI Compatible
    const url = 'https://api.openai.com/v1/chat/completions';
    const messages: any[] = [];
    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction });
    }
    messages.push({ role: 'user', content: prompt });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages,
        response_format: { type: 'json_object' },
        temperature: 0.1,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Erro na API OpenAI (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    return JSON.parse(content) as T;
  }
}

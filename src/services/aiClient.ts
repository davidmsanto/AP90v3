// Cliente unificado para chamadas de IA (Gemini ou OpenAI)

export type AIProvider = 'gemini' | 'openai';

export interface AISettings {
  provider: AIProvider;
  apiKey: string;
  model?: string;
}

const STORAGE_KEY_API = 'ap90_ai_api_key';
const STORAGE_KEY_PROVIDER = 'ap90_ai_provider';
const STORAGE_KEY_MODEL = 'ap90_ai_model';

const FALLBACK_GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash-8b',
  'gemini-2.0-flash-lite-preview-02-05',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-flash-002',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro',
  'gemini-1.5-pro-002',
  'gemini-1.5-pro-latest',
  'gemini-2.0-flash-exp',
  'gemini-2.0-pro-exp-02-05',
];

let cachedGeminiModel: string | null = null;

export function getAISettings(): AISettings {
  const envKey = (import.meta as any)?.env?.VITE_GEMINI_API_KEY || (import.meta as any)?.env?.VITE_OPENAI_API_KEY || process?.env?.VITE_GEMINI_API_KEY || process?.env?.GEMINI_API_KEY || '';
  const storedKey = typeof localStorage !== 'undefined' ? (localStorage.getItem(STORAGE_KEY_API) || envKey) : envKey;
  const storedProvider = typeof localStorage !== 'undefined' ? ((localStorage.getItem(STORAGE_KEY_PROVIDER) as AIProvider) || 'gemini') : 'gemini';
  let storedModel = typeof localStorage !== 'undefined' ? (localStorage.getItem(STORAGE_KEY_MODEL) || cachedGeminiModel) : cachedGeminiModel;

  // Limpa qualquer resquício de modelo depreciado armazenado
  if (storedModel === 'gemini-2.5-flash' || storedModel === 'models/gemini-2.5-flash') {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY_MODEL);
    storedModel = null;
    cachedGeminiModel = null;
  }
  
  return {
    provider: storedProvider,
    apiKey: storedKey,
    model: storedProvider === 'gemini' ? (storedModel || 'gemini-2.0-flash') : 'gpt-4o-mini',
  };
}

export function saveAISettings(provider: AIProvider, apiKey: string, model?: string): void {
  localStorage.setItem(STORAGE_KEY_PROVIDER, provider);
  localStorage.setItem(STORAGE_KEY_API, apiKey.trim());
  if (model) {
    localStorage.setItem(STORAGE_KEY_MODEL, model.trim());
  }
}

export function clearAISettings(): void {
  localStorage.removeItem(STORAGE_KEY_API);
  localStorage.removeItem(STORAGE_KEY_PROVIDER);
  localStorage.removeItem(STORAGE_KEY_MODEL);
  cachedGeminiModel = null;
}

async function discoverAvailableGeminiModels(apiKey: string): Promise<string[]> {
  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (listRes.ok) {
      const data = await listRes.json();
      const models: string[] = (data.models || [])
        .filter((m: any) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
        .map((m: any) => m.name.replace(/^models\//, ''))
        .filter((m: string) => !m.includes('2.5-flash'));

      console.info('Modelos Gemini disponíveis para esta chave:', models);
      return models;
    }
  } catch (err) {
    console.warn('Falha ao consultar ListModels do Gemini:', err);
  }
  return [];
}

export async function callAIJson<T = any>(prompt: string, systemInstruction?: string): Promise<T> {
  const { provider, apiKey, model } = getAISettings();

  if (!apiKey) {
    throw new Error('CHAVE_NAO_CONFIGURADA');
  }

  if (provider === 'gemini') {
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

    // Consulta modelos oficiais habilitados para a chave
    let discoveredModels: string[] = [];
    try {
      discoveredModels = await discoverAvailableGeminiModels(apiKey);
    } catch {
      discoveredModels = [];
    }

    // Monta a fila de candidatos respeitando preferências e menor chance de 503
    const candidateQueue: string[] = [];

    if (model && !model.includes('2.5-flash')) {
      candidateQueue.push(model);
    }
    if (cachedGeminiModel && !candidateQueue.includes(cachedGeminiModel) && !cachedGeminiModel.includes('2.5-flash')) {
      candidateQueue.push(cachedGeminiModel);
    }

    // Adiciona modelos prioritários (gemini-2.0-flash e gemini-1.5-flash-8b que tem baixa sobrecarga)
    for (const fb of FALLBACK_GEMINI_MODELS) {
      if (!candidateQueue.includes(fb)) {
        if (discoveredModels.length === 0 || discoveredModels.includes(fb)) {
          candidateQueue.push(fb);
        }
      }
    }

    // Adiciona outros modelos flash descobertos
    for (const d of discoveredModels) {
      if (d.includes('flash') && !candidateQueue.includes(d)) {
        candidateQueue.push(d);
      }
    }

    // Adiciona qualquer outro modelo restante descoberto
    for (const d of discoveredModels) {
      if (!candidateQueue.includes(d)) {
        candidateQueue.push(d);
      }
    }

    let lastError: { status: number | string; message: string; model: string } | null = null;

    for (const candidate of candidateQueue) {
      console.info(`[Gemini] Tentando modelo: ${candidate}...`);

      const endpoints = [
        `https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent?key=${apiKey}`
      ];
      if (candidate.startsWith('gemini-1.5')) {
        endpoints.push(`https://generativelanguage.googleapis.com/v1/models/${candidate}:generateContent?key=${apiKey}`);
      }

      for (const endpoint of endpoints) {
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });

          if (res.ok) {
            const data = await res.json();
            const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (rawText) {
              cachedGeminiModel = candidate;
              localStorage.setItem(STORAGE_KEY_MODEL, candidate);
              return JSON.parse(rawText) as T;
            }
          }

          const status = res.status;
          const errText = await res.text();
          lastError = { status, message: errText, model: candidate };

          console.warn(`[Gemini] Modelo ${candidate} retornou HTTP ${status}. Tentando próximo candidato...`);
          // Não espera em 503/429 - pula imediatamente para o próximo modelo para contornar sobrecarga
          break;
        } catch (netErr: any) {
          lastError = { status: 'NET_ERR', message: netErr?.message || String(netErr), model: candidate };
          console.warn(`[Gemini] Falha de rede no modelo ${candidate}:`, netErr);
          break;
        }
      }
    }

    if (lastError?.status === 503) {
      throw new Error('Servidores do Google Gemini com alta demanda temporária mundial (503 UNAVAILABLE).');
    } else if (lastError?.status === 429) {
      throw new Error('Limite de requisições da chave atingido temporariamente (429 RATE_LIMIT).');
    } else if (lastError?.status === 404) {
      throw new Error(`Modelo não encontrado para a versão de API (404 NOT_FOUND).`);
    } else {
      throw new Error(`Erro na API Gemini (${lastError?.status || 'ERR'}): ${lastError?.message || 'Sem resposta'}`);
    }
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

export async function testAIConnection(): Promise<{ success: boolean; model?: string; message: string }> {
  const { apiKey } = getAISettings();
  if (!apiKey) {
    return { success: false, message: 'Nenhuma chave de API configurada.' };
  }

  try {
    await callAIJson<{ status: string }>('Retorne exatamente o JSON: {"status": "ok"}');
    const currentModel = getAISettings().model;
    return {
      success: true,
      model: currentModel,
      message: `Conexão bem-sucedida com o modelo ${currentModel}!`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || String(err),
    };
  }
}

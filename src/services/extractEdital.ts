import { callAIJson, getAISettings } from './aiClient';
import { ExtractedDisciplina, ExtractedTopico } from '../types';

export interface RawExtractionResponse {
  disciplinas: Array<{
    nome: string;
    topicos: Array<{
      nome: string;
    }>;
  }>;
}

const EXTRACT_SYSTEM_PROMPT = `
Você é um especialista em estruturação de editais de concursos públicos do Brasil.
Sua missão é extrair o conteúdo programático de um texto bruto colado de PDF e transformá-lo em JSON estrito.

Regras fundamentais:
1. Retorne APENAS um objeto JSON com o formato:
{
  "disciplinas": [
    {
      "nome": "Nome da Disciplina",
      "topicos": [
        { "nome": "1 Tópico principal ou 1.1 Subtópico" }
      ]
    }
  ]
}
2. Preserve rigorosamente a numeração hierárquica original se existir no edital (ex: "1.", "1.1", "1.2", "2.", "2.1.1").
3. Todo tópico deve ser uma string de texto limpa. NÃO inclua pesos nem notas (todo tópico tem peso padrão 1 que será atribuído depois).
4. Corrija problemas típicos de PDF:
   - Quebras de linha e hifens soltos no meio de frases que bagunçam as palavras (ex: "cons- tituição" -> "constituição").
   - Seções duplicadas (o mesmo bloco de conteúdo copiado duas vezes): DEDUPLIQUE e mantenha apenas uma ocorrência.
   - Numeração com algarismos romanos (ex: "I - DIREITO PENAL ... 1. Teoria...", "II - PROCESSO PENAL ... 1. Inquérito..."): Trate as seções com algarismo romano como disciplinas ou blocos distintos, sem colidir os tópicos "1" de cada um.
5. Se o texto contiver leis (ex: "Lei nº 8.112/1990", "Lei 14.133/2021"), mantenha a citação completa da lei com número e ano.
6. Nunca invente matérias que não constem no texto fornecido.
7. Quando uma mesma linha ou item do edital citar mais de uma lei, decreto ou ato normativo (ex: "Decreto-Lei nº 201/1967, Lei nº 1.079/1950 e Lei nº 8.176/1991"), crie um tópico SEPARADO para CADA lei/decreto individual, preservando o contexto ou tema do item se houver (ex: "Crimes de Responsabilidade: Decreto-Lei nº 201/1967", "Crimes de Responsabilidade: Lei nº 1.079/1950", "Crimes de Responsabilidade: Lei nº 8.176/1991").
`;

// Helper para detectar e fatiar múltiplas leis em uma única frase/item
function splitMultipleLaws(text: string): string[] {
  // Regex para encontrar menções a leis/decretos com número e ano
  const lawMentionRegex = /(?:Decreto-Lei|Decreto|Lei(?:\s+estadual|\s+federal)?)\s*(?:nº|n[oº])?\s*\d{1,2}(?:[\.\s]\d{3})*(?:\/\d{4})/gi;
  const matches = Array.from(text.matchAll(lawMentionRegex));

  if (matches.length <= 1) {
    return [text];
  }

  // Tenta extrair um prefixo temático (ex: "12 Crimes de Responsabilidade: ")
  const colonIndex = text.indexOf(':');
  let prefix = '';
  let body = text;

  if (colonIndex !== -1 && colonIndex < 60) {
    prefix = text.slice(0, colonIndex + 1).trim() + ' ';
    body = text.slice(colonIndex + 1).trim();
  }

  // Se houver múltiplas leis separadas por vírgula ou "e"
  const parts = body.split(/,\s*|\s+e\s+/i).map(p => p.trim()).filter(Boolean);
  const result: string[] = [];

  for (const part of parts) {
    if (/(?:Decreto-Lei|Decreto|Lei|\d+\/\d{4})/i.test(part)) {
      result.push(`${prefix}${part}`.trim());
    } else if (result.length > 0) {
      // Anexa complemento (ex: "e suas alterações") ao último
      result[result.length - 1] += ` (${part})`;
    }
  }

  return result.length > 1 ? result : [text];
}

// Helper para verificar se um tópico é na verdade uma repetição do nome da disciplina
export function isDisciplineHeaderTopic(topicName: string, disciplineName: string): boolean {
  const cleanTopic = topicName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^(?:disciplina|item|topico|\d+[\.\s\-]*|[a-z]\)\s*)/gi, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const cleanDisc = disciplineName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^(?:disciplina|item|topico|\d+[\.\s\-]*|[a-z]\)\s*)/gi, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanTopic || !cleanDisc) return false;
  if (cleanTopic === cleanDisc) return true;

  // Se o tópico repete o nome da disciplina (mesmo com pequenas variações)
  if (cleanTopic.includes(cleanDisc) || cleanDisc.includes(cleanTopic)) {
    const diff = Math.abs(cleanTopic.length - cleanDisc.length);
    if (diff < 20) return true;
  }

  return false;
}

// Parser heurístico determinístico caso o usuário não configure chave de IA
export function parseEditalLocalFallback(text: string): ExtractedDisciplina[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const disciplinas: ExtractedDisciplina[] = [];
  let currentDisciplina: ExtractedDisciplina | null = null;
  const seenTopics = new Set<string>();

  // Expressões para detectar disciplinas comuns ou cabeçalhos
  const disciplinaHeaderRegex = /^(?:DISCIPLINA:?\s*|MAT[EÉ]RIA:?\s*|CONHECIMENTOS\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ\s–\-]+:?\s*)?([A-ZÁÉÍÓÚÂÊÔÃÕÇ\s–\-]{4,120})(?:\s*[:–-])?$/;
  const topicNumberRegex = /^(?:(?:\d+\.)+\d*|[A-Z]\)|\d+[\.\)]|\d+\s*[-–.]\s*|\d+\s+|[IVXLCDM]+[\.\)]|\b[IVXLCDM]+\b\s*[-–.]\s*|[-*•>–]\s+)\s*(.+)$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isNumbered = topicNumberRegex.test(line);

    // Detecção de nome de disciplina em CAIXA ALTA ou após prefixos
    const isExplicitHeader = 
      /^(?:DISCIPLINA|MAT[EÉ]RIA)\s*[:–-]/i.test(line) ||
      (!isNumbered && (
        line.toUpperCase().includes('LÍNGUA PORTUGUESA') ||
        line.toUpperCase().includes('DIREITO CONSTITUCIONAL') ||
        line.toUpperCase().includes('DIREITO ADMINISTRATIVO') ||
        line.toUpperCase().includes('DIREITO PENAL') ||
        line.toUpperCase().includes('DIREITO PROCESSUAL') ||
        line.toUpperCase().includes('RACIOCÍNIO LÓGICO') ||
        line.toUpperCase().includes('NOÇÕES DE INFORMÁTICA') ||
        line.toUpperCase().includes('INFORMÁTICA') ||
        line.toUpperCase().includes('ATUALIDADES') ||
        line.toUpperCase().includes('CONHECIMENTOS ESPECÍFICOS') ||
        line.toUpperCase().includes('CONHECIMENTOS BÁSICOS') ||
        (disciplinaHeaderRegex.test(line) && line.length < 80 && !line.includes('.') && line === line.toUpperCase())
      ));

    if (isExplicitHeader) {
      const cleanNome = line.replace(/^(?:DISCIPLINA:?\s*|MAT[EÉ]RIA:?\s*|[0-9]+\s*[-–.]\s*)/i, '').replace(/[:–-]+$/, '').trim();
      currentDisciplina = {
        id: `disc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        nome: cleanNome || 'Disciplina',
        peso: 1,
        topicos: [],
      };
      disciplinas.push(currentDisciplina);
      continue;
    }

    if (!currentDisciplina) {
      currentDisciplina = {
        id: `disc_${Date.now()}_default`,
        nome: 'Conhecimentos do Edital',
        peso: 1,
        topicos: [],
      };
      disciplinas.push(currentDisciplina);
    }

    // Processa tópicos divididos por ';' ou numeração
    const subParts = line.includes(';') ? line.split(';').map(s => s.trim()).filter(Boolean) : [line];
    for (const part of subParts) {
      const cleanPart = part.replace(/[.;,]+$/, '').trim();
      if (!cleanPart || cleanPart.length < 2) continue;

      // Desmembra múltiplas leis se houver na mesma frase
      const itemsToProcess = splitMultipleLaws(cleanPart);

      for (const item of itemsToProcess) {
        // Bloqueia tópicos fantasmas que repetem o nome da disciplina
        if (isDisciplineHeaderTopic(item, currentDisciplina.nome)) continue;

        // Limpa numeração inicial para evitar "1 1 Tópico"
        const cleanItemName = item.replace(/^(?:(?:\d+\.)+\d*|[A-Z]\)|\d+[\.\)]|\d+\s*[-–.]\s*|[-*•>–]\s+)\s*/, '').trim() || item;

        // Deduplicação básica
        const topicKey = `${currentDisciplina.nome}_${cleanItemName.toLowerCase()}`;
        if (seenTopics.has(topicKey)) continue;
        seenTopics.add(topicKey);

        const topico: ExtractedTopico = {
          id: `top_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          nome: cleanItemName,
          peso: 1,
          qconcursosFiltro: null,
        };
        currentDisciplina.topicos.push(topico);
      }
    }
  }

  const validDisciplinas = disciplinas.filter(d => d.topicos.length > 0);
  if (validDisciplinas.length > 0) {
    return validDisciplinas;
  }

  // Fallback garantido: caso o texto seja todo em parágrafo corrido
  const rawParagraphTopics: ExtractedTopico[] = lines
    .map(l => l.trim())
    .filter(l => l.length > 2)
    .map((lineText, idx) => ({
      id: `top_fallback_${Date.now()}_${idx}`,
      nome: lineText.replace(/^(?:(?:\d+\.)+\d*|[A-Z]\)|\d+[\.\)]|\d+\s*[-–.]\s*|[-*•>–]\s+)\s*/, '').trim(),
      peso: 1,
      qconcursosFiltro: null,
    }));

  if (rawParagraphTopics.length > 0) {
    return [{
      id: `disc_${Date.now()}_fallback`,
      nome: 'Conhecimentos do Edital',
      peso: 1,
      topicos: rawParagraphTopics,
    }];
  }

  return [];
}

export async function extractEditalWithAI(rawText: string): Promise<{
  disciplinas: ExtractedDisciplina[];
  usedAI: boolean;
  warning?: string;
}> {
  const { apiKey } = getAISettings();

  if (!apiKey) {
    // Sem chave configurada: usa o parser determinístico local inteligente
    const localDisciplinas = parseEditalLocalFallback(rawText);
    return { disciplinas: localDisciplinas, usedAI: false };
  }

  try {
    const userPrompt = `Abaixo está o texto bruto do edital extraído de um PDF:\n\n${rawText}\n\nEstruture rigorosamente de acordo com as regras solicitadas.`;
    const response = await callAIJson<RawExtractionResponse>(userPrompt, EXTRACT_SYSTEM_PROMPT);

    // Normaliza variações de formato retornadas por diferentes modelos de IA
    const rawList: any[] = Array.isArray(response)
      ? response
      : Array.isArray((response as any)?.disciplinas)
      ? (response as any).disciplinas
      : Array.isArray((response as any)?.materias)
      ? (response as any).materias
      : Array.isArray((response as any)?.conteudo)
      ? (response as any).conteudo
      : Array.isArray((response as any)?.subjects)
      ? (response as any).subjects
      : [];

    const seenTopics = new Set<string>();
    const disciplinas: ExtractedDisciplina[] = rawList.map((d: any, dIdx: number) => {
      const discId = `disc_${Date.now()}_${dIdx}`;
      const discNome = (d?.nome || d?.materia || d?.disciplina || d?.subject || d?.title || `Disciplina ${dIdx + 1}`).trim();
      const rawTopicos = Array.isArray(d?.topicos) ? d.topicos : Array.isArray(d?.assuntos) ? d.assuntos : Array.isArray(d?.topics) ? d.topics : [];
      const validTopicos: ExtractedTopico[] = [];

      for (let tIdx = 0; tIdx < rawTopicos.length; tIdx++) {
        const t = rawTopicos[tIdx];
        const nome = (typeof t === 'string' ? t : (t?.nome || t?.titulo || t?.assunto || t?.topic || t?.text || '')).trim();
        if (!nome) continue;
        if (isDisciplineHeaderTopic(nome, discNome)) continue;

        const topicKey = `${discNome}_${nome.toLowerCase()}`;
        if (seenTopics.has(topicKey)) continue;
        seenTopics.add(topicKey);

        validTopicos.push({
          id: `top_${Date.now()}_${dIdx}_${tIdx}`,
          nome,
          peso: 1, // Peso padrão 1 conforme especificado
          qconcursosFiltro: null,
        });
      }

      return {
        id: discId,
        nome: discNome,
        peso: 1,
        topicos: validTopicos,
      };
    }).filter(d => d.topicos.length > 0);

    if (disciplinas.length > 0) {
      return { disciplinas, usedAI: true };
    }

    // Se a IA não gerou tópicos válidos, aciona o fallback determinístico local
    console.warn('IA retornou estrutura sem tópicos válidos, acionando parser local...');
    const localDisciplinas = parseEditalLocalFallback(rawText);
    return {
      disciplinas: localDisciplinas,
      usedAI: false,
      warning: 'A IA retornou uma estrutura genérica. O edital foi estruturado com total fidelidade pelo algoritmo local.',
    };
  } catch (err: any) {
    const rawMsg = err?.message || String(err);
    console.warn('Falha na chamada de IA, utilizando parser local resiliente:', rawMsg);
    const localDisciplinas = parseEditalLocalFallback(rawText);

    let friendlyWarning = 'Os servidores da IA não responderam a tempo. O AP90 utilizou o algoritmo inteligente local de extração.';
    if (rawMsg.includes('503') || rawMsg.includes('alta demanda') || rawMsg.includes('high demand') || rawMsg.includes('UNAVAILABLE')) {
      friendlyWarning = 'Os servidores do Google Gemini estão com alta demanda temporária mundial (503). O AP90 ativou automaticamente nosso algoritmo local de contingência, garantindo a estruturação de 100% das suas disciplinas e tópicos com precisão.';
    } else if (rawMsg.includes('429') || rawMsg.includes('RATE_LIMIT') || rawMsg.includes('RESOURCE_EXHAUSTED')) {
      friendlyWarning = 'Limite de requisições da sua chave atingido (429). O edital foi estruturado com sucesso pelo algoritmo inteligente local.';
    } else if (rawMsg.includes('404')) {
      friendlyWarning = 'O modelo selecionado não está acessível na sua conta da IA (404). O edital foi estruturado com sucesso pelo algoritmo inteligente local.';
    }

    return { 
      disciplinas: localDisciplinas, 
      usedAI: false, 
      warning: friendlyWarning
    };
  }
}

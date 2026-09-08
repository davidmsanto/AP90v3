import { 
  TaxonomiaDisciplina, 
  ExtractedDisciplina, 
  ExtractedTopico, 
  QConcursosFiltro,
  Topico
} from '../types';
import { callAIJson, getAISettings } from './aiClient';

// Cache em memória da taxonomia completa durante a sessão de importação
let cachedTaxonomia: TaxonomiaDisciplina[] | null = null;

export async function loadTaxonomiaQC(): Promise<TaxonomiaDisciplina[]> {
  if (cachedTaxonomia) return cachedTaxonomia;

  const res = await fetch('/data-source/taxonomia_qc_full.json');
  if (!res.ok) {
    throw new Error(`Falha ao carregar taxonomia do QConcursos: HTTP ${res.status}`);
  }
  const data: TaxonomiaDisciplina[] = await res.json();
  cachedTaxonomia = data;
  return data;
}

/**
 * Gera a URL oficial de resolução de questões no QConcursos com os filtros de disciplina e assunto.
 */
export function buildQConcursosUrl(filtro: QConcursosFiltro): string {
  const params = new URLSearchParams();
  if (filtro.disciplinaId) {
    params.append('discipline_ids[]', filtro.disciplinaId);
  }
  if (filtro.assuntoId) {
    params.append('subject_ids[]', filtro.assuntoId);
  }
  return `https://www.qconcursos.com/questoes-de-concursos/questoes?${params.toString()}`;
}

// Mapeamento configurável de disciplina do edital -> IDs de disciplinas candidatas no QConcursos
export const DEFAULT_DISCIPLINE_CANDIDATES_MAP: Record<string, number[]> = {
  // Português
  'portugues': [1],
  'lingua portuguesa': [1],
  'redacao oficial': [1],
  
  // Direitos
  'direito administrativo': [2],
  'nocoes de direito administrativo': [2],
  'direito constitucional': [3],
  'nocoes de direito constitucional': [3],
  'direito penal': [9],
  'nocoes de direito penal': [9],
  'legislacao penal especial': [9, 10],
  'direito processual penal': [10],
  'nocoes de direito processual penal': [10],
  'processo penal': [10],
  'direito civil': [8],
  'direito processual civil': [560, 12],
  'processo civil': [560, 12],
  'direito tributario': [18],
  'direito previdenciario': [19],
  'direito do trabalho': [7],
  'direito processual do trabalho': [11],
  'direitos humanos': [214],
  'nocoes de direitos humanos': [214],
  'legislacao institucional do estado de alagoas': [3, 2],
  
  // Exatas / RLM
  'raciocinio logico': [4],
  'matematica': [13],
  'raciocinio logico-matematico': [4, 13],
  'raciocinio logico e matematico': [4, 13],
  'rlm': [4, 13],
  'matematica financeira': [39],
  'estatistica': [15],
  'estatistica e analise de dados': [15, 46],
  
  // Informática / TI
  'informatica': [46],
  'nocoes de informatica': [46],
  'tecnologia da informacao': [46],
  'tecnologia da informacao e seguranca cibernetica': [46],
  'crimes ciberneticos e seguranca digital': [9, 46],
  
  // Gestão, Contabilidade e Outros
  'administracao publica': [26, 21],
  'administracao geral': [21, 26],
  'administracao': [21, 26],
  'afo': [33],
  'administracao financeira e orcamentaria': [33],
  'orcamento publico': [33],
  'administracao de recursos materiais': [213],
  'gestao de materiais': [213],
  'recursos materiais': [213],
  'arquivologia': [20],
  'etica': [25],
  'etica no servico publico': [25],
  'etica na administracao publica': [25],
  'contabilidade': [16],
  'nocoes de contabilidade': [16],
  'nocoes de contabilidade analise financeira e crimes contra a ordem tributaria': [16, 18, 9],
  'atualidades': [27],
};

const STOPWORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para', 'com', 'no', 'na', 
  'nos', 'nas', 'por', 'sobre', 'seus', 'suas', 'ou', 'ao', 'aos', 'que', 
  'como', 'um', 'uma', 'uns', 'umas', 'nocoes', 'conceito', 'conceitos', 
  'gerais', 'geral', 'lei', 'art', 'artigo', 'artigos'
]);

function normalizeString(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractKeywords(str: string): string[] {
  const norm = normalizeString(str);
  return norm
    .split(' ')
    .filter(w => w.length > 2 && !STOPWORDS.has(w));
}

function findCandidateDisciplines(
  disciplinaNome: string,
  allDisciplines: TaxonomiaDisciplina[]
): TaxonomiaDisciplina[] {
  const normNome = normalizeString(disciplinaNome);
  
  // 1. Busca no mapa explícito
  let candidateIds = DEFAULT_DISCIPLINE_CANDIDATES_MAP[normNome];
  
  // Busca parcial no mapa
  if (!candidateIds) {
    for (const [key, ids] of Object.entries(DEFAULT_DISCIPLINE_CANDIDATES_MAP)) {
      if (normNome.includes(key) || key.includes(normNome)) {
        candidateIds = ids;
        break;
      }
    }
  }

  if (candidateIds && candidateIds.length > 0) {
    return allDisciplines.filter(d => candidateIds.includes(d.discipline_id));
  }

  // 2. Busca fuzzy pelo nome na taxonomia completa
  const directMatch = allDisciplines.filter(d => {
    const dNorm = normalizeString(d.discipline_nome);
    return dNorm.includes(normNome) || normNome.includes(dNorm);
  });

  if (directMatch.length > 0) return directMatch;

  // Fallback: todas as disciplinas se não houver pista
  return allDisciplines;
}

interface LawMatchResult {
  match: QConcursosFiltro | null;
  suggestions: QConcursosFiltro[];
}

// REGRA 1: Match de leis (número + ano) na taxonomia INTEIRA com desambiguação contextual
function matchLaw(
  topicName: string,
  candidateDisciplines: TaxonomiaDisciplina[],
  allDisciplines: TaxonomiaDisciplina[],
  editalDisciplinaNome: string
): LawMatchResult {
  // Regex para capturar ex: 8.112/1990, 14.133/2021, 11.340/2006, 8429/1992, 201/1967, 1.079/1950
  const lawRegex = /(?:(?:decreto-lei|decreto|lei(?:\s+estadual|\s+federal)?)\s*(?:n[oº]|nº)?\s*)?(\d{1,2}(?:[\.\s]\d{3})*|\d{3,5})(?:\/|\s*de\s*|\s*[-–]\s*)(\d{4})/i;
  const match = topicName.match(lawRegex);

  if (!match) {
    return { match: null, suggestions: [] };
  }

  const rawNum = match[1];
  const cleanNum = rawNum.replace(/[\.\s]/g, '');
  const year = match[2];

  const candidateDiscIdSet = new Set(candidateDisciplines.map(d => d.discipline_id));
  const topicKeywords = extractKeywords(topicName);
  const editalDiscKeywords = extractKeywords(editalDisciplinaNome);
  const contextWords = new Set([...topicKeywords, ...editalDiscKeywords]);

  const matchedSubjects: Array<{
    disciplineId: number;
    disciplineNome: string;
    subjectId: number;
    subjectNome: string;
    score: number;
  }> = [];

  // Busca na taxonomia INTEIRA (allDisciplines)
  for (const disc of allDisciplines) {
    for (const subj of disc.subjects) {
      const subjNome = subj.nome;
      const hasYear = subjNome.includes(year);
      const hasNum = subjNome.includes(rawNum) || subjNome.replace(/[\.\s]/g, '').includes(cleanNum);

      if (hasNum && hasYear) {
        let score = 0;

        // Bônus se pertencer às disciplinas candidatas do edital
        if (candidateDiscIdSet.has(disc.discipline_id)) {
          score += 12;
        }

        // Bônus se contiver palavras de contexto do tópico ou da disciplina do edital
        const subjKeywords = extractKeywords(subjNome);
        const discKeywords = extractKeywords(disc.discipline_nome);
        for (const w of [...subjKeywords, ...discKeywords]) {
          if (contextWords.has(w)) {
            score += 4;
          }
        }

        // Bônus se for tópico abrangente (não sub-artigo ultra específico)
        const isRootOrBroad = !subjNome.toLowerCase().includes('art.') && !subjNome.toLowerCase().includes('artigo');
        if (isRootOrBroad) {
          score += 3;
        }

        // Bônus se o nome do assunto contém a expressão do tópico ou vice-versa
        const normTopic = normalizeString(topicName);
        const normSubj = normalizeString(subjNome);
        if (normTopic.includes(normSubj) || normSubj.includes(normTopic)) {
          score += 15;
        }

        matchedSubjects.push({
          disciplineId: disc.discipline_id,
          disciplineNome: disc.discipline_nome,
          subjectId: subj.id,
          subjectNome: subj.nome,
          score,
        });
      }
    }
  }

  if (matchedSubjects.length === 0) {
    return { match: null, suggestions: [] };
  }

  // Ordena pelo melhor score contextual
  matchedSubjects.sort((a, b) => b.score - a.score);

  const best = matchedSubjects[0];
  const candidatesAsFilters: QConcursosFiltro[] = matchedSubjects.slice(0, 5).map(m => ({
    disciplinaId: String(m.disciplineId),
    assuntoId: String(m.subjectId),
    disciplinaNome: m.disciplineNome,
    assuntoNome: m.subjectNome,
  }));

  // Se só encontrou 1 resultado exato da lei na taxonomia inteira:
  if (matchedSubjects.length === 1) {
    return {
      match: {
        disciplinaId: String(best.disciplineId),
        assuntoId: String(best.subjectId),
        disciplinaNome: best.disciplineNome,
        assuntoNome: best.subjectNome,
      },
      suggestions: candidatesAsFilters,
    };
  }

  // Se encontrou mais de 1 resultado:
  // Critério de desambiguação confiante:
  // 1. O melhor tem score superior e vantagem relevante sobre o segundo (> 3 pontos), OU
  // 2. Todos os resultados pertencem à mesma disciplina e o melhor é um tópico abrangente
  const second = matchedSubjects[1];
  const confident = (best.score - second.score >= 4) || 
    (matchedSubjects.every(m => m.disciplineId === best.disciplineId) && best.score > second.score);

  if (confident) {
    return {
      match: {
        disciplinaId: String(best.disciplineId),
        assuntoId: String(best.subjectId),
        disciplinaNome: best.disciplineNome,
        assuntoNome: best.subjectNome,
      },
      suggestions: candidatesAsFilters,
    };
  }

  // Não conseguiu desambiguar com confiança absoluta:
  // Mantém match: null, mas disponibiliza todos os candidatos como sugestões
  return {
    match: null,
    suggestions: candidatesAsFilters,
  };
}

// REGRA 2: Match determinístico por interseção de palavras-chave
function matchKeywords(
  topicName: string,
  candidateDisciplines: TaxonomiaDisciplina[]
): QConcursosFiltro | null {
  const topicKeywords = extractKeywords(topicName);
  if (topicKeywords.length === 0) return null;

  let bestMatch: {
    disciplineId: number;
    disciplineNome: string;
    subjectId: number;
    subjectNome: string;
    score: number;
  } | null = null;
  let secondBestScore = 0;

  for (const disc of candidateDisciplines) {
    for (const subj of disc.subjects) {
      const subjKeywords = extractKeywords(subj.nome);
      if (subjKeywords.length === 0) continue;

      // Interseção de palavras
      let intersection = 0;
      for (const kw of topicKeywords) {
        if (subjKeywords.some(sk => sk === kw || (kw.length > 4 && sk.startsWith(kw.slice(0, 4))))) {
          intersection++;
        }
      }

      if (intersection === 0) continue;

      // Score ponderado pelo tamanho do tópico e do assunto
      const score = (intersection * 2) / (topicKeywords.length + subjKeywords.length);

      if (!bestMatch || score > bestMatch.score) {
        secondBestScore = bestMatch ? bestMatch.score : 0;
        bestMatch = {
          disciplineId: disc.discipline_id,
          disciplineNome: disc.discipline_nome,
          subjectId: subj.id,
          subjectNome: subj.nome,
          score,
        };
      } else if (score > secondBestScore) {
        secondBestScore = score;
      }
    }
  }

  // Critério de confiança: score mínimo e distância relevante para o segundo colocado
  if (bestMatch && bestMatch.score >= 0.45 && (bestMatch.score - secondBestScore >= 0.05 || bestMatch.score >= 0.8)) {
    return {
      disciplinaId: String(bestMatch.disciplineId),
      assuntoId: String(bestMatch.subjectId),
      disciplinaNome: bestMatch.disciplineNome,
      assuntoNome: bestMatch.subjectNome,
    };
  }

  return null;
}

// REGRA 3: IA residual somente para tópicos sem match determinístico
async function matchResidualWithAI(
  unmatchedTopics: Array<{ topic: ExtractedTopico; candidates: TaxonomiaDisciplina[] }>
): Promise<void> {
  const { apiKey } = getAISettings();
  if (!apiKey || unmatchedTopics.length === 0) return;

  // Processa em lote pequeno para economizar chamadas
  const promptData = unmatchedTopics.slice(0, 15).map(({ topic, candidates }) => {
    // Oferece os top 15 assuntos mais relevantes de cada disciplina candidata
    const sampleSubjects = candidates.flatMap(d => 
      d.subjects.slice(0, 15).map(s => ({
        discId: d.discipline_id,
        discNome: d.discipline_nome,
        subjId: s.id,
        subjNome: s.nome,
      }))
    );

    return {
      topicoId: topic.id,
      topicoNome: topic.nome,
      candidatos: sampleSubjects,
    };
  });

  const systemInstruction = `
Você é um especialista na taxonomia do QConcursos.
Para cada tópico do edital, encontre o ID da disciplina e do assunto mais compatível dentro da lista de candidatos fornecida.
Se nenhum candidato for suficientemente compatível, retorne null.
Retorne um JSON com a lista:
{
  "matches": [
    { "topicoId": "id", "disciplinaId": 2, "assuntoId": 1269 }
  ]
}
`;

  try {
    const res = await callAIJson<{ matches: Array<{ topicoId: string; disciplinaId: number; assuntoId: number }> }>(
      JSON.stringify(promptData),
      systemInstruction
    );

    if (res && Array.isArray(res.matches)) {
      for (const m of res.matches) {
        if (!m.disciplinaId || !m.assuntoId) continue;
        const target = unmatchedTopics.find(u => u.topic.id === m.topicoId);
        if (target) {
          const disc = target.candidates.find(d => d.discipline_id === m.disciplinaId);
          const subj = disc?.subjects.find(s => s.id === m.assuntoId);
          if (disc && subj) {
            target.topic.qconcursosFiltro = {
              disciplinaId: String(disc.discipline_id),
              assuntoId: String(subj.id),
              disciplinaNome: disc.discipline_nome,
              assuntoNome: subj.nome,
            };
          }
        }
      }
    }
  } catch (err) {
    console.warn('Falha no match residual com IA, tópicos permanecerão para revisão manual:', err);
  }
}

// Orquestrador principal da Etapa B
export async function mapEditalToQconcursos(
  disciplinas: ExtractedDisciplina[],
  onProgress?: (msg: string) => void
): Promise<{
  disciplinas: ExtractedDisciplina[];
  taxonomiaRecorte: TaxonomiaDisciplina[];
}> {
  onProgress?.('Carregando taxonomia de referência...');
  const allDisciplines = await loadTaxonomiaQC();

  const unmatched: Array<{ topic: ExtractedTopico; candidates: TaxonomiaDisciplina[] }> = [];
  const usedDisciplineIds = new Set<number>();

  for (const disc of disciplinas) {
    onProgress?.(`Mapeando tópicos de ${disc.nome}...`);
    const candidateDisciplines = findCandidateDisciplines(disc.nome, allDisciplines);
    candidateDisciplines.forEach(c => usedDisciplineIds.add(c.discipline_id));

    for (const topico of disc.topicos) {
      // 1. Tenta Match de Lei por regex (número + ano) na taxonomia INTEIRA com desambiguação
      const lawResult = matchLaw(topico.nome, candidateDisciplines, allDisciplines, disc.nome);

      if (lawResult.match) {
        topico.qconcursosFiltro = lawResult.match;
        topico.sugestoesQC = lawResult.suggestions;
        usedDisciplineIds.add(Number(lawResult.match.disciplinaId));
        continue;
      }

      // Se houver sugestões ambíguas encontradas na busca global por lei, armazena para o modal
      if (lawResult.suggestions.length > 0) {
        topico.sugestoesQC = lawResult.suggestions;
      }

      // 2. Se não achou lei, tenta Interseção de Palavras-Chave nas candidatas
      const kwMatch = matchKeywords(topico.nome, candidateDisciplines);
      if (kwMatch) {
        topico.qconcursosFiltro = kwMatch;
        usedDisciplineIds.add(Number(kwMatch.disciplinaId));
      } else {
        unmatched.push({ topic: topico, candidates: candidateDisciplines });
      }
    }
  }

  // 3. IA residual apenas para os tópicos pendentes
  if (unmatched.length > 0) {
    onProgress?.(`Processando ${unmatched.length} tópicos residuais com IA...`);
    await matchResidualWithAI(unmatched);
    
    // Adiciona quaisquer novas disciplinas mapeadas pela IA ao recorte
    for (const { topic } of unmatched) {
      if (topic.qconcursosFiltro?.disciplinaId) {
        usedDisciplineIds.add(Number(topic.qconcursosFiltro.disciplinaId));
      }
    }
  }

  // 4. Extração apenas do recorte de disciplinas usadas
  const taxonomiaRecorte: TaxonomiaDisciplina[] = allDisciplines
    .filter(d => usedDisciplineIds.has(d.discipline_id))
    .map(d => ({
      discipline_id: d.discipline_id,
      discipline_nome: d.discipline_nome,
      subjects: d.subjects,
    }));

  return { disciplinas, taxonomiaRecorte };
}

// Reprocessamento de tópicos pendentes de um edital já cadastrado
export async function reprocessarMapeamentoTopicos(
  topicos: Topico[],
  disciplinas: Array<{ id: string; nome: string }>,
  taxonomiaAtual: TaxonomiaDisciplina[],
  onProgress?: (msg: string) => void
): Promise<{
  topicosAtualizados: Topico[];
  taxonomiaRecorte: TaxonomiaDisciplina[];
  novosMapeados: number;
}> {
  onProgress?.('Carregando taxonomia de referência...');
  const allDisciplines = await loadTaxonomiaQC();

  const discMap = new Map<string, string>();
  disciplinas.forEach(d => discMap.set(d.id, d.nome));

  const usedDisciplineIds = new Set<number>(taxonomiaAtual.map(t => t.discipline_id));
  let novosMapeados = 0;

  const topicosAtualizados = topicos.map(topico => {
    // REGRA DE OURO: NUNCA sobrescrever filtro manual ou já definido
    if (topico.definidoManualmente || topico.qconcursosFiltro !== null) {
      if (topico.qconcursosFiltro?.disciplinaId) {
        usedDisciplineIds.add(Number(topico.qconcursosFiltro.disciplinaId));
      }
      return topico;
    }

    const discNome = discMap.get(topico.disciplinaId) || '';
    const candidateDisciplines = findCandidateDisciplines(discNome, allDisciplines);

    // 1. Tenta match global de lei
    const lawResult = matchLaw(topico.nome, candidateDisciplines, allDisciplines, discNome);
    if (lawResult.match) {
      novosMapeados++;
      usedDisciplineIds.add(Number(lawResult.match.disciplinaId));
      return {
        ...topico,
        qconcursosFiltro: lawResult.match,
        sugestoesQC: lawResult.suggestions,
      };
    }

    // 2. Se não deu match de lei, tenta palavras-chave
    const kwMatch = matchKeywords(topico.nome, candidateDisciplines);
    if (kwMatch) {
      novosMapeados++;
      usedDisciplineIds.add(Number(kwMatch.disciplinaId));
      return {
        ...topico,
        qconcursosFiltro: kwMatch,
        sugestoesQC: lawResult.suggestions.length > 0 ? lawResult.suggestions : topico.sugestoesQC,
      };
    }

    // Mantém pendente, mas com sugestões se houver
    return {
      ...topico,
      sugestoesQC: lawResult.suggestions.length > 0 ? lawResult.suggestions : topico.sugestoesQC,
    };
  });

  const taxonomiaRecorte: TaxonomiaDisciplina[] = allDisciplines
    .filter(d => usedDisciplineIds.has(d.discipline_id))
    .map(d => ({
      discipline_id: d.discipline_id,
      discipline_nome: d.discipline_nome,
      subjects: d.subjects,
    }));

  return {
    topicosAtualizados,
    taxonomiaRecorte,
    novosMapeados,
  };
}

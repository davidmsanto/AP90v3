import { 
  TaxonomiaDisciplina, 
  ExtractedDisciplina, 
  ExtractedTopico, 
  QConcursosFiltro,
  Topico
} from '../types';
import { callAIJson, getAISettings } from './aiClient';
import { isDisciplineHeaderTopic } from './extractEdital';

// Cache em memória da taxonomia completa durante a sessão de importação
let cachedTaxonomia: TaxonomiaDisciplina[] | null = null;

export async function loadTaxonomiaQC(): Promise<TaxonomiaDisciplina[]> {
  if (cachedTaxonomia) return cachedTaxonomia;

  if (typeof window === 'undefined' && typeof process !== 'undefined' && (process as any).versions?.node) {
    try {
      const fsMod = 'fs';
      const pathMod = 'path';
      const fs = await import(/* @vite-ignore */ fsMod);
      const path = await import(/* @vite-ignore */ pathMod);
      const cwd = typeof process.cwd === 'function' ? process.cwd() : '';
      const possiblePaths = [
        path.resolve(cwd, 'data-source/taxonomia_qc_full.json'),
        path.resolve(cwd, 'data-source/BuscaQuest/taxonomia_qc_full.json'),
        path.resolve(cwd, 'public/data-source/taxonomia_qc_full.json'),
      ];
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          cachedTaxonomia = JSON.parse(fs.readFileSync(p, 'utf-8'));
          return cachedTaxonomia!;
        }
      }
    } catch {
      // Fallback to fetch
    }
  }

  let res = await fetch('/data-source/taxonomia_qc_full.json');
  if (!res.ok) {
    res = await fetch('/data-source/BuscaQuest/taxonomia_qc_full.json');
  }
  if (!res.ok) {
    throw new Error(`Falha ao carregar taxonomia do QConcursos: HTTP ${res.status}`);
  }
  const data: TaxonomiaDisciplina[] = await res.json();
  cachedTaxonomia = data;
  return data;
}

// Mapeamento canônico das principais bancas organizadoras no QConcursos
export const BANCA_QC_MAP: Record<string, string> = {
  'cebraspe': '2',
  'cespe': '2',
  'fcc': '1',
  'fundacao carlos chagas': '1',
  'fgv': '3',
  'fundacao getulio vargas': '3',
  'vunesp': '8',
  'fundacao vunesp': '8',
  'ibfc': '24',
  'instituto aocp': '291',
  'aocp': '15',
  'quadrix': '134',
  'instituto quadrix': '134',
  'idecan': '80',
  'iades': '44',
  'selecon': '355',
  'instituto selecon': '355',
  'fundatec': '54',
  'fepese': '77',
  'avanca sp': '439',
  'nosso rumo': '100',
  'ibade': '286',
  'consulplan': '30',
  'instituto consulplan': '30',
  'instituto mais': '141',
  'legatus': '317',
  'instituto legatus': '317',
};

export function resolveBancaQCId(bancaNome?: string): string | undefined {
  if (!bancaNome) return undefined;
  const norm = normalizeString(bancaNome);
  if (BANCA_QC_MAP[norm]) return BANCA_QC_MAP[norm];
  for (const [key, id] of Object.entries(BANCA_QC_MAP)) {
    if (norm.includes(key) || key.includes(norm)) return id;
  }
  return undefined;
}

/**
 * Gera a URL oficial de resolução de questões no QConcursos Playground com os filtros de disciplina, assuntos, banca e exclusão de anuladas/desatualizadas.
 */
export function buildQConcursosUrl(filtro: QConcursosFiltro, fallbackBancaNome?: string): string {
  const params = new URLSearchParams();
  if (filtro.disciplinaId) {
    params.append('discipline_ids[]', filtro.disciplinaId);
  }

  // Suporte a múltiplos subject_ids ou assuntoId único
  if (filtro.assuntoIds && filtro.assuntoIds.length > 0) {
    for (const sid of filtro.assuntoIds) {
      if (sid) params.append('subject_ids[]', sid);
    }
  } else if (filtro.assuntoId) {
    params.append('subject_ids[]', filtro.assuntoId);
  }

  const bId = filtro.bancaId || resolveBancaQCId(fallbackBancaNome);
  if (bId) {
    params.append('examining_board_ids[]', bId);
  }

  // Exclui questões desatualizadas e anuladas para garantir cadernos de alta qualidade
  params.append('exclude_outdated', 'true');
  params.append('exclude_nullified', 'true');

  return `https://app.qconcursos.com/playground/questoes?${params.toString()}`;
}

// Mapeamento configurável de disciplina do edital -> IDs de disciplinas candidatas no QConcursos
export const DEFAULT_DISCIPLINE_CANDIDATES_MAP: Record<string, number[]> = {
  // Português
  'portugues': [1, 174],
  'lingua portuguesa': [1, 174],
  'redacao oficial': [174, 1],
  'redacao': [174, 1],
  
  // Direitos
  'direito administrativo': [2],
  'nocoes de direito administrativo': [2],
  'direito constitucional': [3],
  'nocoes de direito constitucional': [3],
  'direito penal': [9, 10],
  'nocoes de direito penal': [9, 10],
  'legislacao penal especial': [9, 10],
  'legislacao especial': [9, 10],
  'direito processual penal': [10, 9],
  'nocoes de direito processual penal': [10, 9],
  'processo penal': [10, 9],
  'direito civil': [8],
  'direito processual civil': [12, 560],
  'processo civil': [12, 560],
  'direito tributario': [18],
  'direito previdenciario': [19],
  'direito do trabalho': [7],
  'direito processual do trabalho': [11],
  'direitos humanos': [214, 3],
  'nocoes de direitos humanos': [214, 3],
  'legislacao institucional do estado de alagoas': [3, 2, 9],
  'legislacao institucional': [3, 2, 9],
  'legislacao estadual': [61, 3, 2],
  
  // Exatas / RLM / Estatística
  'raciocinio logico matematico': [4, 13, 39],
  'raciocinio logico e matematico': [4, 13, 39],
  'raciocinio logico': [4, 13, 39],
  'matematica': [13, 39],
  'rlm': [4, 13, 39],
  'matematica financeira': [39, 13],
  'estatistica': [40, 15],
  'nocoes de estatistica': [40, 15],
  'estatistica e analise de dados': [40, 15, 46],
  
  // Informática / TI (Taxonomia: 46=Informática, 97=Segurança, 94=SO, 93=Arquitetura, 95=Redes, 160=Programação, 98=Algoritmos, 100=Engenharia Software)
  'tecnologia da informacao e seguranca cibernetica': [46, 97, 94, 93, 95, 160, 98, 100],
  'tecnologia da informacao': [46, 97, 94, 93, 95, 160, 98, 100],
  'informatica': [46, 97, 94, 93, 95, 160, 98, 100],
  'nocoes de informatica': [46, 97, 94, 93, 95, 160, 98, 100],
  'crimes ciberneticos e seguranca digital': [9, 46, 97],
  'seguranca da informacao': [97, 46],
  'redes de computadores': [95, 94, 46],
  'banco de dados': [46, 98, 100],
  'programacao': [160, 98, 100, 46],
  
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
  'etica': [25, 2],
  'etica no servico publico': [25, 2],
  'etica na administracao publica': [25, 2],
  'contabilidade': [35, 16, 36],
  'nocoes de contabilidade': [35, 16, 36],
  'nocoes de contabilidade analise financeira e crimes contra a ordem tributaria': [35, 16, 18, 9, 36],
  'contabilidade geral': [35, 16, 36],
  'contabilidade publica': [16, 33, 35],
  'auditoria': [36, 16],
  'atualidades': [27, 56],
  'criminologia': [215, 9],
  'medicina legal': [216, 9]
};

const STOPWORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para', 'com', 'no', 'na', 
  'nos', 'nas', 'por', 'sobre', 'seus', 'suas', 'ou', 'ao', 'aos', 'que', 
  'como', 'um', 'uma', 'uns', 'umas', 'nocoes', 'conceito', 'conceitos', 
  'gerais', 'geral', 'lei', 'art', 'artigo', 'artigos', 'especie', 'especies'
]);

export function normalizeString(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stemWord(w: string): string {
  if (w.length <= 3) return w;
  const s = w;
  if (s.endsWith('oes')) return s.slice(0, -3) + 'ao';
  if (s.endsWith('ais') || s.endsWith('eis') || s.endsWith('ois')) return s.slice(0, -2) + 'l';
  if (s.endsWith('res') || s.endsWith('ses') || s.endsWith('zes')) return s.slice(0, -2);
  if (s.endsWith('mente')) return s.slice(0, -5);
  if (s.endsWith('mentos')) return s.slice(0, -6);
  if (s.endsWith('mento')) return s.slice(0, -5);
  if (s.endsWith('dades')) return s.slice(0, -5) + 'dade';
  if (s.endsWith('dade')) return s.slice(0, -4);
  if (s.endsWith('cao') && s.length > 5) return s.slice(0, -3);
  if (s.endsWith('coes') && s.length > 6) return s.slice(0, -4);
  if (s.endsWith('s') && !s.endsWith('ss')) return s.slice(0, -1);
  return s;
}

export function extractKeywords(str: string): string[] {
  const norm = normalizeString(str);
  return norm
    .split(' ')
    .filter(w => w.length > 2 && !STOPWORDS.has(w));
}

export function extractStemmedKeywords(str: string): string[] {
  return extractKeywords(str).map(stemWord);
}

export function findCandidateDisciplines(
  disciplinaNome: string,
  allDisciplines: TaxonomiaDisciplina[]
): TaxonomiaDisciplina[] {
  const normNome = normalizeString(disciplinaNome);
  if (!normNome) return [];
  
  // 1. Busca no mapa explícito exato
  let candidateIds = DEFAULT_DISCIPLINE_CANDIDATES_MAP[normNome];
  
  // 2. Busca parcial no mapa ordenando pela chave mais longa primeiro (especificidade)
  if (!candidateIds) {
    const sortedKeys = Object.keys(DEFAULT_DISCIPLINE_CANDIDATES_MAP).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
      if (normNome.includes(key) || key.includes(normNome)) {
        candidateIds = DEFAULT_DISCIPLINE_CANDIDATES_MAP[key];
        break;
      }
    }
  }

  if (candidateIds && candidateIds.length > 0) {
    const list = allDisciplines.filter(d => candidateIds!.includes(d.discipline_id));
    if (list.length > 0) return list;
  }

  // 3. Busca fuzzy pelo nome na taxonomia completa
  const directMatch = allDisciplines.filter(d => {
    const dNorm = normalizeString(d.discipline_nome);
    return dNorm === normNome || dNorm.includes(normNome) || normNome.includes(dNorm);
  });

  if (directMatch.length > 0) return directMatch;

  return [];
}

// Tabela de leis populares mais frequentes em concursos públicos
export const LEIS_POPULARES: Array<{ trigger: string; num: string; year: string }> = [
  // Direitos Humanos & Tratados
  { trigger: 'pacto de sao jose da costa rica', num: '678', year: '1992' },
  { trigger: 'pacto de sao jose', num: '678', year: '1992' },
  { trigger: 'pacto de san jose', num: '678', year: '1992' },
  { trigger: 'convencao americana sobre direitos humanos', num: '678', year: '1992' },
  { trigger: 'convencao americana de direitos humanos', num: '678', year: '1992' },
  { trigger: 'decreto 678', num: '678', year: '1992' },
  { trigger: 'convencao contra a tortura', num: '40', year: '1991' },
  { trigger: 'convencao sobre os direitos da crianca', num: '99710', year: '1990' },

  // Penal & Legislação Especial
  { trigger: 'maria da penha', num: '11340', year: '2006' },
  { trigger: 'lei de drogas', num: '11343', year: '2006' },
  { trigger: 'drogas', num: '11343', year: '2006' },
  { trigger: 'estatuto do desarmamento', num: '10826', year: '2003' },
  { trigger: 'desarmamento', num: '10826', year: '2003' },
  { trigger: 'crimes hediondos', num: '8072', year: '1990' },
  { trigger: 'tortura', num: '9455', year: '1997' },
  { trigger: 'abuso de autoridade', num: '13869', year: '2019' },
  { trigger: 'organizacoes criminosas', num: '12850', year: '2013' },
  { trigger: 'organizacao criminosa', num: '12850', year: '2013' },
  { trigger: 'crime organizado', num: '12850', year: '2013' },
  { trigger: 'interceptacao telefonica', num: '9296', year: '1996' },
  { trigger: 'lavagem de dinheiro', num: '9613', year: '1998' },
  { trigger: 'lavagem de capitais', num: '9613', year: '1998' },
  { trigger: 'juizados especiais', num: '9099', year: '1995' },
  { trigger: 'crimes de transito', num: '9503', year: '1997' },
  { trigger: 'codigo de transito brasileiro', num: '9503', year: '1997' },
  { trigger: 'crimes ambientais', num: '9605', year: '1998' },
  { trigger: 'estatuto do idoso', num: '10741', year: '2003' },
  { trigger: 'pessoa idosa', num: '10741', year: '2003' },
  { trigger: 'estatuto da pessoa idosa', num: '10741', year: '2003' },
  { trigger: 'estatuto da crianca e do adolescente', num: '8069', year: '1990' },
  { trigger: 'eca', num: '8069', year: '1990' },
  { trigger: 'racismo', num: '7716', year: '1989' },
  { trigger: 'crimes de preconceito', num: '7716', year: '1989' },
  { trigger: 'crimes contra o sistema financeiro', num: '7492', year: '1986' },
  { trigger: 'sistema financeiro nacional', num: '7492', year: '1986' },
  { trigger: 'crimes contra a ordem tributaria', num: '8137', year: '1990' },
  { trigger: 'ordem economica e tributaria', num: '8137', year: '1990' },
  { trigger: 'crimes de responsabilidade', num: '1079', year: '1950' },
  { trigger: 'prefeitos e vereadores', num: '201', year: '1967' },
  { trigger: 'execucao penal', num: '7210', year: '1984' },
  { trigger: 'lep', num: '7210', year: '1984' },
  { trigger: 'genocidio', num: '2889', year: '1956' },

  // Administrativo & Constitucional
  { trigger: 'improbidade', num: '8429', year: '1992' },
  { trigger: 'improbidade administrativa', num: '8429', year: '1992' },
  { trigger: 'nova lei de licitacoes', num: '14133', year: '2021' },
  { trigger: 'licitacoes e contratos', num: '14133', year: '2021' },
  { trigger: 'licitacoes', num: '14133', year: '2021' },
  { trigger: 'lei 8666', num: '8666', year: '1993' },
  { trigger: 'processo administrativo federal', num: '9784', year: '1999' },
  { trigger: 'processo administrativo', num: '9784', year: '1999' },
  { trigger: 'acesso a informacao', num: '12527', year: '2011' },
  { trigger: 'lai', num: '12527', year: '2011' },
  { trigger: 'servidores publicos civis da uniao', num: '8112', year: '1990' },
  { trigger: 'regime juridico unico', num: '8112', year: '1990' },
  { trigger: 'estatuto dos servidores', num: '8112', year: '1990' },
  { trigger: 'lgpd', num: '13709', year: '2018' },
  { trigger: 'protecao de dados pessoais', num: '13709', year: '2018' },
  { trigger: 'protecao de dados', num: '13709', year: '2018' },
  { trigger: 'mandado de seguranca', num: '12016', year: '2009' },
  { trigger: 'acao popular', num: '4717', year: '1965' },
  { trigger: 'acao civil publica', num: '7347', year: '1985' },
  { trigger: 'habeas data', num: '9507', year: '1997' },
  { trigger: 'concessoes e permissoes', num: '8987', year: '1995' },
  { trigger: 'servicos publicos', num: '8987', year: '1995' },
  { trigger: 'parcerias publico privadas', num: '11079', year: '2004' },
  { trigger: 'estatuto da cidade', num: '10257', year: '2001' },
  { trigger: 'estatuto da pessoa com deficiencia', num: '13146', year: '2015' },
  { trigger: 'estatuto da igualdade racial', num: '12288', year: '2010' },

  // Ética
  { trigger: 'codigo de etica profissional do servidor publico', num: '1171', year: '1994' },
  { trigger: 'codigo de etica do servidor', num: '1171', year: '1994' },
  { trigger: 'decreto 1171', num: '1171', year: '1994' },
  { trigger: 'codigo de etica funcional do servidor publico do estado de alagoas', num: '6754', year: '2006' },
  { trigger: 'lei estadual 6754', num: '6754', year: '2006' },
  { trigger: 'lei 6754', num: '6754', year: '2006' }
];

// Dicionário canônico de temas essenciais em concursos públicos
export const THEME_ALIASES_EXPANDED: Array<{ triggers: string[]; searchTerms: string[] }> = [
  // Português
  { triggers: ['reescrita de frases', 'reescrita de textos', 'reescrita de texto', 'reescritura', 'reorganizacao da estrutura de oracoes', 'substituicao de palavras ou de trechos'], searchTerms: ['Redação - Reescritura de texto', 'Reescritura de texto', 'Coesão e coerência', 'Significação Contextual de Palavras e Expressões'] },
  { triggers: ['classes de palavras', 'classes gramaticais', 'substantivo adjetivo pronome', 'morfologia', 'morfossintaxe'], searchTerms: ['Morfologia', 'Morfologia - Classes de Palavras', 'Classes de Palavras'] },
  { triggers: ['tipologia textual', 'tipos e generos textuais', 'generos textuais', 'reconhecimento de tipos e generos textuais'], searchTerms: ['Tipologia Textual', 'Gêneros Textuais', 'Interpretação de Textos'] },
  { triggers: ['coesao e coerencia', 'coesao textual', 'mecanismos de coesao', 'elementos de referenciacao', 'sequenciacao textual'], searchTerms: ['Coesão e coerência', 'Coesão e Coerência', 'Coesão Textual'] },
  { triggers: ['acentuacao grafica', 'ortografia oficial', 'dominio da ortografia oficial'], searchTerms: ['Acentuação Gráfica: Proparoxítonas, Paroxítonas, Oxítonas e Hiatos', 'Ortografia'] },
  { triggers: ['sinais de pontuacao', 'pontuacao', 'emprego dos sinais de pontuacao'], searchTerms: ['Pontuação', 'Uso da Vírgula'] },
  { triggers: ['concordancia verbal e nominal', 'concordancia verbal', 'concordancia nominal', 'dominio dos mecanismos de concordancia'], searchTerms: ['Concordância verbal, Concordância nominal', 'Concordância'] },
  { triggers: ['regencia verbal e nominal', 'regencia verbal', 'regencia nominal', 'dominio dos mecanismos de regencia'], searchTerms: ['Regência', 'Regência Verbal e Nominal'] },
  { triggers: ['sinal indicativo de crase', 'crase', 'emprego do sinal indicativo de crase'], searchTerms: ['Crase'] },
  { triggers: ['colocacao dos pronomes', 'colocacao pronominal', 'proclise mesoclise enclise', 'colocacao dos pronomes atonos'], searchTerms: ['Colocação Pronominal'] },
  { triggers: ['oracoes', 'coordenacao e subordinacao', 'termos da oracao', 'sintaxe da oracao', 'relacoes de coordenacao', 'relacoes de subordinacao'], searchTerms: ['Sintaxe', 'Termos da Oração', 'Orações coordenadas', 'Orações subordinadas'] },
  { triggers: ['manual de redacao da presidencia', 'redacao oficial', 'correspondencias oficiais'], searchTerms: ['Manual de Redação da Presidência da República', 'Redação Oficial', 'Correspondência Oficial'] },
  { triggers: ['tempos e modos verbais', 'emprego de tempos e modos verbais', 'flexao verbal', 'vozes verbais'], searchTerms: ['Morfologia - Verbos', 'Flexão verbal de tempo', 'Verbos', 'Tempos e Modos Verbais'] },
  { triggers: ['semantica', 'significacao das palavras', 'sinonimos e antonimos', 'homonimos e paronimos'], searchTerms: ['Significação Contextual de Palavras e Expressões. Sinônimos e Antônimos.', 'Semântica'] },
  { triggers: ['figuras de linguagem', 'funcoes da linguagem'], searchTerms: ['Figuras de Linguagem', 'Funções da Linguagem'] },

  // Administrativo
  { triggers: ['atos administrativos', 'requisitos atributos classificacao', 'invalidacao dos atos', 'anulacao revogacao', 'especies de atos administrativos', 'ato administrativo'], searchTerms: ['Atos Administrativos', 'Atributos do Ato Administrativo', 'Anulação, Revogação e Convalidação', 'Espécies de Atos Administrativos'] },
  { triggers: ['agentes publicos', 'servidores publicos', 'cargo emprego e funcao publica', 'disposicoes constitucionais aplicaveis aos servidores', 'agente publico'], searchTerms: ['Agentes Públicos', 'Regime dos Servidores Públicos', 'Servidores Públicos', 'Cargo, emprego, função'] },
  { triggers: ['poderes administrativos', 'poder hierarquico disciplinar', 'poder de policia', 'uso e abuso do poder', 'poder regulamentar'], searchTerms: ['Poderes da Administração', 'Poder de Polícia', 'Poder Disciplinar', 'Uso e Abuso do Poder'] },
  { triggers: ['responsabilidade civil do estado', 'responsabilidade por ato comissivo e omissao', 'requisitos excludentes e atenuantes'], searchTerms: ['Responsabilidade Civil do Estado', 'Direito de Regresso', 'Excludentes da Responsabilidade Civil'] },
  { triggers: ['servicos publicos', 'concessao permissao e autorizacao'], searchTerms: ['Serviços Públicos', 'Concessão e Permissão de Serviços Públicos'] },
  { triggers: ['controle da administracao', 'controle judicial legislativo', 'controle da administracao publica'], searchTerms: ['Controle da Administração Pública', 'Controle Judicial', 'Controle Legislativo'] },
  { triggers: ['estado governo e administracao', 'organizacao administrativa', 'centralizacao descentralizacao concentracao desconcentracao', 'administracao direta e indireta', 'autarquias fundacoes empresas publicas sociedade de economia mista'], searchTerms: ['Organização da Administração Pública', 'Administração Direta e Indireta', 'Autarquias, Fundações, Empresas Públicas e Sociedades de Economia Mista'] },
  { triggers: ['licitacoes', 'principios modalidades tipos e procedimentos', 'contratacao direta dispensa inexigibilidade'], searchTerms: ['Licitações - Lei nº 14.133 de 2021', 'Contratação Direta (Dispensa e Inexigibilidade)', 'Modalidades e Critérios de Julgamento', 'Licitações'] },

  // Constitucional
  { triggers: ['principios fundamentais', 'fundamentos da republica', 'objetivos fundamentais'], searchTerms: ['Princípios Fundamentais', 'Fundamentos da República Federativa do Brasil'] },
  { triggers: ['direitos e garantias fundamentais', 'direitos e deveres individuais', 'art 5', 'direitos individuais e coletivos'], searchTerms: ['Direitos e Deveres Individuais e Coletivos', 'Direitos Individuais e Coletivos', 'Direitos e Garantias Fundamentais'] },
  { triggers: ['remedios constitucionais', 'habeas corpus mandado de seguranca', 'mandado de injuncao', 'habeas data', 'acao popular'], searchTerms: ['Remédios Constitucionais', 'Habeas Corpus', 'Mandado de Segurança', 'Ação Popular'] },
  { triggers: ['direitos sociais', 'trabalhadores urbanos e rurais'], searchTerms: ['Direitos Sociais'] },
  { triggers: ['nacionalidade', 'brasileiros natos e naturalizados'], searchTerms: ['Nacionalidade', 'Condição Jurídica do Estrangeiro'] },
  { triggers: ['direitos politicos', 'partidos politicos'], searchTerms: ['Direitos Políticos', 'Partidos Políticos'] },
  { triggers: ['organizacao do estado', 'reparticao de competencias', 'bens da uniao', 'estados df municipios'], searchTerms: ['Organização Político-Administrativa', 'Repartição de Competências', 'Organização do Estado'] },
  { triggers: ['poder executivo', 'atribuicoes e responsabilidades do presidente'], searchTerms: ['Poder Executivo', 'Atribuições e Responsabilidades do Presidente da República'] },
  { triggers: ['poder legislativo', 'processo legislativo', 'emendas a constituicao'], searchTerms: ['Poder Legislativo', 'Processo Legislativo', 'Fiscalização Contábil, Financeira e Orçamentária'] },
  { triggers: ['poder judiciario', 'stf', 'stj', 'garantias da magistratura'], searchTerms: ['Poder Judiciário', 'Supremo Tribunal Federal - STF', 'Superior Tribunal de Justiça - STJ'] },
  { triggers: ['funcoes essenciais', 'ministerio publico defensoria', 'advocacia publica'], searchTerms: ['Funções Essenciais à Justiça', 'Ministério Público', 'Defensoria Pública', 'Advocacia Pública'] },
  { triggers: ['seguranca publica', 'art 144', 'titulo v capitulo iii da seguranca publica', 'policia civil policia militar policia federal'], searchTerms: ['Segurança Pública', 'Da Segurança Pública - Artigo 144', 'Órgãos de Segurança Pública'] },

  // Penal
  { triggers: ['aplicacao da lei penal', 'lei penal no tempo e espaco', 'tempo e lugar do crime', 'lei penal excepcional especial e temporaria', 'irretroatividade da lei penal'], searchTerms: ['Aplicação da Lei Penal', 'Lei Penal no Tempo', 'Lei Penal no Espaço', 'Princípio da Legalidade'] },
  { triggers: ['disposicoes constitucionais aplicaveis ao direito penal', 'principios constitucionais do direito penal', 'principios do direito penal'], searchTerms: ['Princípios do Direito Penal', 'Aplicação da Lei Penal', 'Princípios Fundamentais'] },
  { triggers: ['teoria do crime', 'fato tipico conduta dolo culpa', 'erro de tipo e erro de proibicao'], searchTerms: ['Teoria do Crime', 'Fato Típico', 'Tipicidade', 'Dolo e Culpa'] },
  { triggers: ['excludentes de ilicitude', 'antijuridicidade', 'legitima defesa estado de necessidade', 'estrito cumprimento do dever legal', 'exercicio regular de direito'], searchTerms: ['Ilicitude', 'Excludentes de Ilicitude', 'Legítima Defesa', 'Estado de Necessidade'] },
  { triggers: ['culpabilidade', 'imputabilidade potencial consciencia', 'exigibilidade de conduta diversa'], searchTerms: ['Culpabilidade', 'Imputabilidade', 'Inimputabilidade'] },
  { triggers: ['crimes contra a pessoa', 'homicidio lesao corporal', 'crimes contra a vida', 'crimes contra a honra', 'calunia difamacao injuria'], searchTerms: ['Crimes contra a Pessoa', 'Homicídio', 'Lesão Corporal', 'Crimes Contra a Honra'] },
  { triggers: ['crimes contra o patrimonio', 'furto roubo estelionato', 'extorsao', 'apropriacao indebita', 'receptacao'], searchTerms: ['Crimes contra o Patrimônio', 'Furto', 'Roubo', 'Estelionato e Outras Fraudes'] },
  { triggers: ['crimes contra a administracao publica', 'peculato concussao corrupcao', 'prevaricacao', 'crimes praticados por funcionario publico', 'crimes praticados por particular'], searchTerms: ['Crimes Contra a Administração Pública', 'Crimes Praticados por Funcionário Público contra a Administração em Geral', 'Peculato', 'Corrupção Passiva e Ativa', 'Concussão'] },
  { triggers: ['crimes contra a dignidade sexual', 'estupro'], searchTerms: ['Crimes contra a Dignidade Sexual', 'Estupro'] },
  { triggers: ['crimes contra a fe publica', 'moeda falsa', 'falsidade ideologica'], searchTerms: ['Crimes contra a Fé Pública', 'Falsidade Ideológica', 'Falsificação de Documento Público'] },
  { triggers: ['concurso de pessoas', 'coautoria participacao'], searchTerms: ['Concurso de Pessoas', 'Coautoria e Participação'] },
  { triggers: ['concurso de crimes', 'concurso material formal crime continuado'], searchTerms: ['Concurso de Crimes', 'Concurso Material', 'Concurso Formal'] },

  // Processo Penal
  { triggers: ['inquerito policial', 'notitia criminis delatio criminis', 'formas de instauracao', 'indiciamento garantias do investigado', 'conclusao do inquerito'], searchTerms: ['Inquérito Policial', 'Características do Inquérito Policial', 'Instauração e Trancamento do Inquérito'] },
  { triggers: ['acao penal', 'acao penal publica incondicionada condicionada', 'acao penal privada'], searchTerms: ['Ação Penal', 'Ação Penal Pública', 'Ação Penal Privada'] },
  { triggers: ['provas exame corpo delito', 'pericias em geral', 'busca e apreensao', 'confissao testemunhas'], searchTerms: ['Provas', 'Teoria Geral da Prova', 'Exame do Corpo de Delito e Perícias em Geral', 'Da Busca e da Apreensão'] },
  { triggers: ['prisao e liberdade provisoria', 'prisao em flagrante', 'relaxamento de prisao', 'fianca'], searchTerms: ['Prisão e Liberdade Provisória', 'Prisão em Flagrante', 'Liberdade Provisória e Fiança'] },
  { triggers: ['prisao preventiva', 'prisao temporaria', 'medidas cautelares diversas da prisao'], searchTerms: ['Prisão Preventiva', 'Prisão Temporária', 'Medidas Cautelares Diversas da Prisão'] },
  { triggers: ['jurisdicao e competencia', 'competencia territorial conexao continencia'], searchTerms: ['Jurisdição e Competência', 'Competência pelo Lugar da Infração', 'Conexão e Continência'] },
  { triggers: ['sujeitos processuais', 'juiz ministerio publico acusado defensor'], searchTerms: ['Sujeitos do Processo', 'Juiz, Ministério Público, Acusado e Defensor'] },
  { triggers: ['processo e procedimento', 'procedimento comum ordinario sumario sumarissimo'], searchTerms: ['Procedimento Comum', 'Procedimento Ordinário', 'Procedimento do Júri'] },
  { triggers: ['recursos no processo penal', 'apelacao rexp rese habeas corpus'], searchTerms: ['Recursos no Processo Penal', 'Recurso em Sentido Estrito - RESE', 'Apelação'] },

  // Informática & TI (Cloud, Segurança, Redes, Bancos de Dados, Programação)
  { triggers: ['edicao de textos planilhas e apresentacoes', 'pacotes microsoft office', 'microsoft office', 'word excel powerpoint', 'pacote office', 'suites de escritorio'], searchTerms: ['Pacote de Aplicativos: Microsoft Office, BrOffice, OpenOffice e LibreOffice', 'Microsoft Word', 'Microsoft Excel', 'Editor de Textos - Microsoft Word e BrOffice.org Writer'] },
  { triggers: ['linguagem de programacao', 'linguagens de programacao', 'java python apex e c', 'java', 'python', 'desenvolvimento de software'], searchTerms: ['Java', 'Python', 'Lógicas de Programação', 'Linguagens de Programação para Engenharia de Automação', 'Desenvolvimento de Software'] },
  { triggers: ['gestao de identidades e acesso', 'autenticacao autorizacao sso saml oauth2 openid connect', 'sso saml oauth2', 'autenticacao e autorizacao'], searchTerms: ['Autenticação', 'Controles de segurança', 'Segurança da Informação', 'Conceitos Básicos em Segurança da Informação'] },
  { triggers: ['principais tipos de ataques e vulnerabilidades', 'ataques e vulnerabilidades', 'tipos de ataques'], searchTerms: ['Ataques e ameaças', 'Ataques', 'Malware', 'Análise de Vulnerabilidade e Gestão de Riscos'] },
  { triggers: ['controles e testes de seguranca para aplicacoes web', 'aplicacoes web e web services', 'seguranca para aplicacoes web'], searchTerms: ['Segurança na Internet', 'Controles de segurança', 'Segurança de sistemas de informação'] },
  { triggers: ['fundamentos de seguranca da informacao', 'confidencialidade integridade disponibilidade', 'principios de seguranca'], searchTerms: ['Princípios de Segurança, Confidencialidade e Assinatura Digital', 'Conceitos Básicos em Segurança da Informação', 'Segurança da Informação'] },
  { triggers: ['gestao de riscos e conformidade', 'avaliacao de riscos politicas de seguranca conformidade', 'gestao de riscos'], searchTerms: ['Análise de Vulnerabilidade e Gestão de Riscos', 'Políticas de Segurança de Informação', 'Norma 27005'] },
  { triggers: ['seguranca de rede', 'firewalls ids ips vpns e segmentacao de rede'], searchTerms: ['Firewall em Segurança da Informação', 'VPN (Virtual Private Network)', 'Sistemas de Prevenção-Detecção de Intrusão', 'Redes de Computadores'] },
  { triggers: ['servicos publicos digitais e inteligencia artificial', 'inteligencia artificial'], searchTerms: ['Inteligência Artificial e Automação'] },
  { triggers: ['computacao em nuvem', 'computacao na nuvem', 'cloud computing', 'saas paas iaas', 'seguranca em nuvens e de conteineres', 'seguranca em nuvem'], searchTerms: ['Nuvem ("cloud computing" e "cloud storage")', 'Computação em Nuvem - Cloud Computing', 'Segurança na Internet'] },
  { triggers: ['seguranca da informacao', 'solucoes para seguranca da informacao', 'firewall ids ips siem proxy iam pam antivirus antispam'], searchTerms: ['Segurança da Informação', 'Ferramentas de Segurança (antivírus, firewall e outros)', 'Firewall em Segurança da Informação'] },
  { triggers: ['frameworks de seguranca', 'mitre cis controls e nist csf', 'mitre cis nist', 'tratamento de incidentes ciberneticos'], searchTerms: ['Segurança da Informação', 'Políticas de Segurança de Informação', 'Norma ISO 27001'] },
  { triggers: ['assinatura e certificacao digital', 'criptografia e protecao de dados em transito e em repouso', 'criptografia simetrica e assimetrica', 'pki icp brasil', 'criptografia'], searchTerms: ['Criptografia', 'Certificação Digital em Segurança da Informação', 'Princípios de Segurança, Confidencialidade e Assinatura Digital', 'Assinatura Digital'] },
  { triggers: ['redes de computadores', 'protocolos tcp ip', 'modelo osi', 'enderecamento ip ipv4 ipv6', 'roteamento switches'], searchTerms: ['Redes de Computadores', 'Protocolo e Serviço', 'Internet'] },
  { triggers: ['internet e intranet', 'navegadores ferramentas busca', 'edge chrome firefox', 'programas de navegacao'], searchTerms: ['Navegadores (Browser)', 'Google Chrome', 'Edge', 'Internet'] },
  { triggers: ['programas de correio eletronico', 'microsoft outlook', 'cliente de e mail'], searchTerms: ['Correio Eletrônico (cliente de e-mail e webmail)', 'Microsoft Outlook'] },
  { triggers: ['sitios de busca e pesquisa na internet', 'sitios de busca'], searchTerms: ['Sítios de busca e pesquisa na Internet'] },
  { triggers: ['conceitos de organizacao e de gerenciamento de informacoes arquivos pastas e programas'], searchTerms: ['Windows Explorer - conceitos de organização de pastas e arquivos', 'Hardware - Dispositivos de Armazenamento, Memórias e Periféricos'] },
  { triggers: ['malwares', 'virus vermes worms trojans ransomware phishing botnets', 'procedimentos de seguranca virus worms'], searchTerms: ['Malware (vírus, worms e pragas virtuais)', 'Ferramentas de Segurança (antivírus, firewall e outros)'] },
  { triggers: ['backup e recuperacao', 'backup completo incremental diferencial'], searchTerms: ['Procedimento de Segurança e Back up', 'Backup em Segurança da Informação'] },
  { triggers: ['banco de dados', 'sgbd relacional', 'sql ddl dml', 'modelagem entidade relacionamento', 'organizacao de arquivos metodos de acesso'], searchTerms: ['Banco de Dados'] },
  { triggers: ['sistemas operacionais', 'linux e windows', 'comandos linux', 'permissoes de arquivos', 'nocoes de sistema operacional'], searchTerms: ['Sistema Operacional', 'Windows', 'Sistema Operacional Linux em Noções de Informática'] },
  { triggers: ['engenharia de software', 'metodologias ageis scrum kanban', 'devops git ci cd'], searchTerms: ['Engenharia de Software', 'Conceitos Básicos em Engenharia de Software'] },
  { triggers: ['governanca de ti', 'itil v3 v4 cobit', 'gestao estrategica de ti'], searchTerms: ['Governança de TI', 'ITIL', 'COBIT'] },

  // Direitos Humanos
  { triggers: ['teoria geral dos direitos humanos', 'conceitos terminologia estrutura normativa fundamentacao', 'afirmacao historica dos direitos humanos', 'conceito e evolucao historica'], searchTerms: ['Teoria Geral dos Direitos Humanos', 'Conceito e Evolução Histórica dos Direitos Humanos', 'Incorporação de tratados internacionais de direitos humanos no direito brasileiro'] },
  { triggers: ['direitos humanos e responsabilidade do estado', 'responsabilidade do estado'], searchTerms: ['Responsabilidade do Estado e Direitos Humanos', 'Direitos Humanos e a Responsabilidade do Estado', 'Teoria Geral dos Direitos Humanos'] },
  { triggers: ['direitos humanos na constituicao federal', 'constituicao federal de 1988 direitos humanos'], searchTerms: ['Direitos Humanos na Constituição Federal', 'Direitos e Garantias Fundamentais'] },
  { triggers: ['politica nacional de direitos humanos', 'programa nacional de direitos humanos', 'pndh'], searchTerms: ['Programa Nacional de Direitos Humanos - PNDH', 'Política Nacional de Direitos Humanos', 'Ministério dos Direitos Humanos e da Cidadania'] },
  { triggers: ['tratados internacionais', 'a constituicao brasileira e os tratados internacionais de direitos humanos', 'incorporacao de tratados'], searchTerms: ['Incorporação de tratados internacionais de direitos humanos no direito brasileiro (EC n.º 45)', 'Tratados Internacionais de Direitos Humanos'] },
  { triggers: ['pacto de sao jose da costa rica', 'pacto de san jose', 'decreto 678 1992', 'convencao americana sobre direitos humanos', 'comissao e corte interamericana'], searchTerms: ['Convenção Americana sobre Direitos Humanos (Pacto de San José)', 'Incorporação de tratados internacionais de direitos humanos no direito brasileiro (EC n.º 45)'] },
  { triggers: ['declaracao universal dos direitos humanos', 'dudh de 1948'], searchTerms: ['Declaração Universal dos Direitos Humanos - DUDH'] },

  // Ética no Serviço Público
  { triggers: ['etica e moral', 'etica principios e valores', 'distincao entre etica e moral'], searchTerms: ['Introdução, Ética e Moral e Orientações Gerais'] },
  { triggers: ['etica e democracia', 'exercicio da cidadania', 'etica e funcao publica', 'etica e democracia exercicio da cidadania'], searchTerms: ['Introdução, Ética e Moral e Orientações Gerais', 'Código de Ética Profissional do Servidor Público Civil do Poder Executivo Federal - Decreto nº 1.171 de 1994'] },
  { triggers: ['codigo de etica funcional', 'legislacao de etica', 'comissao de etica'], searchTerms: ['Código de Ética Profissional do Servidor Público Civil do Poder Executivo Federal - Decreto nº 1.171 de 1994', 'Introdução, Ética e Moral e Orientações Gerais'] },

  // Raciocínio Lógico e Matemático
  { triggers: ['principios de contagem', 'analise combinatoria', 'arranjo combinacao permutacao', 'probabilidade', 'principios de contagem e probabilidade'], searchTerms: ['Análise Combinatória em Matemática', 'Análise Combinatória em Raciocínio Lógico', 'Probabilidade'] },
  { triggers: ['razoes e proporcoes', 'razao e proporcao', 'regras de tres simples e composta', 'regra de tres simples', 'regra de tres', 'porcentagens', 'porcentagem', 'numeros proporcionais'], searchTerms: ['Razão e Proporção; e Números Proporcionais', 'Regra de Três', 'Porcentagem'] },
  { triggers: ['equacoes de 1 e de 2 graus', 'equacoes de primeiro e segundo grau', 'sistemas de equacoes', 'equacoes de 1', 'equacoes de 2'], searchTerms: ['Função de 1º Grau ou Função Afim, Problemas com Equação e Inequações', 'Função de 2º Grau ou Função Quadrática e Inequações', 'Funções'] },
  { triggers: ['sequencias numericas', 'padroes em sequencias'], searchTerms: ['Sequências Lógicas de Números, Letras, Palavras e Figuras', 'Raciocínio Matemático'] },
  { triggers: ['progressoes aritmeticas e geometricas', 'progressao aritmetica', 'progressao geometrica', 'pa e pg'], searchTerms: ['Progressões', 'Progressão Aritmética - PA', 'Progressão Geométrica - PG'] },
  { triggers: ['funcoes e graficos', 'funcao afim quadratica', 'funcoes'], searchTerms: ['Funções', 'Análise de Tabelas e Gráficos'] },
  { triggers: ['estruturas logicas', 'logica de argumentacao', 'analogias inferencias deducoes e conclusoes'], searchTerms: ['Lógica de Argumentação - Diagramas e Operadores Lógicos', 'Fundamentos de Lógica'] },
  { triggers: ['logica sentencial ou proposicional', 'logica sentencial', 'proposicoes simples e compostas', 'tabelas verdade', 'tabela verdade'], searchTerms: ['Proposições Simples e Compostas e Operadores Lógicos', 'Tabelas-Verdade', 'Fundamentos de Lógica'] },
  { triggers: ['equivalencias e leis de de morgan', 'equivalencias logicas', 'negacao de proposicoes'], searchTerms: ['Equivalência Lógica e Negação de Proposições', 'Negação - Leis de Morgan (Negativa de uma Proposição Composta)', 'Equivalências - Proposições Logicamente Equivalentes'] },
  { triggers: ['diagramas logicos', 'quantificadores todo algum nenhum'], searchTerms: ['Lógica de Argumentação - Diagramas e Operadores Lógicos', 'Diagramas de Venn (Conjuntos)'] },
  { triggers: ['logica de primeira ordem', 'calculo de predicados'], searchTerms: ['Quantificadores', 'Lógica de Argumentação - Diagramas e Operadores Lógicos'] },
  { triggers: ['operacoes com conjuntos', 'uniao intersecao diferenca complementar', 'diagramas de venn'], searchTerms: ['Diagramas de Venn (Conjuntos)', 'Teoria dos Conjuntos'] },
  { triggers: ['problemas aritmeticos geometricos e matriciais', 'raciocinio logico envolvendo problemas'], searchTerms: ['Raciocínio Matemático', 'Matrizes, Determinantes e Sistemas Lineares', 'Geometria Básica'] },

  // Estatística e Análise de Dados
  { triggers: ['variaveis aleatorias discretas', 'variavel aleatoria discreta'], searchTerms: ['Variável aleatória discreta'] },
  { triggers: ['variaveis aleatorias continuas', 'variavel aleatoria continua'], searchTerms: ['Variável aleatória contínua'] },
  { triggers: ['funcao de probabilidade', 'densidade de probabilidade', 'funcoes de probabilidade'], searchTerms: ['Funções de Probabilidade p(x) e Densidade f(x)'] },
  { triggers: ['funcao de distribuicao acumulada', 'distribuicao acumulada'], searchTerms: ['Função de distribuição acumulada F(x)'] },
  { triggers: ['esperanca e momentos', 'esperanca matematica', 'momentos e funcao geratriz', 'funcao geratriz de momentos', 'esperanca', 'momentos'], searchTerms: ['Momentos e Função geratriz de momentos de uma variável aleatória'] },
  { triggers: ['variavel aleatoria multidimensional', 'vetores aleatorios'], searchTerms: ['Variável aleatória multidimensional'] },
  { triggers: ['desigualdades estatisticas', 'markov tchebycheff bernoulli'], searchTerms: ['Desigualdades estatísticas (Markov, Tchebycheff, Bernoulli)'] },
  { triggers: ['teorema central do limite', 'lei dos grandes numeros'], searchTerms: ['Teorema Central do Limite'] },
  { triggers: ['calculo de probabilidades', 'probabilidade e probabilidade condicional', 'definicoes axiomas', 'teorema da probabilidade total', 'probabilidade'], searchTerms: ['Cálculo de Probabilidades', 'Probabilidade'] },
  { triggers: ['probabilidade condicional', 'regra de bayes', 'teorema de bayes', 'independencia'], searchTerms: ['Probabilidade condicional, Teorema de Bayes e independência'] },
  { triggers: ['estatistica descritiva', 'analise exploratoria de dados'], searchTerms: ['Estatística descritiva (análise exploratória de dados)'] },
  { triggers: ['tipos de variaveis'], searchTerms: ['Tipos de variáveis'] },
  { triggers: ['distribuicoes de frequencia', 'distribuicao de frequencias', 'tabelas de frequencia'], searchTerms: ['Distribuições de frequência'] },
  { triggers: ['graficos estatisticos', 'histograma', 'boxplot', 'poligono de frequencias'], searchTerms: ['Gráficos estatísticos - Barras ou Colunas e Histograma', 'Esquema de Cinco Números e Boxplot'] },
  { triggers: ['medidas de posicao', 'tendencia central', 'media mediana e moda', 'media mediana moda'], searchTerms: ['Medidas de Posição - Tendência Central (Media, Mediana e Moda)'] },
  { triggers: ['medidas de dispersao', 'variancia', 'desvio padrao', 'coeficiente de variacao'], searchTerms: ['Medidas de Dispersão (Amplitude, Desvio Médio, Variância, Desvio Padrão e Coeficiente de Variação)'] },
  { triggers: ['separatrizes', 'quartis decis e percentis', 'quartis'], searchTerms: ['Medidas de Posição - Separatrizes (Quartis, Decis e Percentis)'] },
  { triggers: ['assimetria e curtose', 'coeficiente de assimetria'], searchTerms: ['Assimetria e Curtose'] },
  { triggers: ['covariancia correlacao', 'coeficiente de correlacao'], searchTerms: ['Covariância, Correlação'] },
  { triggers: ['numeros indices'], searchTerms: ['Números-índices'] },
  { triggers: ['inferencia estatistica'], searchTerms: ['Inferência estatística'] },
  { triggers: ['estimacao pontual', 'propriedades dos estimadores', 'estimadores'], searchTerms: ['Estimação pontual', 'Propriedades dos estimadores'] },
  { triggers: ['maxima verossimilhanca', 'metodo dos momentos'], searchTerms: ['Estimativa de Máxima Verossimilhança', 'Métodos de estimação'] },
  { triggers: ['intervalos de confianca', 'intervalo de confianca'], searchTerms: ['Intervalos de confiança'] },
  { triggers: ['testes de hipoteses', 'teste de hipoteses', 'nivel de significancia', 'p valor'], searchTerms: ['Testes de hipóteses', 'Testes de hipóteses para os parâmetros'] },
  { triggers: ['inferencia bayesiana'], searchTerms: ['Inferência Bayesiana'] },
  { triggers: ['testes de aderencia', 'tabelas de contingencia', 'qui quadrado'], searchTerms: ['Testes  de aderência e Tabelas de contingência: Testes de independência e homogeneidade'] },
  { triggers: ['principais distribuicoes de probabilidade', 'distribuicao binomial', 'binomial'], searchTerms: ['Distribuição  Binomial', 'Principais distribuições de probabilidade'] },
  { triggers: ['distribuicao poisson', 'poisson'], searchTerms: ['Distribuição Poisson'] },
  { triggers: ['distribuicao geometrica', 'geometrica'], searchTerms: ['Distribuição Geométrica'] },
  { triggers: ['distribuicao hipergeometrica'], searchTerms: ['Distribuição Hipergeométrica'] },
  { triggers: ['distribuicao uniforme'], searchTerms: ['Distribuição Uniforme'] },
  { triggers: ['distribuicao exponencial'], searchTerms: ['Distribuição exponencial'] },
  { triggers: ['distribuicao normal', 'normal padrao', 'gaussiana'], searchTerms: ['Distribuição Normal'] },
  { triggers: ['distribuicao t de student', 't de student'], searchTerms: ['Distribuição t de student'] },
  { triggers: ['distribuicao f de snedecor', 'f de snedecor'], searchTerms: ['Distribuição F de Snedecor'] },
  { triggers: ['distribuicao qui quadrado'], searchTerms: ['Distribuição qui-quadrado'] },
  { triggers: ['amostragem aleatoria simples', 'amostragem simples'], searchTerms: ['Amostragem aleatória simples'] },
  { triggers: ['amostragem estratificada'], searchTerms: ['Amostragem estratificada'] },
  { triggers: ['amostragem sistematica'], searchTerms: ['Amostragem sistemática'] },
  { triggers: ['amostragem por conglomerados', 'amostragem de conglomerados'], searchTerms: ['Amostragem de conglomerados'] },
  { triggers: ['tamanho da amostra', 'dimensionamento amostral'], searchTerms: ['Tamanho da amostra'] },
  { triggers: ['amostragem'], searchTerms: ['Amostragem'] },
  { triggers: ['regressao linear simples', 'regressao linear multipla', 'regressao linear', 'modelos lineares'], searchTerms: ['Regressão Linear', 'Modelos lineares'] },
  { triggers: ['analise de variancia', 'anova'], searchTerms: ['Análise de variância'] },
  { triggers: ['analise dos residuos', 'residuos'], searchTerms: ['Análise dos resíduos'] },
  { triggers: ['series temporais', 'analise de series temporais'], searchTerms: ['Análise de séries temporais'] },
  { triggers: ['analise multivariada', 'componentes principais', 'analise fatorial', 'analise de cluster'], searchTerms: ['Análise Multivariada', 'Componentes principais', 'Análise Fatorial', 'Análise de Cluster'] },
  { triggers: ['estatistica nao parametrica', 'testes nao parametricos'], searchTerms: ['Estatística não paramétrica'] },

  // AFO & Contabilidade
  { triggers: ['orcamento publico', 'conceitos basicos dimensoes natureza juridica', 'principios orcamentarios', 'loa ldo ppa'], searchTerms: ['Orçamento Público em AFO', 'Princípios Orçamentários', 'Instrumentos de Planejamento (PPA, LDO e LOA)'] },
  { triggers: ['receita publica', 'classificacao estagios da receita'], searchTerms: ['Receita Pública', 'Classificação da Receita Pública', 'Estágios da Receita'] },
  { triggers: ['despesa publica', 'classificacao estagios da despesa', 'empenho liquidacao pagamento', 'restos a pagar'], searchTerms: ['Despesa Pública', 'Classificação da Despesa Pública', 'Estágios da Despesa', 'Restos a Pagar'] },
  { triggers: ['lei de responsabilidade fiscal', 'lrf', 'lei complementar 101'], searchTerms: ['Lei de Responsabilidade Fiscal - LRF (LC 101/2000)'] }
];

interface LawMatchResult {
  match: QConcursosFiltro | null;
  suggestions: QConcursosFiltro[];
}

// CAMADA 1: Match por Lei / Decreto / Norma Legal com Score Contextual
export function matchLawAdvanced(
  topicName: string,
  candidateDisciplines: TaxonomiaDisciplina[],
  allDisciplines: TaxonomiaDisciplina[],
  editalDisciplinaNome: string
): LawMatchResult {
  let rawNum: string | null = null;
  let year: string | null = null;

  // Regex para capturar formatos como "Lei 14.133/2021", "Decreto nº 678/1992", "Lei Estadual 6.754/2006", "13.709/2018"
  const lawRegex = /(?:(?:decreto-lei|decreto|lei(?:\s+estadual|\s+federal)?)\s*(?:n[oº]|nº)?\s*)?(\d{1,2}(?:[\.\s]\d{3})*|\d{3,5})(?:\/|\s*de\s*|\s*[-–]\s*)(\d{4})/i;
  const match = topicName.match(lawRegex);

  if (match) {
    rawNum = match[1];
    year = match[2];
  } else {
    // Busca na tabela de leis populares
    const normTopic = ` ${normalizeString(topicName)} `;
    for (const item of LEIS_POPULARES) {
      const triggerNorm = ` ${normalizeString(item.trigger)} `;
      if (normTopic.includes(triggerNorm)) {
        rawNum = item.num;
        year = item.year;
        break;
      }
    }
  }

  if (!rawNum || !year) {
    return { match: null, suggestions: [] };
  }

  const cleanNum = rawNum.replace(/[\.\s]/g, '');
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

  for (const disc of allDisciplines) {
    for (const subj of disc.subjects) {
      const subjNome = subj.nome;
      const snorm = normalizeString(subjNome);
      const hasYear = subjNome.includes(year);
      const hasNum = subjNome.includes(rawNum) || subjNome.replace(/[\.\s]/g, '').includes(cleanNum);

      // Tratamento especial para tratados históricos com numeração específica (ex: Decreto 678 de 1992 = Pacto de San José)
      const isSanJoseMatch = (cleanNum === '678' || rawNum === '678') && (snorm.includes('san jose') || snorm.includes('sao jose') || snorm.includes('convencao americana'));

      if ((hasNum && hasYear) || isSanJoseMatch) {
        let score = 0;

        // Bônus principal: Disciplina compatível com o edital
        if (candidateDiscIdSet.has(disc.discipline_id)) {
          score += 25;
        }

        // Bônus contextual: Palavras em comum entre assunto e edital
        const subjKeywords = extractKeywords(subjNome);
        const discKeywords = extractKeywords(disc.discipline_nome);
        for (const w of [...subjKeywords, ...discKeywords]) {
          if (contextWords.has(w)) score += 4;
        }

        // Bônus para assuntos raiz/gerais
        const isRootOrBroad = !subjNome.toLowerCase().includes('art.') && !subjNome.toLowerCase().includes('artigo');
        if (isRootOrBroad) score += 5;

        // Bônus se contiver termos exatos do tópico
        const normTopic = normalizeString(topicName);
        if (normTopic.includes(snorm) || snorm.includes(normTopic)) {
          score += 15;
        }

        matchedSubjects.push({
          disciplineId: disc.discipline_id,
          disciplineNome: disc.discipline_nome,
          subjectId: subj.id,
          subjectNome: subj.nome,
          score
        });
      }
    }
  }

  if (matchedSubjects.length === 0) {
    return { match: null, suggestions: [] };
  }

  matchedSubjects.sort((a, b) => b.score - a.score);
  const best = matchedSubjects[0];
  const candidatesAsFilters: QConcursosFiltro[] = matchedSubjects.slice(0, 5).map(m => ({
    disciplinaId: String(m.disciplineId),
    assuntoId: String(m.subjectId),
    disciplinaNome: m.disciplineNome,
    assuntoNome: m.subjectNome
  }));

  return {
    match: {
      disciplinaId: String(best.disciplineId),
      assuntoId: String(best.subjectId),
      disciplinaNome: best.disciplineNome,
      assuntoNome: best.subjectNome
    },
    suggestions: candidatesAsFilters
  };
}

// CAMADA 2: Match por Tema Canônico (Dicionário de Alta Confiança) com Agrupamento Multi-Assuntos
// RESTRITO ESTRITAMENTE às disciplinas candidatas da matéria do edital
export function matchThemeAlias(
  topicName: string,
  candidateDisciplines: TaxonomiaDisciplina[]
): QConcursosFiltro | null {
  if (!candidateDisciplines || candidateDisciplines.length === 0) return null;
  const normTopic = normalizeString(topicName);

  // Decompõe em cláusulas / subtópicos
  const rawParts = topicName.split(/[;:\.]/).map(s => s.trim()).filter(Boolean);
  const topicParts = [normTopic];
  for (const p of rawParts) {
    const np = normalizeString(p);
    if (np.length > 2) topicParts.push(np);
    // Expande "A e B" (ex: discretas e contínuas -> variáveis discretas, variáveis contínuas)
    if (p.includes(' e ') || p.includes(' ou ')) {
      const m = p.match(/(.+?)\s+([a-zA-Záéíóúâêîôûãõç]+)\s+(?:e|ou)\s+([a-zA-Záéíóúâêîôûãõç]+)$/i);
      if (m) {
        topicParts.push(normalizeString(`${m[1]} ${m[2]}`));
        topicParts.push(normalizeString(`${m[1]} ${m[3]}`));
      }
    }
  }

  const matchedSubjsMap = new Map<number, { disc: TaxonomiaDisciplina; subj: TaxonomiaDisciplina['subjects'][0] }>();

  for (const part of topicParts) {
    for (const alias of THEME_ALIASES_EXPANDED) {
      const hitsTrigger = alias.triggers.some(tr => {
        const ntr = normalizeString(tr);
        return part.includes(ntr) || ntr.includes(part);
      });
      if (!hitsTrigger) continue;

      // Buscar termos EXCLUSIVAMENTE nas disciplinas candidatas da matéria
      for (const term of alias.searchTerms) {
        const normTerm = normalizeString(term);
        for (const disc of candidateDisciplines) {
          for (const subj of disc.subjects) {
            const normSubj = normalizeString(subj.nome);
            if (normSubj === normTerm || normSubj.includes(normTerm) || normTerm.includes(normSubj)) {
              matchedSubjsMap.set(subj.id, { disc, subj });
            }
          }
        }
      }
    }
  }

  if (matchedSubjsMap.size === 0) return null;

  const matches = Array.from(matchedSubjsMap.values());
  // Agrupa pela disciplina com mais ocorrências
  const discCount = new Map<number, number>();
  for (const m of matches) {
    discCount.set(m.disc.discipline_id, (discCount.get(m.disc.discipline_id) || 0) + 1);
  }
  let bestDiscId = matches[0].disc.discipline_id;
  let maxCount = 0;
  for (const [did, count] of discCount.entries()) {
    if (count > maxCount) {
      maxCount = count;
      bestDiscId = did;
    }
  }

  const discMatches = matches.filter(m => m.disc.discipline_id === bestDiscId);
  const primaryDisc = discMatches[0].disc;
  const subjIds = discMatches.map(m => String(m.subj.id));
  const subjNomes = discMatches.map(m => m.subj.nome).join(' + ');

  return {
    disciplinaId: String(primaryDisc.discipline_id),
    assuntoId: subjIds[0],
    assuntoIds: subjIds.length > 1 ? subjIds : undefined,
    disciplinaNome: primaryDisc.discipline_nome,
    assuntoNome: subjNomes
  };
}

// CAMADA 3: Match por Cobertura de Conceito com PALAVRA INTEIRA e Segmentação Temática
// RESTRITO ESTRITAMENTE às disciplinas candidatas da matéria do edital
export function matchAsymmetricConcept(
  topicName: string,
  candidateDisciplines: TaxonomiaDisciplina[]
): QConcursosFiltro | null {
  if (!candidateDisciplines || candidateDisciplines.length === 0) return null;

  const segments = topicName.split(/[:;\-–]/).map(s => s.trim()).filter(Boolean);
  const headTopic = segments[0] || topicName;
  const headKeywords = extractKeywords(headTopic);
  const fullKeywords = extractKeywords(topicName);
  const stemmedFull = extractStemmedKeywords(topicName);

  if (fullKeywords.length === 0) return null;

  let bestMatch: {
    disciplineId: number;
    disciplineNome: string;
    subjectId: number;
    subjectNome: string;
    score: number;
  } | null = null;
  let bestScore = 0;

  for (const disc of candidateDisciplines) {
    for (const subj of disc.subjects) {
      const subjKeywords = extractKeywords(subj.nome);
      const stemmedSubj = extractStemmedKeywords(subj.nome);
      if (subjKeywords.length === 0) continue;

      // Correspondência ESTRITA de PALAVRA INTEIRA (token a token, normalizado sem acento)
      let headMatches = 0;
      for (const w of headKeywords) {
        if (subjKeywords.some(sk => sk === w)) headMatches++;
      }

      let fullMatches = 0;
      for (const w of fullKeywords) {
        if (subjKeywords.some(sk => sk === w)) fullMatches++;
      }

      let stemmedMatches = 0;
      for (const sw of stemmedFull) {
        if (stemmedSubj.some(sk => sk === sw)) stemmedMatches++;
      }

      // Avaliação de subsegmentos (quando o edital traz "Prefixo: Subtópico")
      let maxSegmentScore = 0;
      if (segments.length > 1) {
        for (let i = 1; i < segments.length; i++) {
          const segKeywords = extractKeywords(segments[i]);
          if (segKeywords.length === 0) continue;
          let segMatches = 0;
          for (const w of segKeywords) {
            if (subjKeywords.some(sk => sk === w)) segMatches++;
          }
          const segCov = segMatches / segKeywords.length;
          if (segCov > maxSegmentScore) maxSegmentScore = segCov;
        }
      }

      if (headMatches === 0 && fullMatches === 0 && stemmedMatches === 0) continue;

      const headCoverage = headKeywords.length > 0 ? (headMatches / headKeywords.length) : 0;
      const subjCoverage = fullMatches / subjKeywords.length;
      const stemmedSubjCoverage = stemmedMatches / stemmedSubj.length;
      
      const score = Math.max(
        (headCoverage * 0.4) + (subjCoverage * 0.6),
        (stemmedSubjCoverage * 0.8),
        (maxSegmentScore * 0.9)
      );

      if (score > bestScore) {
        bestScore = score;
        bestMatch = {
          disciplineId: disc.discipline_id,
          disciplineNome: disc.discipline_nome,
          subjectId: subj.id,
          subjectNome: subj.nome,
          score
        };
      }
    }
  }

  if (bestMatch && bestScore >= 0.40) {
    return {
      disciplinaId: String(bestMatch.disciplineId),
      assuntoId: String(bestMatch.subjectId),
      disciplinaNome: bestMatch.disciplineNome,
      assuntoNome: bestMatch.subjectNome
    };
  }

  return null;
}

// CAMADA 4: Match Determinístico por Interseção de PALAVRA INTEIRA
// RESTRITO ESTRITAMENTE às disciplinas candidatas da matéria do edital
export function matchKeywords(
  topicName: string,
  candidateDisciplines: TaxonomiaDisciplina[]
): QConcursosFiltro | null {
  if (!candidateDisciplines || candidateDisciplines.length === 0) return null;

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

      // Correspondência ESTRITA de PALAVRA INTEIRA (token a token, normalizado)
      // NUNCA substring, NUNCA prefixo de 4 letras!
      let intersection = 0;
      for (const kw of topicKeywords) {
        if (subjKeywords.some(sk => sk === kw)) {
          intersection++;
        }
      }

      if (intersection === 0) continue;

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

// Seleciona os assuntos mais semanticamente promissores da disciplina candidata para grounding da IA
function selectTopSubjectsForTopic(
  topicName: string,
  candidates: TaxonomiaDisciplina[],
  topN: number = 35
): Array<{
  discId: number;
  discNome: string;
  subjId: number;
  subjNome: string;
}> {
  const topicKeywords = extractKeywords(topicName);
  const topicStems = extractStemmedKeywords(topicName);

  const scored: Array<{
    discId: number;
    discNome: string;
    subjId: number;
    subjNome: string;
    score: number;
  }> = [];

  for (const disc of candidates) {
    for (const subj of disc.subjects) {
      const subjKeywords = extractKeywords(subj.nome);
      const subjStems = extractStemmedKeywords(subj.nome);

      let score = 0;
      for (const sk of subjKeywords) {
        if (topicKeywords.includes(sk)) score += 5;
      }
      for (const ss of subjStems) {
        if (topicStems.includes(ss)) score += 2;
      }

      scored.push({
        discId: disc.discipline_id,
        discNome: disc.discipline_nome,
        subjId: subj.id,
        subjNome: subj.nome,
        score,
      });
    }
  }

  // Ordena por pontuação de aderência
  scored.sort((a, b) => b.score - a.score);

  const topScored = scored.filter(s => s.score > 0);
  if (topScored.length >= topN) {
    return topScored.slice(0, topN);
  }

  // Preenche até topN com os assuntos da disciplina candidata
  const result = [...topScored];
  const seenIds = new Set(result.map(r => `${r.discId}_${r.subjId}`));

  for (const s of scored) {
    const key = `${s.discId}_${s.subjId}`;
    if (!seenIds.has(key)) {
      result.push(s);
      seenIds.add(key);
      if (result.length >= topN) break;
    }
  }

  return result;
}

// REGRA 3: IA residual com Grounding Dinâmico na Taxonomia
async function matchResidualWithAI(
  unmatchedTopics: Array<{ topic: ExtractedTopico; candidates: TaxonomiaDisciplina[] }>,
  bancaId?: string
): Promise<void> {
  const { apiKey } = getAISettings();
  if (!apiKey || unmatchedTopics.length === 0) return;

  // Processa em lotes de até 15 tópicos por chamada
  const promptData = unmatchedTopics.slice(0, 15).map(({ topic, candidates }) => {
    const sampleSubjects = selectTopSubjectsForTopic(topic.nome, candidates, 35);

    return {
      topicoId: topic.id,
      topicoNome: topic.nome,
      candidatos: sampleSubjects,
    };
  });

  const systemInstruction = `
Você é um especialista em concursos públicos e na taxonomia do QConcursos.
Para cada tópico do edital, encontre o ID da disciplina e do(s) assunto(s) mais compatível(is) dentro da lista de candidatos fornecida.
Se houver múltiplos assuntos correlatos que cubram o tópico, você pode retornar uma lista de IDs em 'assuntoIds'.
Se nenhum candidato for suficientemente compatível, retorne null.
Retorne rigorosamente um JSON no formato:
{
  "matches": [
    { "topicoId": "id", "disciplinaId": 2, "assuntoId": 1269, "assuntoIds": [1269] }
  ]
}
`;

  try {
    const res = await callAIJson<{ 
      matches: Array<{ 
        topicoId: string; 
        disciplinaId: number; 
        assuntoId: number;
        assuntoIds?: number[];
      }> 
    }>(
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
            const extraIds = Array.isArray(m.assuntoIds) ? m.assuntoIds.map(String) : [String(subj.id)];
            target.topic.qconcursosFiltro = {
              disciplinaId: String(disc.discipline_id),
              assuntoId: String(subj.id),
              assuntoIds: extraIds.length > 1 ? extraIds : undefined,
              bancaId,
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
  onProgress?: (msg: string) => void,
  bancaNome?: string
): Promise<{
  disciplinas: ExtractedDisciplina[];
  taxonomiaRecorte: TaxonomiaDisciplina[];
}> {
  onProgress?.('Carregando taxonomia de referência...');
  const allDisciplines = await loadTaxonomiaQC();
  const bancaId = resolveBancaQCId(bancaNome);

  const unmatched: Array<{ topic: ExtractedTopico; candidates: TaxonomiaDisciplina[] }> = [];
  const usedDisciplineIds = new Set<number>();

  for (const disc of disciplinas) {
    onProgress?.(`Mapeando tópicos de ${disc.nome}...`);

    // Remove qualquer tópico fantasma que repita o cabeçalho da disciplina
    disc.topicos = disc.topicos.filter(t => !isDisciplineHeaderTopic(t.nome, disc.nome));

    // Busca disciplinas candidatas correspondentes à matéria do edital
    const candidateDisciplines = findCandidateDisciplines(disc.nome, allDisciplines);
    candidateDisciplines.forEach(c => usedDisciplineIds.add(c.discipline_id));

    for (const topico of disc.topicos) {
      // 1. CAMINHO 1 (GLOBAL): Busca por LEI (número + ano) roda na taxonomia INTEIRA
      const lawResult = matchLawAdvanced(topico.nome, candidateDisciplines, allDisciplines, disc.nome);
      if (lawResult.match) {
        lawResult.match.bancaId = bancaId;
        topico.qconcursosFiltro = lawResult.match;
        topico.sugestoesQC = lawResult.suggestions;
        usedDisciplineIds.add(Number(lawResult.match.disciplinaId));
        continue;
      }
      if (lawResult.suggestions.length > 0) {
        topico.sugestoesQC = lawResult.suggestions;
      }

      // 2. CAMINHO 2 (RESTRITO): Busca por PALAVRA-CHAVE roda SOMENTE nas disciplinas candidatas
      const hasSpecificLaw = /(?:decreto-lei|decreto|lei(?:\s+estadual|\s+federal)?)\s*(?:n[oº]|nº)?\s*(\d{1,2}(?:[\.\s]\d{3})*|\d{3,5})/i.test(topico.nome);

      if (!hasSpecificLaw && candidateDisciplines.length > 0) {
        // Camada 2: Temas Canônicos nas candidatas
        const aliasMatch = matchThemeAlias(topico.nome, candidateDisciplines);
        if (aliasMatch) {
          aliasMatch.bancaId = bancaId;
          topico.qconcursosFiltro = aliasMatch;
          usedDisciplineIds.add(Number(aliasMatch.disciplinaId));
          continue;
        }

        // Camada 3: Cobertura de Conceito (Palavra Inteira) nas candidatas
        const asymMatch = matchAsymmetricConcept(topico.nome, candidateDisciplines);
        if (asymMatch) {
          asymMatch.bancaId = bancaId;
          topico.qconcursosFiltro = asymMatch;
          usedDisciplineIds.add(Number(asymMatch.disciplinaId));
          continue;
        }

        // Camada 4: Keywords Simétricas (Palavra Inteira) nas candidatas
        const kwMatch = matchKeywords(topico.nome, candidateDisciplines);
        if (kwMatch) {
          kwMatch.bancaId = bancaId;
          topico.qconcursosFiltro = kwMatch;
          usedDisciplineIds.add(Number(kwMatch.disciplinaId));
          continue;
        }

        unmatched.push({ topic: topico, candidates: candidateDisciplines });
      }
    }
  }

  // Tentativa com IA residual com Grounding Dinâmico de 35 candidatos
  if (unmatched.length > 0) {
    onProgress?.(`Processando ${unmatched.length} tópicos com assistência semântica...`);
    await matchResidualWithAI(unmatched, bancaId);
    
    for (const { topic } of unmatched) {
      if (topic.qconcursosFiltro?.disciplinaId) {
        usedDisciplineIds.add(Number(topic.qconcursosFiltro.disciplinaId));
      }
    }
  }

  // Se não foi encontrado assunto nas etapas acima, o tópico permanece NÃO MAPEADO (qconcursosFiltro: null)
  // Disponibilizamos as sugestões mais semânticas da disciplina para seleção manual no modal
  for (const disc of disciplinas) {
    const candidateDisciplines = findCandidateDisciplines(disc.nome, allDisciplines);
    if (candidateDisciplines.length > 0) {
      for (const topico of disc.topicos) {
        if (!topico.qconcursosFiltro && (!topico.sugestoesQC || topico.sugestoesQC.length === 0)) {
          const topSuggestions = selectTopSubjectsForTopic(topico.nome, candidateDisciplines, 5);
          topico.sugestoesQC = topSuggestions.map(s => ({
            disciplinaId: String(s.discId),
            disciplinaNome: s.discNome,
            assuntoId: String(s.subjId),
            assuntoNome: s.subjNome,
            bancaId,
          }));
        }
      }
    }
  }

  // Extração apenas do recorte de disciplinas usadas
  const taxonomiaRecorte: TaxonomiaDisciplina[] = allDisciplines
    .filter(d => usedDisciplineIds.has(d.discipline_id))
    .map(d => ({
      discipline_id: d.discipline_id,
      discipline_nome: d.discipline_nome,
      subjects: d.subjects,
    }));

  return { disciplinas, taxonomiaRecorte };
}

// Reprocessamento de tópicos de um edital já cadastrado
export async function reprocessarMapeamentoTopicos(
  topicos: Topico[],
  disciplinas: Array<{ id: string; nome: string }>,
  taxonomiaAtual: TaxonomiaDisciplina[],
  onProgress?: (msg: string) => void,
  bancaNome?: string
): Promise<{
  topicosAtualizados: Topico[];
  taxonomiaRecorte: TaxonomiaDisciplina[];
  novosMapeados: number;
}> {
  onProgress?.('Carregando taxonomia de referência...');
  const allDisciplines = await loadTaxonomiaQC();
  const bancaId = resolveBancaQCId(bancaNome);

  const discMap = new Map<string, string>();
  disciplinas.forEach(d => discMap.set(d.id, d.nome));

  // Remove tópicos fantasmas que repetem o nome da disciplina
  const topicosValidos = topicos.filter(t => {
    const discNome = discMap.get(t.disciplinaId) || '';
    return !isDisciplineHeaderTopic(t.nome, discNome);
  });

  const usedDisciplineIds = new Set<number>(taxonomiaAtual.map(t => t.discipline_id));
  let novosMapeados = 0;

  const topicosAtualizados = topicosValidos.map(topico => {
    // REGRA DE OURO: NUNCA sobrescrever filtro definido manualmente
    if (topico.definidoManualmente) {
      if (topico.qconcursosFiltro?.disciplinaId) {
        usedDisciplineIds.add(Number(topico.qconcursosFiltro.disciplinaId));
      }
      return topico;
    }

    const discNome = discMap.get(topico.disciplinaId) || '';
    const candidateDisciplines = findCandidateDisciplines(discNome, allDisciplines);

    // 1. CAMINHO 1 (GLOBAL): Busca por LEI (número + ano) roda na taxonomia INTEIRA
    const lawResult = matchLawAdvanced(topico.nome, candidateDisciplines, allDisciplines, discNome);
    if (lawResult.match) {
      novosMapeados++;
      lawResult.match.bancaId = bancaId;
      usedDisciplineIds.add(Number(lawResult.match.disciplinaId));
      return {
        ...topico,
        qconcursosFiltro: lawResult.match,
        sugestoesQC: lawResult.suggestions,
      };
    }

    // 2. CAMINHO 2 (RESTRITO): Busca por PALAVRA-CHAVE roda SOMENTE nas disciplinas candidatas
    const hasSpecificLaw = /(?:decreto-lei|decreto|lei(?:\s+estadual|\s+federal)?)\s*(?:n[oº]|nº)?\s*(\d{1,2}(?:[\.\s]\d{3})*|\d{3,5})/i.test(topico.nome);

    if (!hasSpecificLaw && candidateDisciplines.length > 0) {
      // Camada 2: Temas Canônicos
      const aliasMatch = matchThemeAlias(topico.nome, candidateDisciplines);
      if (aliasMatch) {
        novosMapeados++;
        aliasMatch.bancaId = bancaId;
        usedDisciplineIds.add(Number(aliasMatch.disciplinaId));
        return {
          ...topico,
          qconcursosFiltro: aliasMatch,
          sugestoesQC: lawResult.suggestions.length > 0 ? lawResult.suggestions : topico.sugestoesQC,
        };
      }

      // Camada 3: Cobertura de Conceito (Palavra Inteira)
      const asymMatch = matchAsymmetricConcept(topico.nome, candidateDisciplines);
      if (asymMatch) {
        novosMapeados++;
        asymMatch.bancaId = bancaId;
        usedDisciplineIds.add(Number(asymMatch.disciplinaId));
        return {
          ...topico,
          qconcursosFiltro: asymMatch,
          sugestoesQC: lawResult.suggestions.length > 0 ? lawResult.suggestions : topico.sugestoesQC,
        };
      }

      // Camada 4: Keywords Simétricas (Palavra Inteira)
      const kwMatch = matchKeywords(topico.nome, candidateDisciplines);
      if (kwMatch) {
        novosMapeados++;
        kwMatch.bancaId = bancaId;
        usedDisciplineIds.add(Number(kwMatch.disciplinaId));
        return {
          ...topico,
          qconcursosFiltro: kwMatch,
          sugestoesQC: lawResult.suggestions.length > 0 ? lawResult.suggestions : topico.sugestoesQC,
        };
      }
    }

    // Se não encontrou assunto pelas regras rigorosas, o tópico permanece NÃO MAPEADO (pendente)
    const suggestions = candidateDisciplines.length > 0
      ? selectTopSubjectsForTopic(topico.nome, candidateDisciplines, 5).map(s => ({
          disciplinaId: String(s.discId),
          disciplinaNome: s.discNome,
          assuntoId: String(s.subjId),
          assuntoNome: s.subjNome,
          bancaId,
        }))
      : [];

    return {
      ...topico,
      qconcursosFiltro: null, // NÃO MAPEADO (Pendente)
      sugestoesQC: lawResult.suggestions.length > 0 ? lawResult.suggestions : suggestions,
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

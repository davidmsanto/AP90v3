export const DEFAULT_USER_ID = "default-user";

export interface Disciplina {
  id: string;
  nome: string;
  peso: number;
}

export interface QConcursosFiltro {
  disciplinaId: string;
  assuntoId?: string;
  disciplinaNome?: string;
  assuntoNome?: string;
}

export interface Topico {
  id: string;
  disciplinaId: string;
  nome: string;
  peso: number;
  concluido: boolean;
  qconcursosFiltro: QConcursosFiltro | null;
  sugestoesQC?: QConcursosFiltro[];
  definidoManualmente?: boolean;
}

export interface Edital {
  id: string;
  userId: string;
  nome: string;
  concurso: string;
  cargo: string;
  banca: string;
  dataProva: string;
  disciplinas: Disciplina[];
}

export interface RegistroQuestoes {
  id: string;
  userId: string;
  topicoId: string;
  data: string;
  quantidade: number;
  acertos: number;
}

export interface ErroRegistrado {
  id: string;
  userId: string;
  topicoId: string;
  enunciadoOuLink: string;
  nota: string;
  data: string;
  revisado: boolean;
}

export type EstagioRevisao = "R1" | "R2" | "R3";

export interface Revisao {
  id: string;
  userId: string;
  topicoId: string;
  estagio: EstagioRevisao;
  dataAgendada: string;
  concluida: boolean;
}

export interface DisponibilidadeSemanal {
  segunda: number;
  terca: number;
  quarta: number;
  quinta: number;
  sexta: number;
  sabado: number;
  domingo: number;
}

export interface RitmoEstudoConfig {
  disponibilidade: DisponibilidadeSemanal;
  tempoMedioMinutosPorTopico: number; // default: 45
}

export interface ItemCronograma {
  id: string;
  topicoId: string;
  disciplinaId: string;
  data: string; // Formato YYYY-MM-DD
  ordem: number;
}

// Tipos da Taxonomia do QConcursos
export interface TaxonomiaAssunto {
  id: number;
  nome: string;
  parent_id: number | null;
}

export interface TaxonomiaDisciplina {
  discipline_id: number;
  discipline_nome: string;
  subjects: TaxonomiaAssunto[];
}

// Tipos auxiliares de extração e estruturação de edital
export interface ExtractedTopico {
  id: string;
  nome: string;
  peso: number;
  qconcursosFiltro: QConcursosFiltro | null;
  sugestoesQC?: QConcursosFiltro[];
  definidoManualmente?: boolean;
}

export interface ExtractedDisciplina {
  id: string;
  nome: string;
  peso: number;
  topicos: ExtractedTopico[];
}

export interface ExtractedEdital {
  nome: string;
  concurso: string;
  cargo: string;
  banca: string;
  dataProva: string;
  disciplinas: ExtractedDisciplina[];
}

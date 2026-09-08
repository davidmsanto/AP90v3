import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  DEFAULT_USER_ID,
  Edital,
  Topico,
  RegistroQuestoes,
  ErroRegistrado,
  Revisao,
  TaxonomiaDisciplina,
  QConcursosFiltro,
  RitmoEstudoConfig,
  ItemCronograma,
} from '../types';
import { 
  distribuirTopicosNoCalendario, 
  executarRolloverAtrasados 
} from '../services/calendarScheduler';

export interface AppState {
  editais: Edital[];
  topicos: Topico[];
  registrosQuestoes: RegistroQuestoes[];
  errosRegistrados: ErroRegistrado[];
  revisoes: Revisao[];
  taxonomiaRecorte: TaxonomiaDisciplina[];
  ritmoConfig: RitmoEstudoConfig;
  cronograma: ItemCronograma[];

  // Ações
  salvarEdital: (
    edital: Edital,
    novosTopicos: Topico[],
    recorte: TaxonomiaDisciplina[]
  ) => void;
  atualizarMapeamentoTopicos: (
    novosTopicos: Topico[],
    novoRecorte: TaxonomiaDisciplina[]
  ) => void;
  atualizarTopicoFiltro: (
    topicoId: string,
    filtro: QConcursosFiltro | null
  ) => void;
  alternarConclusaoTopico: (topicoId: string) => void;
  removerEdital: (id?: string) => void;

  // Caderno de Erros
  adicionarErro: (erro: Omit<ErroRegistrado, 'id' | 'userId'>) => void;
  alternarRevisaoErro: (id: string) => void;
  removerErro: (id: string) => void;

  // Registro de Questões
  adicionarRegistroQuestoes: (registro: Omit<RegistroQuestoes, 'id' | 'userId'>) => void;
  removerRegistroQuestoes: (id: string) => void;

  // Ritmo de Estudo
  atualizarRitmoConfig: (config: Partial<RitmoEstudoConfig>) => void;

  // Sistema de Revisões
  concluirRevisao: (id: string) => void;
  removerRevisao: (id: string) => void;

  // Calendário de Estudos
  gerarCronograma: () => void;
  reagendarTopicosAtrasados: () => void;
  removerItemCronograma: (id: string) => void;
}

function formatarDataISO(data: Date): string {
  const y = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, '0');
  const d = String(data.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function criarRevisoesR1R2R3(topicoId: string, revisoesAtuais: Revisao[]): Revisao[] {
  const agora = new Date();
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());

  const estagios: { estagio: 'R1' | 'R2' | 'R3'; dias: number }[] = [
    { estagio: 'R1', dias: 1 },
    { estagio: 'R2', dias: 7 },
    { estagio: 'R3', dias: 30 },
  ];

  const novas: Revisao[] = [];

  for (const { estagio, dias } of estagios) {
    const jaExistePendente = revisoesAtuais.some(
      (r) => r.topicoId === topicoId && r.estagio === estagio && !r.concluida
    );

    if (!jaExistePendente) {
      const dataAlvo = new Date(hoje);
      dataAlvo.setDate(dataAlvo.getDate() + dias);

      novas.push({
        id: `rev_${Date.now()}_${estagio.toLowerCase()}_${Math.random().toString(36).slice(2, 7)}`,
        userId: DEFAULT_USER_ID,
        topicoId,
        estagio,
        dataAgendada: formatarDataISO(dataAlvo),
        concluida: false,
      });
    }
  }

  return novas;
}

const DEFAULT_RITMO_CONFIG: RitmoEstudoConfig = {
  disponibilidade: {
    segunda: 3,
    terca: 3,
    quarta: 3,
    quinta: 3,
    sexta: 3,
    sabado: 4,
    domingo: 1,
  },
  tempoMedioMinutosPorTopico: 45,
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      editais: [] as Edital[],
      topicos: [] as Topico[],
      registrosQuestoes: [] as RegistroQuestoes[],
      errosRegistrados: [] as ErroRegistrado[],
      revisoes: [] as Revisao[],
      taxonomiaRecorte: [] as TaxonomiaDisciplina[],
      ritmoConfig: DEFAULT_RITMO_CONFIG,
      cronograma: [] as ItemCronograma[],

      salvarEdital: (edital, novosTopicos, recorte) =>
        set((state) => {
          const ritmo = state.ritmoConfig || DEFAULT_RITMO_CONFIG;
          const novoCronograma = distribuirTopicosNoCalendario(
            novosTopicos,
            ritmo.disponibilidade,
            ritmo.tempoMedioMinutosPorTopico
          );
          return {
            editais: [edital],
            topicos: novosTopicos,
            taxonomiaRecorte: recorte,
            cronograma: novoCronograma,
          };
        }),

      atualizarMapeamentoTopicos: (novosTopicos, novoRecorte) =>
        set({
          topicos: novosTopicos,
          taxonomiaRecorte: novoRecorte,
        }),

      atualizarTopicoFiltro: (topicoId, filtro) =>
        set((state) => ({
          topicos: state.topicos.map((t) =>
            t.id === topicoId
              ? {
                  ...t,
                  qconcursosFiltro: filtro,
                  definidoManualmente: true,
                }
              : t
          ),
        })),

      removerEdital: () =>
        set({
          editais: [],
          topicos: [],
          taxonomiaRecorte: [],
          cronograma: [],
        }),

      adicionarErro: (dadosErro) =>
        set((state) => ({
          errosRegistrados: [
            {
              ...dadosErro,
              id: `erro_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              userId: DEFAULT_USER_ID,
            },
            ...state.errosRegistrados,
          ],
        })),

      alternarRevisaoErro: (id) =>
        set((state) => ({
          errosRegistrados: state.errosRegistrados.map((e) =>
            e.id === id ? { ...e, revisado: !e.revisado } : e
          ),
        })),

      removerErro: (id) =>
        set((state) => ({
          errosRegistrados: state.errosRegistrados.filter((e) => e.id !== id),
        })),

      adicionarRegistroQuestoes: (dados) =>
        set((state) => {
          const novasRevisoes = criarRevisoesR1R2R3(dados.topicoId, state.revisoes);
          return {
            registrosQuestoes: [
              {
                ...dados,
                id: `reg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                userId: DEFAULT_USER_ID,
              },
              ...state.registrosQuestoes,
            ],
            revisoes: [...state.revisoes, ...novasRevisoes],
          };
        }),

      alternarConclusaoTopico: (topicoId) =>
        set((state) => {
          const topicoAtual = state.topicos.find((t) => t.id === topicoId);
          const novoConcluido = !topicoAtual?.concluido;
          const novosTopicos = state.topicos.map((t) =>
            t.id === topicoId
              ? {
                  ...t,
                  concluido: novoConcluido,
                }
              : t
          );

          let novasRevisoes = state.revisoes;
          // Quando o usuário marcar o checkbox como concluído, agenda R1, R2, R3 automaticamente
          if (novoConcluido) {
            const agendadas = criarRevisoesR1R2R3(topicoId, state.revisoes);
            novasRevisoes = [...state.revisoes, ...agendadas];
          }

          return {
            topicos: novosTopicos,
            revisoes: novasRevisoes,
          };
        }),

      removerRegistroQuestoes: (id) =>
        set((state) => ({
          registrosQuestoes: state.registrosQuestoes.filter((r) => r.id !== id),
        })),

      atualizarRitmoConfig: (novoRitmo) =>
        set((state) => ({
          ritmoConfig: {
            ...state.ritmoConfig,
            ...novoRitmo,
            disponibilidade: {
              ...(state.ritmoConfig?.disponibilidade || DEFAULT_RITMO_CONFIG.disponibilidade),
              ...(novoRitmo.disponibilidade || {}),
            },
          },
        })),

      concluirRevisao: (id) =>
        set((state) => ({
          revisoes: state.revisoes.map((r) =>
            r.id === id ? { ...r, concluida: true } : r
          ),
        })),

      removerRevisao: (id) =>
        set((state) => ({
          revisoes: state.revisoes.filter((r) => r.id !== id),
        })),

      gerarCronograma: () =>
        set((state) => {
          const ritmo = state.ritmoConfig || DEFAULT_RITMO_CONFIG;
          const novoCronograma = distribuirTopicosNoCalendario(
            state.topicos,
            ritmo.disponibilidade,
            ritmo.tempoMedioMinutosPorTopico
          );
          return { cronograma: novoCronograma };
        }),

      reagendarTopicosAtrasados: () =>
        set((state) => {
          const ritmo = state.ritmoConfig || DEFAULT_RITMO_CONFIG;
          const { novoCronograma, alteradosCount } = executarRolloverAtrasados(
            state.cronograma,
            state.topicos,
            ritmo.disponibilidade,
            ritmo.tempoMedioMinutosPorTopico
          );
          if (alteradosCount > 0) {
            return { cronograma: novoCronograma };
          }
          return state;
        }),

      removerItemCronograma: (id) =>
        set((state) => ({
          cronograma: state.cronograma.filter((c) => c.id !== id),
        })),
    }),
    {
      name: 'ap90-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

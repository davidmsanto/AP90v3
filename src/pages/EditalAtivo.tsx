import React, { useState, useMemo } from 'react';
import { 
  Trash2, 
  PlusCircle, 
  BookOpen, 
  RefreshCw, 
  Loader2, 
  ExternalLink, 
  AlertTriangle,
  CheckSquare,
  Target,
  Clock,
  CheckCircle2,
  Circle,
  CalendarDays
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Card, Button, Badge, MetricCard } from '../components/ui';
import { reprocessarMapeamentoTopicos, buildQConcursosUrl } from '../services/mapEditalToQconcursos';
import { ModalQConcursosSelector } from '../components/ModalQConcursosSelector';
import { Topico, QConcursosFiltro } from '../types';

interface EditalAtivoProps {
  onNovoEdital: () => void;
  onRegistrarQuestoes?: () => void;
  onNavigateToRitmo?: () => void;
  onNavigateToCalendario?: () => void;
}

export const EditalAtivo: React.FC<EditalAtivoProps> = ({ 
  onNovoEdital, 
  onRegistrarQuestoes,
  onNavigateToRitmo,
  onNavigateToCalendario
}) => {
  const { 
    editais, 
    topicos, 
    registrosQuestoes,
    taxonomiaRecorte, 
    removerEdital, 
    atualizarMapeamentoTopicos,
    atualizarTopicoFiltro,
    alternarConclusaoTopico
  } = useAppStore();
  const edital = editais[0];

  const [isReprocessando, setIsReprocessando] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [modalTopic, setModalTopic] = useState<Topico | null>(null);

  // Cálculo memoizado do aproveitamento de cada tópico
  const estatisticasPorTopico = useMemo(() => {
    const stats = new Map<string, { totalQuestoes: number; totalAcertos: number; percentual: number | null }>();

    topicos.forEach(t => {
      stats.set(t.id, { totalQuestoes: 0, totalAcertos: 0, percentual: null });
    });

    registrosQuestoes.forEach(reg => {
      const current = stats.get(reg.topicoId) || { totalQuestoes: 0, totalAcertos: 0, percentual: null };
      current.totalQuestoes += reg.quantidade;
      current.totalAcertos += reg.acertos;
      stats.set(reg.topicoId, current);
    });

    stats.forEach((val) => {
      if (val.totalQuestoes > 0) {
        val.percentual = Math.round((val.totalAcertos / val.totalQuestoes) * 100);
      }
    });

    return stats;
  }, [topicos, registrosQuestoes]);

  // Cálculo memoizado do aproveitamento agregado por disciplina
  const estatisticasPorDisciplina = useMemo(() => {
    const stats = new Map<string, { totalQuestoes: number; totalAcertos: number; percentual: number | null }>();
    if (!edital) return stats;

    edital.disciplinas.forEach(disc => {
      const topicosDaDisc = topicos.filter(t => t.disciplinaId === disc.id);
      let totalQ = 0;
      let totalA = 0;

      topicosDaDisc.forEach(t => {
        const tStat = estatisticasPorTopico.get(t.id);
        if (tStat) {
          totalQ += tStat.totalQuestoes;
          totalA += tStat.totalAcertos;
        }
      });

      const percentual = totalQ > 0 ? Math.round((totalA / totalQ) * 100) : null;
      stats.set(disc.id, { totalQuestoes: totalQ, totalAcertos: totalA, percentual });
    });

    return stats;
  }, [edital, topicos, estatisticasPorTopico]);

  if (!edital) {
    return null;
  }

  const totalTopicos = topicos.length;
  const totalMapeados = topicos.filter(t => t.qconcursosFiltro !== null).length;
  const taxaMapeamento = Math.round((totalMapeados / (totalTopicos || 1)) * 100);

  // Total geral de questões e acertos no edital
  const totalQuestoesEdital = registrosQuestoes.reduce((acc, r) => acc + r.quantidade, 0);
  const totalAcertosEdital = registrosQuestoes.reduce((acc, r) => acc + r.acertos, 0);
  const aproveitamentoGlobal = totalQuestoesEdital > 0 ? Math.round((totalAcertosEdital / totalQuestoesEdital) * 100) : null;

  const handleRemover = () => {
    if (confirm('Tem certeza de que deseja remover este edital? Todos os tópicos associados serão excluídos.')) {
      removerEdital();
    }
  };

  const handleReprocessar = async () => {
    setIsReprocessando(true);
    setFeedbackMsg(null);
    try {
      const result = await reprocessarMapeamentoTopicos(
        topicos,
        edital.disciplinas,
        taxonomiaRecorte
      );

      atualizarMapeamentoTopicos(result.topicosAtualizados, result.taxonomiaRecorte);
      setFeedbackMsg(`Mapeamento concluído: ${result.novosMapeados} novo(s) tópico(s) mapeado(s).`);
      setTimeout(() => setFeedbackMsg(null), 5000);
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao reprocessar mapeamento: ${err.message || err}`);
    } finally {
      setIsReprocessando(false);
    }
  };

  const handleUpdateTopicFiltro = (filtro: QConcursosFiltro | null) => {
    if (!modalTopic) return;
    atualizarTopicoFiltro(modalTopic.id, filtro);
    setModalTopic(null);
  };

  // Tratamento determinístico do botão "Resolver questões"
  const handleResolverQuestoes = (topico: Topico) => {
    if (!topico.qconcursosFiltro) return;
    // Montagem determinística da URL a partir dos dados salvos no momento da extração
    const url = buildQConcursosUrl(topico.qconcursosFiltro);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header do Edital Ativo */}
      <Card variant="elevated" padding="lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="success">EDITAL ATIVO</Badge>
              <span className="text-caption font-mono text-text-secondary">
                Banca: {edital.banca || 'Não informada'}
              </span>
            </div>
            <h1 className="text-h1 text-text-primary tracking-tight">
              {edital.concurso}
            </h1>
            <p className="text-body text-text-secondary mt-1">
              Cargo: <span className="text-text-primary font-medium">{edital.cargo}</span> • Prova: {edital.dataProva || 'A definir'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            {onNavigateToCalendario && (
              <Button
                variant="secondary"
                size="md"
                onClick={onNavigateToCalendario}
                icon={<CalendarDays className="w-4 h-4 text-accent-success" />}
              >
                Calendário
              </Button>
            )}
            {onNavigateToRitmo && (
              <Button
                variant="secondary"
                size="md"
                onClick={onNavigateToRitmo}
                icon={<Clock className="w-4 h-4 text-accent-success" />}
              >
                Ritmo de Estudo
              </Button>
            )}
            {onRegistrarQuestoes && (
              <Button
                variant="secondary"
                size="md"
                onClick={onRegistrarQuestoes}
                icon={<CheckSquare className="w-4 h-4 text-accent-success" />}
              >
                Registrar Questões
              </Button>
            )}
            <Button
              variant="secondary"
              size="md"
              onClick={handleReprocessar}
              disabled={isReprocessando}
              icon={
                isReprocessando ? (
                  <Loader2 className="w-4 h-4 animate-spin text-accent-success" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )
              }
            >
              {isReprocessando ? 'Reprocessando...' : 'Reprocessar mapeamento'}
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={handleRemover}
              icon={<Trash2 className="w-4 h-4 text-accent-critical" />}
            >
              Remover
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={onNovoEdital}
              icon={<PlusCircle className="w-4 h-4" />}
            >
              Importar Novo Edital
            </Button>
          </div>
        </div>

        {feedbackMsg && (
          <div className="mt-4 p-3 rounded-lg bg-surface border border-accent-success/30 text-caption font-mono text-accent-success">
            ✓ {feedbackMsg}
          </div>
        )}
      </Card>

      {/* Métricas do Edital */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <MetricCard
          label="Disciplinas"
          value={edital.disciplinas.length}
          context="Conteúdo programático"
          icon={<BookOpen className="w-4 h-4" />}
        />
        <MetricCard
          label="Tópicos Cadastrados"
          value={totalTopicos}
          context={`${totalMapeados} vinculados ao QConcursos`}
          badge={<Badge variant="success">{taxaMapeamento}%</Badge>}
        />
        <MetricCard
          label="Aproveitamento Geral"
          value={aproveitamentoGlobal !== null ? `${aproveitamentoGlobal}%` : '--%'}
          context={totalQuestoesEdital > 0 ? `${totalAcertosEdital}/${totalQuestoesEdital} acertos` : 'Sem questões ainda'}
          badge={
            aproveitamentoGlobal === null ? (
              <Badge variant="neutral">Sem dados</Badge>
            ) : aproveitamentoGlobal >= 80 ? (
              <Badge variant="success">Excelente</Badge>
            ) : aproveitamentoGlobal >= 60 ? (
              <Badge variant="warning">Em evolução</Badge>
            ) : (
              <Badge variant="critical">Atenção</Badge>
            )
          }
          icon={<Target className="w-4 h-4 text-accent-success" />}
        />
        <MetricCard
          label="Recorte QConcursos"
          value={`${taxonomiaRecorte.length} disciplinas`}
          context="Taxonomia local otimizada"
          badge={<Badge variant="neutral">Offline</Badge>}
        />
      </div>

      {/* Lista de Disciplinas e Tópicos */}
      <div className="space-y-4">
        {edital.disciplinas.map(disc => {
          const topicosDaDisciplina = topicos.filter(t => t.disciplinaId === disc.id);
          const discStat = estatisticasPorDisciplina.get(disc.id);

          return (
            <Card key={disc.id} variant="default" padding="md" className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-surface-border pb-3 gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-accent-success" />
                  <h2 className="text-h2 text-text-primary">{disc.nome}</h2>
                  <Badge variant="neutral" className="text-caption">
                    {topicosDaDisciplina.length} tópicos
                  </Badge>
                </div>
                
                {/* Total Agregado por Disciplina */}
                <div className="flex items-center gap-3">
                  {discStat && discStat.percentual !== null ? (
                    <Badge
                      variant={discStat.percentual >= 80 ? 'success' : discStat.percentual >= 60 ? 'warning' : 'critical'}
                      className="font-mono text-caption"
                      title={`${discStat.totalAcertos} acertos em ${discStat.totalQuestoes} questões nesta disciplina`}
                    >
                      Aproveitamento: {discStat.percentual}% ({discStat.totalAcertos}/{discStat.totalQuestoes})
                    </Badge>
                  ) : (
                    <span className="text-caption font-mono text-text-secondary">
                      Sem questões registradas
                    </span>
                  )}
                  <div className="text-caption font-mono text-text-secondary">
                    Peso: {disc.peso}
                  </div>
                </div>
              </div>

              <div className="divide-y divide-surface-border">
                {topicosDaDisciplina.map(topico => {
                  const qc = topico.qconcursosFiltro;
                  const temSugestoes = !qc && topico.sugestoesQC && topico.sugestoesQC.length > 0;
                  const tStat = estatisticasPorTopico.get(topico.id);

                  return (
                    <div
                      key={topico.id}
                      className="py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-body"
                    >
                      <div className="flex items-center gap-2.5 text-text-primary flex-1 min-w-0 pr-2">
                        <button
                          type="button"
                          onClick={() => alternarConclusaoTopico(topico.id)}
                          className="text-text-secondary hover:text-accent-success transition-colors cursor-pointer flex-shrink-0"
                          title={topico.concluido ? 'Tópico concluído (clique para reabrir)' : 'Marcar tópico como concluído'}
                        >
                          {topico.concluido ? (
                            <CheckCircle2 className="w-4 h-4 text-accent-success" />
                          ) : (
                            <Circle className="w-4 h-4 text-text-secondary/40 hover:text-accent-success" />
                          )}
                        </button>
                        <span className={`break-words ${topico.concluido ? 'line-through text-text-secondary/60' : ''}`}>
                          {topico.nome}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 flex-shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                        {/* Grupo 1: Métricas de Desempenho e Peso */}
                        <div className="flex items-center gap-2">
                          {/* Indicador de % de Aproveitamento do Tópico (Tokens oficiais: accent-success, accent-warning, accent-critical) */}
                          {tStat && tStat.percentual !== null ? (
                            <div
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-caption font-mono font-medium border ${
                                tStat.percentual >= 80
                                  ? 'bg-accent-success/15 text-accent-success border-accent-success/30'
                                  : tStat.percentual >= 60
                                  ? 'bg-accent-warning/15 text-accent-warning border-accent-warning/30'
                                  : 'bg-accent-critical/15 text-accent-critical border-accent-critical/30'
                              }`}
                              title={`${tStat.totalAcertos} acertos em ${tStat.totalQuestoes} questões respondidas neste tópico`}
                            >
                              <Target className="w-3 h-3 flex-shrink-0 opacity-80" />
                              <span>{tStat.percentual}%</span>
                              <span className="opacity-70 text-[10px]">({tStat.totalAcertos}/{tStat.totalQuestoes})</span>
                            </div>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-caption font-mono text-text-secondary/50 bg-surface-elevated/40 border border-surface-border"
                              title="Nenhuma questão registrada para este tópico"
                            >
                              <span className="text-[10px] uppercase tracking-wide opacity-70">Taxa</span>
                              <span>--%</span>
                            </span>
                          )}

                          <span className="text-caption font-mono text-text-secondary hidden md:inline px-1.5 py-0.5 rounded bg-surface border border-surface-border">
                            P{topico.peso}
                          </span>
                        </div>

                        {/* Divisória sutil entre métricas do tópico e ação QConcursos */}
                        <div className="h-4 w-px bg-surface-border hidden sm:block" />

                        {/* Grupo 2: Integração e Ação QConcursos */}
                        <div className="flex items-center gap-2">
                          {qc ? (
                            <>
                              {/* Mapeamento existente (pílula rounded-full do assunto QC) */}
                              <button
                                onClick={() => setModalTopic(topico)}
                                className="text-left group cursor-pointer"
                                title="Clique para alterar mapeamento no QConcursos"
                              >
                                <Badge variant="neutral" className="max-w-[160px] sm:max-w-[200px] truncate border-accent-success/30 text-text-primary group-hover:border-accent-success">
                                  <span className="w-1.5 h-1.5 rounded-full bg-accent-success mr-1 flex-shrink-0 inline-block" />
                                  <span className="truncate">{qc.assuntoNome || `QC ${qc.assuntoId}`}</span>
                                </Badge>
                              </button>

                              {/* 1. Mapeado → abre o link direto em nova aba */}
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleResolverQuestoes(topico)}
                                title={`Abrir questões no QConcursos (${qc.assuntoNome || qc.disciplinaNome})`}
                                icon={<ExternalLink className="w-3.5 h-3.5 text-accent-success" />}
                              >
                                Resolver questões
                              </Button>
                            </>
                          ) : temSugestoes ? (
                            <>
                              {/* Indicação visual de sugestões detectadas */}
                              <button
                                onClick={() => setModalTopic(topico)}
                                className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface border border-accent-warning/40 hover:border-accent-warning text-accent-warning text-caption transition-colors cursor-pointer"
                                title="Clique para escolher uma sugestão em 1 clique"
                              >
                                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-accent-warning" />
                                <span className="truncate max-w-[180px]">
                                  {topico.sugestoesQC!.length} sugestão(ões)
                                </span>
                              </button>

                              {/* 2. Pendente COM sugestões → botão abre o modal com as sugestões pré-carregadas */}
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setModalTopic(topico)}
                                title="Tópico pendente com sugestões detectadas — clique para resolver em 1 clique"
                                className="border-accent-warning/50 text-accent-warning hover:border-accent-warning"
                                icon={<AlertTriangle className="w-3.5 h-3.5 text-accent-warning" />}
                              >
                                Resolver questões
                              </Button>
                            </>
                          ) : (
                            <>
                              {/* Indicação visual de "filtro não encontrado — edite o mapeamento manualmente" */}
                              <button
                                onClick={() => setModalTopic(topico)}
                                className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface border border-accent-warning/40 hover:border-accent-warning text-accent-warning text-caption transition-colors cursor-pointer"
                                title="Clique para editar o mapeamento manualmente"
                              >
                                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-accent-warning" />
                                <span className="truncate max-w-[200px] sm:max-w-[240px]">
                                  filtro não encontrado — edite
                                </span>
                              </button>

                              {/* 3. Sem mapeamento e sem sugestões → desabilitado */}
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={true}
                                title="filtro não encontrado — edite o mapeamento manualmente"
                                icon={<ExternalLink className="w-3.5 h-3.5 opacity-40" />}
                              >
                                Resolver questões
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Modal de Mapeamento Manual do QConcursos no Edital Ativo */}
      {modalTopic && (
        <ModalQConcursosSelector
          isOpen={true}
          onClose={() => setModalTopic(null)}
          taxonomiaRecorte={taxonomiaRecorte}
          topicoNome={modalTopic.nome}
          currentFiltro={modalTopic.qconcursosFiltro}
          sugestoes={modalTopic.sugestoesQC}
          onSelect={handleUpdateTopicFiltro}
        />
      )}
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import { 
  RotateCcw, 
  CheckCircle2, 
  Calendar, 
  Clock, 
  ExternalLink, 
  AlertTriangle,
  BookOpen,
  Filter,
  CheckCheck,
  CalendarClock
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Card, Button, Badge, MetricCard } from '../components/ui';
import { buildQConcursosUrl } from '../services/mapEditalToQconcursos';
import { EstagioRevisao } from '../types';

interface RevisoesPageProps {
  onNavigateToEdital?: () => void;
  onNavigateToQuestoes?: () => void;
}

function obterHojeISO(): string {
  const agora = new Date();
  const y = agora.getFullYear();
  const m = String(agora.getMonth() + 1).padStart(2, '0');
  const d = String(agora.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function calcularDiferencaDias(dataAgendadaStr: string, hojeStr: string): number {
  const [ay, am, ad] = dataAgendadaStr.split('-').map(Number);
  const [hy, hm, hd] = hojeStr.split('-').map(Number);

  const dataA = new Date(ay, am - 1, ad).getTime();
  const dataH = new Date(hy, hm - 1, hd).getTime();

  const diffMs = dataH - dataA;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export const RevisoesPage: React.FC<RevisoesPageProps> = ({
  onNavigateToEdital,
  onNavigateToQuestoes,
}) => {
  const { revisoes, topicos, editais, concluirRevisao } = useAppStore();
  const editalAtivo = editais[0];
  const hojeISO = obterHojeISO();

  const [abaAtiva, setAbaAtiva] = useState<'pendentes' | 'futuras' | 'concluidas'>('pendentes');
  const [filtroEstagio, setFiltroEstagio] = useState<'todos' | EstagioRevisao>('todos');

  // Mapa rápido de tópico para enriquecer cada revisão
  const topicoMap = useMemo(() => {
    const map = new Map<string, { topicoNome: string; disciplinaNome: string; topico: any }>();
    topicos.forEach((t) => {
      const disc = editalAtivo?.disciplinas.find((d) => d.id === t.disciplinaId);
      map.set(t.id, {
        topicoNome: t.nome,
        disciplinaNome: disc?.nome || 'Disciplina Geral',
        topico: t,
      });
    });
    return map;
  }, [topicos, editalAtivo]);

  // 1. Revisões Pendentes: dataAgendada <= hoje && concluida === false
  // Ordenadas por data (as mais atrasadas primeiro -> dataAgendada ascendente)
  const revisoesPendentes = useMemo(() => {
    return revisoes
      .filter((r) => !r.concluida && r.dataAgendada <= hojeISO)
      .filter((r) => (filtroEstagio === 'todos' ? true : r.estagio === filtroEstagio))
      .sort((a, b) => a.dataAgendada.localeCompare(b.dataAgendada));
  }, [revisoes, hojeISO, filtroEstagio]);

  // 2. Próximas Revisões: dataAgendada > hoje && concluida === false
  const revisoesFuturas = useMemo(() => {
    return revisoes
      .filter((r) => !r.concluida && r.dataAgendada > hojeISO)
      .filter((r) => (filtroEstagio === 'todos' ? true : r.estagio === filtroEstagio))
      .sort((a, b) => a.dataAgendada.localeCompare(b.dataAgendada));
  }, [revisoes, hojeISO, filtroEstagio]);

  // 3. Revisões Concluídas: concluida === true
  const revisoesConcluidas = useMemo(() => {
    return revisoes
      .filter((r) => r.concluida)
      .filter((r) => (filtroEstagio === 'todos' ? true : r.estagio === filtroEstagio))
      .sort((a, b) => b.dataAgendada.localeCompare(a.dataAgendada));
  }, [revisoes, filtroEstagio]);

  // Métricas de contagem
  const totalPendentes = useMemo(() => revisoes.filter((r) => !r.concluida && r.dataAgendada <= hojeISO).length, [revisoes, hojeISO]);
  const totalAtrasadas = useMemo(() => revisoes.filter((r) => !r.concluida && r.dataAgendada < hojeISO).length, [revisoes, hojeISO]);
  const totalHoje = useMemo(() => revisoes.filter((r) => !r.concluida && r.dataAgendada === hojeISO).length, [revisoes, hojeISO]);
  const totalFuturas = useMemo(() => revisoes.filter((r) => !r.concluida && r.dataAgendada > hojeISO).length, [revisoes, hojeISO]);

  const handleResolverQuestoes = (topico: any) => {
    if (!topico?.qconcursosFiltro) return;
    const url = buildQConcursosUrl(topico.qconcursosFiltro);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const getEstagioDescricao = (estagio: EstagioRevisao) => {
    switch (estagio) {
      case 'R1':
        return 'Revisão de 24h (+1 dia)';
      case 'R2':
        return 'Revisão de 7 dias (+7 dias)';
      case 'R3':
        return 'Revisão de 30 dias (+30 dias)';
    }
  };

  const listaExibida = abaAtiva === 'pendentes' ? revisoesPendentes : abaAtiva === 'futuras' ? revisoesFuturas : revisoesConcluidas;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="neutral" className="font-mono text-caption">
              Sistema de Repetição Espaçada
            </Badge>
            {editalAtivo && (
              <span className="text-caption font-mono text-text-secondary">
                {editalAtivo.concurso}
              </span>
            )}
          </div>
          <h1 className="text-h1 text-text-primary tracking-tight">
            Revisões Pendentes
          </h1>
          <p className="text-body text-text-secondary max-w-2xl">
            Ciclos de retenção R1 (+1 dia), R2 (+7 dias) e R3 (+30 dias) gerados automaticamente ao concluir tópicos ou registrar questões.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {onNavigateToEdital && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onNavigateToEdital}
              icon={<BookOpen className="w-4 h-4" />}
            >
              Edital & Matérias
            </Button>
          )}
          {onNavigateToQuestoes && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onNavigateToQuestoes}
              icon={<CheckCircle2 className="w-4 h-4 text-accent-success" />}
            >
              Registrar Questões
            </Button>
          )}
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Pendentes para Hoje"
          value={totalPendentes}
          context={totalAtrasadas > 0 ? `${totalAtrasadas} atrasada(s)` : 'Tudo em dia'}
          badge={totalPendentes > 0 ? <Badge variant={totalAtrasadas > 0 ? 'critical' : 'warning'}>Requer Atenção</Badge> : <Badge variant="success">Em Dia</Badge>}
          icon={<Clock className="w-4 h-4" />}
        />

        <MetricCard
          label="Atrasadas"
          value={totalAtrasadas}
          context="data anterior a hoje"
          badge={<Badge variant={totalAtrasadas > 0 ? 'critical' : 'neutral'}>{totalAtrasadas > 0 ? 'Crítico' : 'Zero'}</Badge>}
          icon={<AlertTriangle className="w-4 h-4" />}
        />

        <MetricCard
          label="Para Hoje"
          value={totalHoje}
          context="vencimento na data atual"
          badge={<Badge variant="warning">{totalHoje} hoje</Badge>}
          icon={<Calendar className="w-4 h-4" />}
        />

        <MetricCard
          label="Próximas Agendadas"
          value={totalFuturas}
          context="cronograma futuro R1/R2/R3"
          badge={<Badge variant="neutral">Planejadas</Badge>}
          icon={<CalendarClock className="w-4 h-4" />}
        />
      </div>

      {/* Card Principal da Listagem */}
      <Card variant="default" padding="lg" className="space-y-6">
        {/* Barra de Abas e Filtro por Estágio */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-border pb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAbaAtiva('pendentes')}
              className={`px-3 py-1.5 rounded-lg text-caption font-mono font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                abaAtiva === 'pendentes'
                  ? 'bg-surface-elevated text-accent-success border border-accent-success/40'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated/50'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Pendentes Hoje</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-accent-success/20 text-accent-success font-bold">
                {totalPendentes}
              </span>
            </button>

            <button
              onClick={() => setAbaAtiva('futuras')}
              className={`px-3 py-1.5 rounded-lg text-caption font-mono font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                abaAtiva === 'futuras'
                  ? 'bg-surface-elevated text-text-primary border border-surface-border-elevated'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated/50'
              }`}
            >
              <CalendarClock className="w-3.5 h-3.5" />
              <span>Próximas Agendadas</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-surface-elevated text-text-secondary font-bold">
                {totalFuturas}
              </span>
            </button>

            <button
              onClick={() => setAbaAtiva('concluidas')}
              className={`px-3 py-1.5 rounded-lg text-caption font-mono font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                abaAtiva === 'concluidas'
                  ? 'bg-surface-elevated text-text-primary border border-surface-border-elevated'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated/50'
              }`}
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Histórico Concluídas</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-caption font-mono text-text-secondary hidden sm:inline flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Estágio:
            </span>
            <select
              value={filtroEstagio}
              onChange={(e) => setFiltroEstagio(e.target.value as any)}
              className="bg-surface-elevated border border-surface-border text-text-primary px-2.5 py-1 rounded-lg text-caption font-mono focus:border-accent-success focus:outline-none transition-colors"
            >
              <option value="todos">Todos (R1, R2, R3)</option>
              <option value="R1">Apenas R1 (+1 dia)</option>
              <option value="R2">Apenas R2 (+7 dias)</option>
              <option value="R3">Apenas R3 (+30 dias)</option>
            </select>
          </div>
        </div>

        {/* Lista de Revisões */}
        {listaExibida.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <div className="w-12 h-12 rounded-full bg-surface-elevated border border-surface-border mx-auto flex items-center justify-center text-accent-success">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-h2 text-text-primary font-semibold">
              {abaAtiva === 'pendentes'
                ? 'Nenhuma revisão pendente para hoje!'
                : abaAtiva === 'futuras'
                ? 'Nenhuma revisão futura agendada.'
                : 'Nenhuma revisão concluída registrada.'}
            </h3>
            <p className="text-body text-text-secondary max-w-md mx-auto">
              {abaAtiva === 'pendentes'
                ? 'Você está em dia com seu cronograma. Quando marcar novos tópicos como concluídos ou registrar questões, os ciclos R1, R2 e R3 aparecerão aqui nas datas agendadas.'
                : 'Conclua tópicos no edital ou registre baterias de questões para agendar novos ciclos de repetição espaçada.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {listaExibida.map((rev) => {
              const info = topicoMap.get(rev.topicoId);
              const diasDiff = calcularDiferencaDias(rev.dataAgendada, hojeISO);
              const isAtrasada = diasDiff > 0 && !rev.concluida;
              const isHoje = diasDiff === 0 && !rev.concluida;

              return (
                <div
                  key={rev.id}
                  className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isAtrasada
                      ? 'bg-surface border-accent-critical/40 hover:border-accent-critical/60'
                      : isHoje
                      ? 'bg-surface border-accent-warning/40 hover:border-accent-warning/60'
                      : rev.concluida
                      ? 'bg-surface-card border-surface-border opacity-70'
                      : 'bg-surface-card border-surface-border hover:border-surface-border-elevated'
                  }`}
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Badge do Estágio */}
                      <Badge
                        variant={rev.estagio === 'R1' ? 'warning' : 'neutral'}
                        className="font-mono text-caption font-bold px-2.5 py-0.5"
                      >
                        {rev.estagio} • {getEstagioDescricao(rev.estagio)}
                      </Badge>

                      <Badge variant="neutral" className="text-caption font-mono text-text-secondary">
                        {info?.disciplinaNome || 'Disciplina'}
                      </Badge>

                      {/* Status temporal */}
                      {rev.concluida ? (
                        <span className="inline-flex items-center gap-1 text-caption font-mono text-accent-success">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Concluída
                        </span>
                      ) : isAtrasada ? (
                        <span className="inline-flex items-center gap-1 text-caption font-mono text-accent-critical font-bold">
                          <AlertTriangle className="w-3.5 h-3.5" /> Atrasada há {diasDiff} {diasDiff === 1 ? 'dia' : 'dias'}
                        </span>
                      ) : isHoje ? (
                        <span className="inline-flex items-center gap-1 text-caption font-mono text-accent-warning font-semibold">
                          <Clock className="w-3.5 h-3.5" /> Para Hoje
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-caption font-mono text-text-secondary">
                          <Calendar className="w-3.5 h-3.5" /> Em {Math.abs(diasDiff)} dias
                        </span>
                      )}
                    </div>

                    {/* Nome do Tópico */}
                    <h3 className="text-body font-semibold text-text-primary break-words">
                      {info?.topicoNome || 'Tópico não encontrado'}
                    </h3>

                    <p className="text-caption font-mono text-text-secondary">
                      Data agendada: <strong className="text-text-primary">{rev.dataAgendada}</strong>
                    </p>
                  </div>

                  {/* Ações: Resolver Questões e Concluir Revisão */}
                  <div className="flex flex-wrap items-center gap-2.5 flex-shrink-0 justify-end">
                    {info?.topico?.qconcursosFiltro && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleResolverQuestoes(info.topico)}
                        title="Abrir questões no QConcursos para revisar"
                        icon={<ExternalLink className="w-3.5 h-3.5 text-accent-success" />}
                      >
                        Praticar Questões
                      </Button>
                    )}

                    {!rev.concluida ? (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => concluirRevisao(rev.id)}
                        icon={<CheckCircle2 className="w-4 h-4" />}
                      >
                        Concluir revisão
                      </Button>
                    ) : (
                      <Badge variant="success" className="font-mono text-caption">
                        ✓ Revisado
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

import React, { useState, useEffect, useMemo } from 'react';
import { 
  CalendarDays, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw, 
  CheckCircle2, 
  Circle, 
  Clock, 
  ExternalLink,
  BookOpen,
  Calendar as CalendarIcon,
  X,
  TrendingUp
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Card, Button, Badge, MetricCard } from '../components/ui';
import { buildQConcursosUrl } from '../services/mapEditalToQconcursos';
import { DIA_SEMANA_MAP, formatarDataISO } from '../services/calendarScheduler';
import { Topico, ItemCronograma } from '../types';

interface CalendarioEstudoPageProps {
  onNavigateToEdital?: () => void;
  onNavigateToRitmo?: () => void;
}

const DIAS_SEMANA_HEADER = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

export const CalendarioEstudoPage: React.FC<CalendarioEstudoPageProps> = ({
  onNavigateToEdital,
  onNavigateToRitmo,
}) => {
  const { 
    editais, 
    topicos, 
    cronograma, 
    ritmoConfig, 
    gerarCronograma, 
    reagendarTopicosAtrasados,
    alternarConclusaoTopico 
  } = useAppStore();

  const editalAtivo = editais[0];
  const hoje = new Date();
  const hojeISO = formatarDataISO(hoje);

  // Mês exibido no calendário
  const [mesAtual, setMesAtual] = useState<Date>(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  const [isRecriando, setIsRecriando] = useState(false);

  // Ao abrir o calendário, executa o rollover automático de atrasos e gera se vazio
  useEffect(() => {
    if (topicos.length > 0) {
      if (cronograma.length === 0) {
        gerarCronograma();
      } else {
        reagendarTopicosAtrasados();
      }
    }
  }, []);

  const handleRecriarCronograma = () => {
    setIsRecriando(true);
    setTimeout(() => {
      gerarCronograma();
      setIsRecriando(false);
    }, 200);
  };

  // Mapas rápidos
  const topicosMap = useMemo(() => {
    const map = new Map<string, Topico>();
    topicos.forEach((t) => map.set(t.id, t));
    return map;
  }, [topicos]);

  const disciplinasMap = useMemo(() => {
    const map = new Map<string, string>();
    editalAtivo?.disciplinas.forEach((d) => map.set(d.id, d.nome));
    return map;
  }, [editalAtivo]);

  // Agrupamento de itens por data (YYYY-MM-DD)
  const itensPorData = useMemo(() => {
    const map = new Map<string, ItemCronograma[]>();
    cronograma.forEach((item) => {
      const lista = map.get(item.data) || [];
      lista.push(item);
      map.set(item.data, lista);
    });
    // Ordenar itens dentro de cada dia pela ordem
    map.forEach((lista) => lista.sort((a, b) => a.ordem - b.ordem));
    return map;
  }, [cronograma]);

  // Navegação de mês
  const irParaMesAnterior = () => {
    setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() - 1, 1));
  };

  const irParaProximoMes = () => {
    setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 1));
  };

  const irParaMesHoje = () => {
    setMesAtual(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  };

  // Montagem da grade do mês exibido
  const ano = mesAtual.getFullYear();
  const mes = mesAtual.getMonth(); // 0-indexado
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay(); // 0 = dom, 1 = seg...
  // Ajuste para começar em Segunda (0 = seg, 6 = dom)
  const offsetSegunda = (primeiroDiaSemana + 6) % 7;

  const totalDiasMes = new Date(ano, mes + 1, 0).getDate();

  const diasGrade: Array<{ dataISO: string; diaNumero: number; isOutroMes: boolean }> = [];

  // Dias em branco / mês anterior
  const diasMesAnterior = new Date(ano, mes, 0).getDate();
  for (let i = offsetSegunda - 1; i >= 0; i--) {
    const diaNum = diasMesAnterior - i;
    const d = new Date(ano, mes - 1, diaNum);
    diasGrade.push({ dataISO: formatarDataISO(d), diaNumero: diaNum, isOutroMes: true });
  }

  // Dias do mês atual
  for (let d = 1; d <= totalDiasMes; d++) {
    const dataObj = new Date(ano, mes, d);
    diasGrade.push({ dataISO: formatarDataISO(dataObj), diaNumero: d, isOutroMes: false });
  }

  // Completar dias para fechar semanas inteiras (múltiplo de 7)
  const resto = diasGrade.length % 7;
  if (resto > 0) {
    const faltam = 7 - resto;
    for (let d = 1; d <= faltam; d++) {
      const dataObj = new Date(ano, mes + 1, d);
      diasGrade.push({ dataISO: formatarDataISO(dataObj), diaNumero: d, isOutroMes: true });
    }
  }

  // Métricas do Mês Exibido
  const prefixoMes = `${ano}-${String(mes + 1).padStart(2, '0')}`;
  const itensDoMes = useMemo(() => {
    return cronograma.filter((item) => item.data.startsWith(prefixoMes));
  }, [cronograma, prefixoMes]);

  const topicosConcluidosNoMes = useMemo(() => {
    return itensDoMes.filter((item) => topicosMap.get(item.topicoId)?.concluido).length;
  }, [itensDoMes, topicosMap]);

  const nomeMesExtenso = mesAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  // Tópicos do dia selecionado no modal
  const itensDoDiaSelecionado = diaSelecionado ? itensPorData.get(diaSelecionado) || [] : [];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="neutral" className="font-mono text-caption">
              Cronograma Automático do Edital
            </Badge>
            {editalAtivo && (
              <span className="text-caption font-mono text-text-secondary">
                {editalAtivo.concurso} • {editalAtivo.cargo}
              </span>
            )}
          </div>
          <h1 className="text-h1 text-text-primary tracking-tight flex items-center gap-2.5">
            <CalendarDays className="w-7 h-7 text-accent-success" />
            Calendário de Estudos
          </h1>
          <p className="text-body text-text-secondary max-w-2xl">
            Tópicos distribuídos automaticamente por peso fixo e horas disponíveis. Se um tópico atrasar, ele migra para o próximo dia da disciplina.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {onNavigateToEdital && (
            <Button
              variant="secondary"
              size="md"
              onClick={onNavigateToEdital}
              icon={<BookOpen className="w-4 h-4" />}
            >
              Edital & Matérias
            </Button>
          )}
          <Button
            variant="primary"
            size="md"
            onClick={handleRecriarCronograma}
            disabled={isRecriando || topicos.length === 0}
            icon={<RefreshCw className={`w-4 h-4 ${isRecriando ? 'animate-spin' : ''}`} />}
          >
            {isRecriando ? 'Recriando...' : 'Recriar cronograma'}
          </Button>
          {onNavigateToRitmo && (
            <Button
              variant="secondary"
              size="md"
              onClick={onNavigateToRitmo}
              icon={<Clock className="w-4 h-4" />}
            >
              Ajustar Horas
            </Button>
          )}
        </div>
      </div>

      {/* Cards de Métricas do Mês */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Tópicos Agendados no Mês"
          value={itensDoMes.length}
          context={`distribuídos em ${nomeMesExtenso}`}
          badge={<Badge variant="success">Em andamento</Badge>}
          icon={<CalendarIcon className="w-4 h-4" />}
        />

        <MetricCard
          label="Concluídos no Mês"
          value={`${topicosConcluidosNoMes} / ${itensDoMes.length}`}
          context={itensDoMes.length > 0 ? `${Math.round((topicosConcluidosNoMes / itensDoMes.length) * 100)}% de conclusão` : 'Sem tarefas'}
          badge={<Badge variant={topicosConcluidosNoMes === itensDoMes.length && itensDoMes.length > 0 ? 'success' : 'neutral'}>Mês</Badge>}
          icon={<CheckCircle2 className="w-4 h-4" />}
        />

        <MetricCard
          label="Total no Cronograma"
          value={cronograma.length}
          context="tópicos distribuídos no total"
          badge={<Badge variant="neutral">Completo</Badge>}
          icon={<TrendingUp className="w-4 h-4" />}
        />

        <MetricCard
          label="Tópicos Restantes no Edital"
          value={topicos.filter((t) => !t.concluido).length}
          context={`de um total de ${topicos.length}`}
          badge={<Badge variant="warning">Pendentes</Badge>}
          icon={<Clock className="w-4 h-4" />}
        />
      </div>

      {/* Barra de Navegação do Mês */}
      <Card variant="default" padding="md" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-border pb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-h2 font-bold text-text-primary capitalize">
              {nomeMesExtenso}
            </h2>
            <Button
              variant="secondary"
              size="sm"
              onClick={irParaMesHoje}
              className="text-caption font-mono"
            >
              Hoje
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={irParaMesAnterior}
              title="Mês Anterior"
              className="p-1.5 rounded-lg border border-surface-border text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={irParaProximoMes}
              title="Próximo Mês"
              className="p-1.5 rounded-lg border border-surface-border text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Grade do Calendário */}
        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            {/* Header com os Dias da Semana */}
            <div className="grid grid-cols-7 gap-1 text-center mb-1 font-mono text-caption uppercase tracking-wider text-text-secondary font-semibold">
              {DIAS_SEMANA_HEADER.map((dia) => (
                <div key={dia} className="py-1">
                  {dia.slice(0, 3)}
                </div>
              ))}
            </div>

            {/* Células dos Dias */}
            <div className="grid grid-cols-7 gap-1.5">
              {diasGrade.map(({ dataISO, diaNumero, isOutroMes }) => {
                const itensDia = itensPorData.get(dataISO) || [];
                const isHoje = dataISO === hojeISO;
                const diaObj = new Date(dataISO + 'T00:00:00');
                const chaveDia = DIA_SEMANA_MAP[diaObj.getDay()];
                const horasDia = ritmoConfig?.disponibilidade?.[chaveDia] ?? 0;

                const todosConcluidos = itensDia.length > 0 && itensDia.every((it) => topicosMap.get(it.topicoId)?.concluido);

                return (
                  <div
                    key={dataISO}
                    onClick={() => {
                      if (itensDia.length > 0) setDiaSelecionado(dataISO);
                    }}
                    className={`min-h-[110px] p-2 rounded-2xl border transition-all flex flex-col justify-between ${
                      isOutroMes
                        ? 'opacity-25 bg-black/20 border-white/5'
                        : isHoje
                        ? 'bg-[#00e676]/5 border-[#00e676]/50 shadow-[0_0_15px_rgba(0,230,118,0.15)]'
                        : 'glass-card border-white/5 hover:border-white/20'
                    } ${itensDia.length > 0 ? 'cursor-pointer hover:scale-[1.01]' : ''}`}
                  >
                    {/* Topo do dia: Número e Horas Disponíveis */}
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-caption font-mono font-bold inline-flex items-center justify-center w-6 h-6 rounded-full ${
                          isHoje ? 'bg-gradient-to-b from-[#00f584] to-[#00b355] text-[#031d10] font-black shadow-[0_0_8px_#00e676]' : 'text-text-primary'
                        }`}
                      >
                        {diaNumero}
                      </span>

                      <span className="text-[10px] font-mono text-text-muted">
                        {horasDia > 0 ? `${horasDia}h` : 'Folga'}
                      </span>
                    </div>

                    {/* Lista dos tópicos agendados para o dia */}
                    <div className="space-y-1 flex-1 overflow-hidden">
                      {itensDia.slice(0, 2).map((item) => {
                        const t = topicosMap.get(item.topicoId);
                        const discNome = disciplinasMap.get(item.disciplinaId);
                        const isConcluido = t?.concluido;

                        return (
                          <div
                            key={item.id}
                            className={`p-1.5 rounded-lg text-[11px] leading-tight border transition-colors flex items-center justify-between gap-1 ${
                              isConcluido
                                ? 'bg-[#00e676]/10 border-[#00e676]/30 text-[#00e676] line-through'
                                : 'glass-pill text-text-primary border-white/5'
                            }`}
                            title={`${discNome || ''}: ${t?.nome || ''} (Peso ${t?.peso || 1})`}
                          >
                            <span className="truncate flex-1 font-medium">
                              {t?.nome || 'Tópico'}
                            </span>
                            <span className="text-[9px] font-mono opacity-70 flex-shrink-0">
                              P{t?.peso || 1}
                            </span>
                          </div>
                        );
                      })}

                      {itensDia.length > 2 && (
                        <div className="text-[10px] font-mono text-accent-success font-semibold text-center pt-0.5">
                          +{itensDia.length - 2} mais...
                        </div>
                      )}
                    </div>

                    {/* Rodapé da célula do dia */}
                    {itensDia.length > 0 && (
                      <div className="mt-1 pt-1 border-t border-surface-border/50 flex items-center justify-between text-[10px] font-mono text-text-secondary">
                        <span>{itensDia.length} tópicos</span>
                        {todosConcluidos ? (
                          <span className="text-accent-success">✓ Feito</span>
                        ) : (
                          <span className="text-accent-warning">• Pendente</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      {/* Modal / Detalhes do Dia Selecionado */}
      {diaSelecionado && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card variant="elevated" padding="lg" className="max-w-xl w-full max-h-[90vh] flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <div>
                <Badge variant="neutral" className="font-mono text-caption mb-1">
                  Dia do Cronograma
                </Badge>
                <h3 className="text-h2 text-text-primary font-bold">
                  {new Date(diaSelecionado + 'T00:00:00').toLocaleDateString('pt-BR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </h3>
              </div>
              <button
                onClick={() => setDiaSelecionado(null)}
                className="p-1.5 text-text-secondary hover:text-text-primary rounded-lg hover:bg-surface-elevated transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {itensDoDiaSelecionado.map((item, idx) => {
                const topico = topicosMap.get(item.topicoId);
                const discNome = disciplinasMap.get(item.disciplinaId);
                const isConcluido = topico?.concluido;

                return (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isConcluido
                        ? 'bg-surface-card border-accent-success/30'
                        : 'bg-surface border-surface-border'
                    }`}
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => topico && alternarConclusaoTopico(topico.id)}
                        className="mt-0.5 text-text-secondary hover:text-accent-success transition-colors flex-shrink-0"
                        title={isConcluido ? 'Desmarcar conclusão' : 'Marcar como concluído'}
                      >
                        {isConcluido ? (
                          <CheckCircle2 className="w-5 h-5 text-accent-success" />
                        ) : (
                          <Circle className="w-5 h-5 text-text-secondary/50" />
                        )}
                      </button>

                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-caption font-mono font-bold text-accent-success">
                            #{idx + 1}
                          </span>
                          <Badge variant="neutral" className="text-caption font-mono">
                            {discNome || 'Disciplina'}
                          </Badge>
                          <span className="text-caption font-mono text-text-secondary">
                            Peso {topico?.peso || 1}
                          </span>
                        </div>
                        <h4
                          className={`text-body font-semibold ${
                            isConcluido ? 'line-through text-text-secondary' : 'text-text-primary'
                          }`}
                        >
                          {topico?.nome || 'Tópico'}
                        </h4>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 justify-end">
                      {topico?.qconcursosFiltro && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            const url = buildQConcursosUrl(topico.qconcursosFiltro!);
                            window.open(url, '_blank', 'noopener,noreferrer');
                          }}
                          icon={<ExternalLink className="w-3.5 h-3.5 text-accent-success" />}
                        >
                          Resolver questões
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-surface-border pt-3 flex justify-end">
              <Button variant="secondary" size="md" onClick={() => setDiaSelecionado(null)}>
                Fechar
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

import React, { useMemo } from 'react';
import { 
  Clock, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Flame, 
  Sparkles,
  TrendingUp
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Card, Badge, MetricCard } from './ui';
import { DisponibilidadeSemanal } from '../types';

interface RitmoEstudoWidgetProps {
  compact?: boolean;
}

const DIAS_SEMANA: { key: keyof DisponibilidadeSemanal; label: string; abrev: string }[] = [
  { key: 'segunda', label: 'Segunda-feira', abrev: 'SEG' },
  { key: 'terca', label: 'Terça-feira', abrev: 'TER' },
  { key: 'quarta', label: 'Quarta-feira', abrev: 'QUA' },
  { key: 'quinta', label: 'Quinta-feira', abrev: 'QUI' },
  { key: 'sexta', label: 'Sexta-feira', abrev: 'SEX' },
  { key: 'sabado', label: 'Sábado', abrev: 'SÁB' },
  { key: 'domingo', label: 'Domingo', abrev: 'DOM' },
];

export const RitmoEstudoWidget: React.FC<RitmoEstudoWidgetProps> = ({ compact = false }) => {
  const { topicos, ritmoConfig, atualizarRitmoConfig } = useAppStore();

  const disponibilidade = ritmoConfig?.disponibilidade || {
    segunda: 3,
    terca: 3,
    quarta: 3,
    quinta: 3,
    sexta: 3,
    sabado: 4,
    domingo: 1,
  };

  const tempoMedioMinutos = ritmoConfig?.tempoMedioMinutosPorTopico ?? 45;

  // 1. Tópicos restantes (concluido: false)
  const totalTopicos = topicos.length;
  const topicosConcluidos = useMemo(() => topicos.filter(t => t.concluido).length, [topicos]);
  const topicosRestantes = totalTopicos - topicosConcluidos;

  // 2. Horas disponíveis por semana (soma dos 7 campos)
  const horasSemanais = useMemo(() => {
    return (
      (Number(disponibilidade.segunda) || 0) +
      (Number(disponibilidade.terca) || 0) +
      (Number(disponibilidade.quarta) || 0) +
      (Number(disponibilidade.quinta) || 0) +
      (Number(disponibilidade.sexta) || 0) +
      (Number(disponibilidade.sabado) || 0) +
      (Number(disponibilidade.domingo) || 0)
    );
  }, [disponibilidade]);

  // 3. Tempo total necessário = tópicos restantes * tempo médio por tópico
  const tempoTotalMinutos = topicosRestantes * tempoMedioMinutos;
  const tempoTotalHoras = tempoTotalMinutos / 60;

  // 4. Semanas e dias necessários = tempo total necessário ÷ horas disponíveis por semana
  const semanasNecessarias = horasSemanais > 0 ? tempoTotalHoras / horasSemanais : 0;
  const diasNecessarios = horasSemanais > 0 ? Math.ceil(semanasNecessarias * 7) : 0;

  // 5. Data estimada de conclusão (hoje + X dias)
  const dataEstimadaConclusao = useMemo(() => {
    if (topicosRestantes === 0) return 'Concluído';
    if (horasSemanais <= 0) return null;
    const data = new Date();
    data.setDate(data.getDate() + diasNecessarios);
    return data.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }, [diasNecessarios, horasSemanais, topicosRestantes]);

  const handleDiaChange = (dia: keyof DisponibilidadeSemanal, valorStr: string) => {
    const val = valorStr === '' ? 0 : Math.max(0, Math.min(24, parseFloat(valorStr) || 0));
    atualizarRitmoConfig({
      disponibilidade: {
        ...disponibilidade,
        [dia]: val,
      },
    });
  };

  const handleTempoMedioChange = (valorStr: string) => {
    const val = valorStr === '' ? 1 : Math.max(1, Math.min(600, parseInt(valorStr, 10) || 1));
    atualizarRitmoConfig({
      tempoMedioMinutosPorTopico: val,
    });
  };

  return (
    <Card variant="elevated" padding={compact ? 'md' : 'lg'} className="space-y-6">
      {/* Cabeçalho do Widget */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-border pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-surface-elevated border border-surface-border text-accent-success">
              <Clock className="w-4 h-4" />
            </span>
            <h2 className="text-h2 text-text-primary font-semibold">
              Ritmo de Estudo
            </h2>
            <Badge variant="neutral" className="font-mono text-caption">
              Calculadora Aritmética
            </Badge>
          </div>
          <p className="text-caption text-text-secondary">
            Projeção linear baseada nos tópicos restantes do edital e na sua carga horária semanal.
          </p>
        </div>

        {/* Status de Tópicos Restantes */}
        <div className="flex items-center gap-2">
          <Badge 
            variant={topicosRestantes === 0 ? 'success' : 'neutral'} 
            className="font-mono text-caption px-3 py-1"
          >
            {topicosRestantes === 0 ? (
              <span className="flex items-center gap-1.5 text-accent-success font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" /> Edital 100% Concluído
              </span>
            ) : (
              <span>
                Faltam <strong className="text-text-primary">{topicosRestantes}</strong> de {totalTopicos} tópicos
              </span>
            )}
          </Badge>
        </div>
      </div>

      {/* Inputs: 7 Dias da Semana + Tempo Médio por Tópico */}
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-caption font-medium uppercase tracking-wider text-text-secondary font-mono flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Horas Disponíveis por Dia da Semana (Segunda a Domingo)
            </label>
            <span className="text-caption font-mono text-text-primary font-medium">
              Total: <strong className="text-accent-success">{horasSemanais}h</strong> / semana
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
            {DIAS_SEMANA.map(({ key, label, abrev }) => (
              <div 
                key={key} 
                className="bg-surface-elevated border border-surface-border rounded-lg p-2 text-center transition-colors focus-within:border-accent-success"
              >
                <span className="block text-[11px] font-mono text-text-secondary font-semibold uppercase mb-1" title={label}>
                  {abrev}
                </span>
                <div className="flex items-center justify-center gap-1">
                  <input
                    type="number"
                    min="0"
                    max="24"
                    step="0.5"
                    value={disponibilidade[key]}
                    onChange={(e) => handleDiaChange(key, e.target.value)}
                    className="w-14 bg-surface text-center font-mono text-body font-bold text-text-primary rounded border border-surface-border px-1 py-1 focus:outline-none focus:border-accent-success transition-colors"
                  />
                  <span className="text-caption font-mono text-text-secondary">h</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Input de Tempo Médio por Tópico */}
        <div className="p-3.5 bg-surface border border-surface-border rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <span className="text-caption font-semibold text-text-primary block font-mono">
              Tempo Médio por Tópico (Minutos)
            </span>
            <p className="text-caption text-text-secondary">
              Duração estimada para estudar a teoria e resolver a bateria de questões de cada tópico (padrão: 45 min).
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <input
              type="number"
              min="5"
              max="360"
              step="5"
              value={tempoMedioMinutos}
              onChange={(e) => handleTempoMedioChange(e.target.value)}
              className="w-20 bg-surface-elevated text-center font-mono text-body font-bold text-text-primary rounded-lg border border-surface-border px-2 py-1.5 focus:outline-none focus:border-accent-success transition-colors"
            />
            <span className="text-caption font-mono text-text-secondary font-medium">
              minutos / tópico
            </span>
          </div>
        </div>
      </div>

      {/* Resultados do Cálculo Aritmético */}
      <div className="space-y-3 pt-2">
        {topicosRestantes === 0 ? (
          <div className="p-4 rounded-xl bg-accent-success/10 border border-accent-success/30 text-accent-success flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-body">Parabéns! Todos os tópicos foram marcados como concluídos!</h4>
              <p className="text-caption opacity-90">
                Você já cobriu todos os {totalTopicos} tópicos do conteúdo programático do edital.
              </p>
            </div>
          </div>
        ) : horasSemanais === 0 ? (
          <div className="p-4 rounded-xl bg-accent-warning/10 border border-accent-warning/30 text-accent-warning flex items-center gap-3">
            <AlertCircle className="w-6 h-6 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-body">Disponibilidade semanal zerada</h4>
              <p className="text-caption opacity-90">
                Informe ao menos 1 hora em qualquer dia da semana para calcular os dias e a data estimada de conclusão.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Bloco Principal de Destaque com o Texto Solicitado */}
            <div className="p-4 rounded-xl bg-surface border border-accent-success/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-accent-success/5 rounded-full blur-2xl pointer-events-none" />
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-accent-success" />
                    <span className="text-caption font-mono text-accent-success font-semibold uppercase tracking-wider">
                      Projeção Linear do Edital
                    </span>
                  </div>

                  {/* Texto principal exigido */}
                  <h3 className="text-h2 text-text-primary font-bold">
                    <strong className="text-accent-success">{diasNecessarios} dias</strong> necessários para fechar o edital com sua disponibilidade atual
                  </h3>

                  <p className="text-caption text-text-secondary font-mono">
                    Aproximadamente <strong>{semanasNecessarias.toFixed(1)} semanas</strong> de dedicação com {horasSemanais}h/semana.
                  </p>
                </div>

                <div className="bg-surface-elevated border border-surface-border-elevated rounded-lg p-3 sm:text-right flex-shrink-0">
                  <span className="text-[11px] font-mono text-text-secondary uppercase tracking-wider block">
                    Data Estimada de Conclusão
                  </span>
                  <span className="text-h3 font-mono font-bold text-accent-success block mt-0.5">
                    {dataEstimadaConclusao}
                  </span>
                  <span className="text-[11px] font-mono text-text-secondary/70">
                    (hoje + {diasNecessarios} dias)
                  </span>
                </div>
              </div>
            </div>

            {/* Grid de Detalhamento das 4 Métricas Chave */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard
                label="Tópicos Restantes"
                value={'faltam ' + topicosRestantes}
                context={'de ' + totalTopicos + ' tópicos no edital'}
                badge={<Badge variant="warning">{Math.round((topicosRestantes / (totalTopicos || 1)) * 100)}% restante</Badge>}
                icon={<Clock className="w-4 h-4" />}
              />

              <MetricCard
                label="Tempo Total Necessário"
                value={tempoTotalHoras.toFixed(1) + 'h'}
                context={tempoTotalMinutos.toLocaleString('pt-BR') + ' minutos totais'}
                badge={<Badge variant="neutral">{tempoMedioMinutos}m / tópico</Badge>}
                icon={<TrendingUp className="w-4 h-4" />}
              />

              <MetricCard
                label="Horas por Semana"
                value={horasSemanais + 'h'}
                context="soma dos 7 dias da semana"
                badge={<Badge variant="success">{(horasSemanais / 7).toFixed(1)}h / dia médio</Badge>}
                icon={<Calendar className="w-4 h-4" />}
              />

              <MetricCard
                label="Semanas Estimadas"
                value={semanasNecessarias.toFixed(1)}
                context={diasNecessarios + ' dias corridos'}
                badge={<Badge variant="success">Projeção</Badge>}
                icon={<Sparkles className="w-4 h-4" />}
              />
            </div>
          </>
        )}
      </div>
    </Card>
  );
};

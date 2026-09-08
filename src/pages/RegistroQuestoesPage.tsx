import React, { useState, useMemo } from 'react';
import { 
  CheckSquare, 
  PlusCircle, 
  Trash2, 
  Calendar, 
  BookOpen, 
  CheckCircle2, 
  Percent, 
  Target 
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Card, Button, Badge, MetricCard } from '../components/ui';

interface RegistroQuestoesPageProps {
  initialTopicoId?: string;
}

export const RegistroQuestoesPage: React.FC<RegistroQuestoesPageProps> = ({ initialTopicoId }) => {
  const { 
    editais, 
    topicos, 
    registrosQuestoes, 
    adicionarRegistroQuestoes, 
    removerRegistroQuestoes 
  } = useAppStore();

  const edital = editais[0];
  const getTodayDate = () => new Date().toISOString().split('T')[0];

  // Estados do Formulário
  const [topicoId, setTopicoId] = useState<string>(initialTopicoId || '');
  const [quantidade, setQuantidade] = useState<number | ''>('');
  const [acertos, setAcertos] = useState<number | ''>('');
  const [data, setData] = useState<string>(getTodayDate());
  const [formError, setFormError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Mapa de topicoId -> { topicoNome, disciplinaNome }
  const topicoMap = useMemo(() => {
    const map = new Map<string, { topicoNome: string; disciplinaId: string; disciplinaNome: string }>();
    if (!edital) return map;

    const discMap = new Map<string, string>();
    edital.disciplinas.forEach(d => discMap.set(d.id, d.nome));

    topicos.forEach(t => {
      map.set(t.id, {
        topicoNome: t.nome,
        disciplinaId: t.disciplinaId,
        disciplinaNome: discMap.get(t.disciplinaId) || 'Disciplina não identificada',
      });
    });

    return map;
  }, [edital, topicos]);

  // Submissão do Formulário
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setShowSuccess(false);

    if (!topicoId) {
      setFormError('Por favor, selecione o tópico correspondente.');
      return;
    }

    const qtdNum = Number(quantidade);
    const acertosNum = Number(acertos);

    if (isNaN(qtdNum) || qtdNum <= 0) {
      setFormError('Informe uma quantidade de questões válida (maior que 0).');
      return;
    }

    if (isNaN(acertosNum) || acertosNum < 0) {
      setFormError('Informe uma quantidade de acertos válida (maior ou igual a 0).');
      return;
    }

    if (acertosNum > qtdNum) {
      setFormError('A quantidade de acertos não pode ser maior que a quantidade de questões respondidas.');
      return;
    }

    adicionarRegistroQuestoes({
      topicoId,
      quantidade: qtdNum,
      acertos: acertosNum,
      data: data || getTodayDate(),
    });

    // Feedback e limpeza
    setShowSuccess(true);
    setQuantidade('');
    setAcertos('');
    setTimeout(() => setShowSuccess(false), 4000);
  };

  // Cálculos de métricas globais
  const totalQuestoes = registrosQuestoes.reduce((acc, r) => acc + r.quantidade, 0);
  const totalAcertos = registrosQuestoes.reduce((acc, r) => acc + r.acertos, 0);
  const percentualGeral = totalQuestoes > 0 ? Math.round((totalAcertos / totalQuestoes) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <Card variant="elevated" padding="lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="success">REGISTRO DE DESEMPENHO</Badge>
              {edital && (
                <span className="text-caption font-mono text-text-secondary">
                  Edital: {edital.concurso}
                </span>
              )}
            </div>
            <h1 className="text-h1 text-text-primary tracking-tight">
              Registrar Questões Resolvidas
            </h1>
            <p className="text-body text-text-secondary mt-1">
              Informe a quantidade de questões respondidas e acertos por tópico para acompanhar seu índice de aproveitamento.
            </p>
          </div>
        </div>
      </Card>

      {/* Métricas Gerais */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          label="Questões Resolvidas"
          value={totalQuestoes}
          context="Total acumulado"
          icon={<Target className="w-4 h-4 text-accent-success" />}
        />
        <MetricCard
          label="Total de Acertos"
          value={totalAcertos}
          context={`${totalQuestoes - totalAcertos} erros registrados`}
          icon={<CheckCircle2 className="w-4 h-4 text-accent-success" />}
        />
        <MetricCard
          label="Aproveitamento Geral"
          value={`${percentualGeral}%`}
          context="Média ponderada do edital"
          badge={
            percentualGeral >= 80 ? (
              <Badge variant="success">Excelente</Badge>
            ) : percentualGeral >= 60 ? (
              <Badge variant="warning">Em evolução</Badge>
            ) : totalQuestoes === 0 ? (
              <Badge variant="neutral">Sem dados</Badge>
            ) : (
              <Badge variant="critical">Atenção</Badge>
            )
          }
          icon={<Percent className="w-4 h-4" />}
        />
      </div>

      {/* Formulário de Registro */}
      <Card variant="default" padding="lg" className="border-accent-success/30 shadow-xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="border-b border-surface-border pb-3 flex items-center justify-between">
            <h2 className="text-h2 text-text-primary flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-accent-success" />
              Nova Sessão de Questões
            </h2>
            <span className="text-caption text-text-secondary">Preencha os dados da bateria</span>
          </div>

          {formError && (
            <div className="p-3 bg-surface border border-accent-critical/40 rounded-lg text-caption text-accent-critical font-mono">
              ⚠️ {formError}
            </div>
          )}

          {showSuccess && (
            <div className="p-3 bg-surface border border-accent-success/40 rounded-lg text-caption text-accent-success font-mono">
              ✓ Questões registradas e aproveitamento atualizado com sucesso!
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Seleção do Tópico do Edital */}
            <div className="md:col-span-2">
              <label className="block text-caption font-medium uppercase tracking-wider text-text-secondary mb-1.5">
                Tópico do Edital *
              </label>
              {topicos.length === 0 ? (
                <div className="text-caption text-accent-warning p-2.5 bg-surface border border-surface-border rounded-lg">
                  Nenhum tópico encontrado. Importe ou estruture um edital primeiro.
                </div>
              ) : (
                <select
                  value={topicoId}
                  onChange={e => setTopicoId(e.target.value)}
                  className="w-full bg-surface border border-surface-border text-text-primary px-3 py-2 rounded-lg text-body focus:border-accent-success focus:outline-none transition-colors"
                >
                  <option value="">Selecione o tópico correspondente...</option>
                  {edital?.disciplinas.map(disc => {
                    const topicosDisc = topicos.filter(t => t.disciplinaId === disc.id);
                    if (topicosDisc.length === 0) return null;
                    return (
                      <optgroup key={disc.id} label={disc.nome}>
                        {topicosDisc.map(t => (
                          <option key={t.id} value={t.id}>
                            {t.nome}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              )}
            </div>

            {/* Data do Treino */}
            <div>
              <label className="block text-caption font-medium uppercase tracking-wider text-text-secondary mb-1.5">
                Data
              </label>
              <input
                type="date"
                value={data}
                onChange={e => setData(e.target.value)}
                className="w-full bg-surface border border-surface-border text-text-primary px-3 py-2 rounded-lg text-body focus:border-accent-success focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Quantidade de Questões */}
            <div>
              <label className="block text-caption font-medium uppercase tracking-wider text-text-secondary mb-1.5">
                Quantidade de Questões Respondidas *
              </label>
              <input
                type="number"
                min="1"
                step="1"
                placeholder="Ex: 20"
                value={quantidade}
                onChange={e => setQuantidade(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                className="w-full bg-surface border border-surface-border text-text-primary px-3 py-2 rounded-lg text-body font-mono focus:border-accent-success focus:outline-none transition-colors"
              />
            </div>

            {/* Quantidade de Acertos */}
            <div>
              <label className="block text-caption font-medium uppercase tracking-wider text-text-secondary mb-1.5">
                Quantidade de Acertos *
              </label>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="Ex: 17"
                value={acertos}
                onChange={e => setAcertos(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                className="w-full bg-surface border border-surface-border text-text-primary px-3 py-2 rounded-lg text-body font-mono focus:border-accent-success focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Pré-visualização do aproveitamento desta sessão */}
          {quantidade !== '' && acertos !== '' && Number(quantidade) > 0 && Number(acertos) <= Number(quantidade) && (
            <div className="p-3 bg-surface rounded-lg border border-surface-border flex items-center justify-between">
              <span className="text-caption text-text-secondary">Aproveitamento da sessão:</span>
              <span className="text-body font-mono font-semibold text-accent-success">
                {Math.round((Number(acertos) / Number(quantidade)) * 100)}% ({acertos}/{quantidade})
              </span>
            </div>
          )}

          {/* Ação */}
          <div className="flex items-center justify-end pt-2">
            <Button
              variant="primary"
              size="md"
              type="submit"
              disabled={topicos.length === 0}
              icon={<CheckCircle2 className="w-4 h-4" />}
            >
              Salvar Registro
            </Button>
          </div>
        </form>
      </Card>

      {/* Histórico de Registros */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-h2 text-text-primary flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-accent-success" />
            Histórico de Sessões Registradas
          </h2>
          <Badge variant="neutral" className="text-caption font-mono">
            {registrosQuestoes.length} {registrosQuestoes.length === 1 ? 'registro' : 'registros'}
          </Badge>
        </div>

        {registrosQuestoes.length === 0 ? (
          <Card variant="default" padding="lg" className="text-center py-10 space-y-2">
            <div className="w-12 h-12 rounded-full bg-surface-elevated border border-surface-border mx-auto flex items-center justify-center text-text-secondary">
              <BookOpen className="w-6 h-6" />
            </div>
            <h3 className="text-h2 text-text-primary">Nenhum registro ainda</h3>
            <p className="text-body text-text-secondary max-w-md mx-auto">
              Após resolver uma bateria no QConcursos ou em simulados, registre o resultado acima para atualizar o aproveitamento do edital.
            </p>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {registrosQuestoes.map(reg => {
              const info = topicoMap.get(reg.topicoId);
              const taxa = reg.quantidade > 0 ? Math.round((reg.acertos / reg.quantidade) * 100) : 0;

              return (
                <Card
                  key={reg.id}
                  variant="default"
                  padding="md"
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-surface-card hover:border-surface-border-elevated transition-colors"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="neutral" className="text-caption font-mono">
                        {info?.disciplinaNome || 'Disciplina'}
                      </Badge>
                      <span className="text-caption font-mono text-text-secondary flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {reg.data}
                      </span>
                    </div>
                    <p className="text-body text-text-primary font-medium truncate">
                      {info?.topicoNome || 'Tópico do edital'}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="text-right">
                      <div className="text-body font-mono font-bold text-accent-success">
                        {taxa}%
                      </div>
                      <div className="text-caption font-mono text-text-secondary">
                        {reg.acertos} / {reg.quantidade} acertos
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Tem certeza de que deseja remover este registro?')) {
                          removerRegistroQuestoes(reg.id);
                        }
                      }}
                      className="p-1.5 text-text-secondary hover:text-accent-critical rounded-lg hover:bg-surface-elevated transition-colors"
                      title="Remover registro"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

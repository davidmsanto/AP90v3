import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, 
  PlusCircle, 
  CheckCircle2, 
  Circle, 
  Trash2, 
  ExternalLink, 
  Filter, 
  BookOpen, 
  Calendar, 
  FileText, 
  Link as LinkIcon 
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Card, Button, Badge, MetricCard } from '../components/ui';

export const CadernoErros: React.FC = () => {
  const { 
    editais, 
    topicos, 
    errosRegistrados, 
    adicionarErro, 
    alternarRevisaoErro, 
    removerErro 
  } = useAppStore();

  const edital = editais[0];

  // Helper para a data de hoje (YYYY-MM-DD)
  const getTodayDate = () => new Date().toISOString().split('T')[0];

  // Estados do Formulário
  const [topicoId, setTopicoId] = useState<string>('');
  const [enunciadoOuLink, setEnunciadoOuLink] = useState('');
  const [nota, setNota] = useState('');
  const [data, setData] = useState(getTodayDate());
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Estados dos Filtros
  const [filtroDisciplina, setFiltroDisciplina] = useState<string>('todas');
  const [filtroTopico, setFiltroTopico] = useState<string>('todos');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'pendentes' | 'revisados'>('todos');

  // Mapa auxiliar de id do tópico -> dados do tópico e disciplina
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

    if (!topicoId) {
      setFormError('Por favor, selecione o tópico correspondente à questão.');
      return;
    }

    if (!enunciadoOuLink.trim()) {
      setFormError('Informe o enunciado ou o link da questão.');
      return;
    }

    adicionarErro({
      topicoId,
      enunciadoOuLink: enunciadoOuLink.trim(),
      nota: nota.trim(),
      data: data || getTodayDate(),
      revisado: false,
    });

    // Limpa formulário
    setEnunciadoOuLink('');
    setNota('');
    setData(getTodayDate());
    setShowForm(false);
  };

  // Filtragem dos erros
  const errosFiltrados = useMemo(() => {
    return errosRegistrados.filter(erro => {
      const topicoInfo = topicoMap.get(erro.topicoId);
      
      // Filtro de disciplina
      if (filtroDisciplina !== 'todas' && topicoInfo?.disciplinaId !== filtroDisciplina) {
        return false;
      }

      // Filtro de tópico
      if (filtroTopico !== 'todos' && erro.topicoId !== filtroTopico) {
        return false;
      }

      // Filtro de status
      if (filtroStatus === 'pendentes' && erro.revisado) return false;
      if (filtroStatus === 'revisados' && !erro.revisado) return false;

      return true;
    });
  }, [errosRegistrados, filtroDisciplina, filtroTopico, filtroStatus, topicoMap]);

  // Agrupamento por disciplina
  const errosAgrupadosPorDisciplina = useMemo(() => {
    const agrupado = new Map<string, { disciplinaNome: string; erros: typeof errosRegistrados }>();

    errosFiltrados.forEach(erro => {
      const info = topicoMap.get(erro.topicoId);
      const discId = info?.disciplinaId || 'outros';
      const discNome = info?.disciplinaNome || 'Geral / Sem Disciplina';

      if (!agrupado.has(discId)) {
        agrupado.set(discId, { disciplinaNome: discNome, erros: [] });
      }
      agrupado.get(discId)!.erros.push(erro);
    });

    return Array.from(agrupado.entries());
  }, [errosFiltrados, topicoMap]);

  // Métricas do Caderno de Erros
  const totalErros = errosRegistrados.length;
  const totalRevisados = errosRegistrados.filter(e => e.revisado).length;
  const totalPendentes = totalErros - totalRevisados;

  // Tópicos disponíveis para o filtro de tópico (respeitando a disciplina selecionada)
  const topicosParaFiltro = useMemo(() => {
    if (filtroDisciplina === 'todas') return topicos;
    return topicos.filter(t => t.disciplinaId === filtroDisciplina);
  }, [topicos, filtroDisciplina]);

  // Helper para verificar se uma string é URL válida
  const isUrl = (str: string) => {
    return /^https?:\/\//i.test(str.trim());
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header da Página */}
      <Card variant="elevated" padding="lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="warning">CADERNO DE ERROS</Badge>
              {edital && (
                <span className="text-caption font-mono text-text-secondary">
                  Edital: {edital.concurso}
                </span>
              )}
            </div>
            <h1 className="text-h1 text-text-primary tracking-tight">
              Registro e Revisão de Erros
            </h1>
            <p className="text-body text-text-secondary mt-1">
              Registre questões que você errou ou teve dúvida, anote a pegadinha e marque conforme revisa.
            </p>
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={() => setShowForm(!showForm)}
            icon={<PlusCircle className="w-4 h-4" />}
          >
            {showForm ? 'Fechar Formulário' : 'Novo Registro de Erro'}
          </Button>
        </div>
      </Card>

      {/* Métricas do Caderno */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          label="Erros Registrados"
          value={totalErros}
          context="Total no caderno"
          icon={<AlertTriangle className="w-4 h-4 text-accent-warning" />}
        />
        <MetricCard
          label="Pendentes de Revisão"
          value={totalPendentes}
          context="Aguardando fixação"
          badge={totalPendentes > 0 ? <Badge variant="warning">{totalPendentes}</Badge> : <Badge variant="success">Em dia</Badge>}
        />
        <MetricCard
          label="Revisados"
          value={totalRevisados}
          context={`${Math.round((totalRevisados / (totalErros || 1)) * 100)}% revisados`}
          badge={<Badge variant="success">{totalRevisados}</Badge>}
        />
      </div>

      {/* Formulário de Adicionar Erro */}
      {showForm && (
        <Card variant="default" padding="lg" className="border-accent-success/30 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="border-b border-surface-border pb-3 flex items-center justify-between">
              <h2 className="text-h2 text-text-primary flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-accent-success" />
                Registrar Nova Questão com Erro / Dúvida
              </h2>
              <span className="text-caption text-text-secondary">Preencha os campos abaixo</span>
            </div>

            {formError && (
              <div className="p-3 bg-surface border border-accent-critical/40 rounded-lg text-caption text-accent-critical font-mono">
                ⚠️ {formError}
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

              {/* Data do Erro */}
              <div>
                <label className="block text-caption font-medium uppercase tracking-wider text-text-secondary mb-1.5">
                  Data do Registro
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={data}
                    onChange={e => setData(e.target.value)}
                    className="w-full bg-surface border border-surface-border text-text-primary px-3 py-2 rounded-lg text-body focus:border-accent-success focus:outline-none transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Enunciado ou Link da Questão */}
            <div>
              <label className="block text-caption font-medium uppercase tracking-wider text-text-secondary mb-1.5 flex items-center justify-between">
                <span>Enunciado ou Link da Questão *</span>
                <span className="text-[11px] text-text-secondary lowercase font-normal">
                  (Cole o texto ou o link direto do QConcursos)
                </span>
              </label>
              <input
                type="text"
                value={enunciadoOuLink}
                onChange={e => setEnunciadoOuLink(e.target.value)}
                placeholder="Ex: https://www.qconcursos.com/questoes-de-concursos/questoes/... ou o texto do enunciado"
                className="w-full bg-surface border border-surface-border text-text-primary px-3 py-2 rounded-lg text-body placeholder:text-text-secondary/50 focus:border-accent-success focus:outline-none transition-colors"
              />
            </div>

            {/* Nota Pessoal */}
            <div>
              <label className="block text-caption font-medium uppercase tracking-wider text-text-secondary mb-1.5 flex items-center justify-between">
                <span>Nota Pessoal / Motivo do Erro</span>
                <span className="text-[11px] text-text-secondary lowercase font-normal">
                  (Pegadinha da banca, regra de exceção, conceito que passou batido)
                </span>
              </label>
              <textarea
                value={nota}
                onChange={e => setNota(e.target.value)}
                rows={3}
                placeholder="Ex: Cuidado com o prazo de 15 dias que na verdade é em dias úteis; banca tentou confundir com o art. 5º..."
                className="w-full bg-surface border border-surface-border text-text-primary px-3 py-2 rounded-lg text-body placeholder:text-text-secondary/50 focus:border-accent-success focus:outline-none transition-colors resize-y"
              />
            </div>

            {/* Ações do Formulário */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                size="md"
                type="button"
                onClick={() => setShowForm(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="md"
                type="submit"
                disabled={topicos.length === 0}
                icon={<CheckCircle2 className="w-4 h-4" />}
              >
                Salvar no Caderno
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Barra de Filtros */}
      <Card variant="default" padding="md" className="space-y-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-text-secondary text-caption font-mono uppercase tracking-wider">
            <Filter className="w-4 h-4 text-accent-success" />
            <span>Filtros do Caderno</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Filtro por Disciplina */}
            <select
              value={filtroDisciplina}
              onChange={e => {
                setFiltroDisciplina(e.target.value);
                setFiltroTopico('todos');
              }}
              className="bg-surface border border-surface-border text-text-primary px-2.5 py-1.5 rounded-lg text-caption focus:border-accent-success focus:outline-none"
            >
              <option value="todas">Todas as Disciplinas</option>
              {edital?.disciplinas.map(d => (
                <option key={d.id} value={d.id}>
                  {d.nome}
                </option>
              ))}
            </select>

            {/* Filtro por Tópico */}
            <select
              value={filtroTopico}
              onChange={e => setFiltroTopico(e.target.value)}
              className="bg-surface border border-surface-border text-text-primary px-2.5 py-1.5 rounded-lg text-caption focus:border-accent-success focus:outline-none max-w-[220px] truncate"
            >
              <option value="todos">Todos os Tópicos</option>
              {topicosParaFiltro.map(t => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>

            {/* Filtro por Status */}
            <div className="flex items-center border border-surface-border rounded-lg overflow-hidden bg-surface">
              <button
                type="button"
                onClick={() => setFiltroStatus('todos')}
                className={`px-2.5 py-1.5 text-caption transition-colors ${
                  filtroStatus === 'todos'
                    ? 'bg-surface-elevated text-accent-success font-medium'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Todos ({totalErros})
              </button>
              <button
                type="button"
                onClick={() => setFiltroStatus('pendentes')}
                className={`px-2.5 py-1.5 text-caption transition-colors border-l border-surface-border ${
                  filtroStatus === 'pendentes'
                    ? 'bg-surface-elevated text-accent-warning font-medium'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Pendentes ({totalPendentes})
              </button>
              <button
                type="button"
                onClick={() => setFiltroStatus('revisados')}
                className={`px-2.5 py-1.5 text-caption transition-colors border-l border-surface-border ${
                  filtroStatus === 'revisados'
                    ? 'bg-surface-elevated text-accent-success font-medium'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Revisados ({totalRevisados})
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Listagem de Erros Agrupada por Disciplina */}
      {errosAgrupadosPorDisciplina.length === 0 ? (
        <Card variant="default" padding="lg" className="text-center py-12 space-y-3">
          <div className="w-12 h-12 rounded-full bg-surface-elevated border border-surface-border mx-auto flex items-center justify-center text-text-secondary">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="text-h2 text-text-primary">Nenhum erro encontrado</h3>
          <p className="text-body text-text-secondary max-w-md mx-auto">
            {totalErros === 0
              ? 'Seu caderno de erros está limpo! Quando você errar uma questão nos simulados ou no QConcursos, registre-a aqui para consolidar o aprendizado.'
              : 'Nenhum erro corresponde aos filtros de disciplina e tópico selecionados.'}
          </p>
          {totalErros === 0 && (
            <div className="pt-2">
              <Button
                variant="primary"
                size="md"
                onClick={() => setShowForm(true)}
                icon={<PlusCircle className="w-4 h-4" />}
              >
                Adicionar primeiro erro
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <div className="space-y-6">
          {errosAgrupadosPorDisciplina.map(([discId, { disciplinaNome, erros }]) => (
            <div key={discId} className="space-y-3">
              {/* Header da Disciplina */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-accent-warning" />
                  <h2 className="text-h2 text-text-primary font-semibold">
                    {disciplinaNome}
                  </h2>
                  <Badge variant="neutral" className="text-caption font-mono">
                    {erros.length} {erros.length === 1 ? 'questão' : 'questões'}
                  </Badge>
                </div>
              </div>

              {/* Lista de Erros da Disciplina */}
              <div className="space-y-3">
                {erros.map(erro => {
                  const topicoInfo = topicoMap.get(erro.topicoId);
                  const isLink = isUrl(erro.enunciadoOuLink);

                  return (
                    <Card
                      key={erro.id}
                      variant="default"
                      padding="md"
                      className={`transition-all border ${
                        erro.revisado
                          ? 'border-surface-border bg-surface/60 opacity-80'
                          : 'border-surface-border hover:border-surface-border-elevated bg-surface-card'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-surface-border/60 pb-3">
                        {/* Tópico e Data */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-caption font-mono text-text-secondary bg-surface px-2 py-0.5 rounded border border-surface-border">
                            {topicoInfo?.topicoNome || 'Tópico do edital'}
                          </span>
                          <span className="text-caption text-text-secondary flex items-center gap-1 font-mono">
                            <Calendar className="w-3.5 h-3.5" />
                            {erro.data}
                          </span>
                        </div>

                        {/* Ações: Marcar como Revisado + Excluir */}
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                          <button
                            type="button"
                            onClick={() => alternarRevisaoErro(erro.id)}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-caption font-medium transition-all border ${
                              erro.revisado
                                ? 'bg-surface-elevated text-accent-success border-accent-success/40'
                                : 'bg-surface text-text-secondary border-surface-border hover:border-accent-success/50 hover:text-accent-success'
                            }`}
                            title="Clique para alternar o status de revisão"
                          >
                            {erro.revisado ? (
                              <>
                                <CheckCircle2 className="w-4 h-4 text-accent-success" />
                                <span>Revisado</span>
                              </>
                            ) : (
                              <>
                                <Circle className="w-4 h-4 text-text-secondary" />
                                <span>Marcar como revisado</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (confirm('Tem certeza de que deseja remover este erro do caderno?')) {
                                removerErro(erro.id);
                              }
                            }}
                            className="p-1.5 text-text-secondary hover:text-accent-critical rounded-lg hover:bg-surface-elevated transition-colors"
                            title="Excluir erro do caderno"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Corpo do Erro: Enunciado / Link */}
                      <div className="pt-3 space-y-2.5">
                        <div>
                          <span className="text-[11px] font-mono uppercase tracking-wider text-text-secondary block mb-1">
                            Questão / Enunciado
                          </span>
                          {isLink ? (
                            <a
                              href={erro.enunciadoOuLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-accent-success hover:underline text-body break-all font-mono"
                            >
                              <LinkIcon className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="truncate">{erro.enunciadoOuLink}</span>
                              <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                            </a>
                          ) : (
                            <p className="text-body text-text-primary whitespace-pre-wrap leading-relaxed">
                              {erro.enunciadoOuLink}
                            </p>
                          )}
                        </div>

                        {/* Nota Pessoal */}
                        {erro.nota && (
                          <div className="p-3 bg-surface rounded-lg border border-surface-border">
                            <span className="text-[11px] font-mono uppercase tracking-wider text-accent-warning block mb-1 flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              Nota Pessoal & Lição Aprendida
                            </span>
                            <p className="text-body text-text-primary/90 whitespace-pre-wrap leading-relaxed">
                              {erro.nota}
                            </p>
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

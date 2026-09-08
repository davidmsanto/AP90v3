import React, { useState, useMemo } from 'react';
import { 
  CheckCircle2, 
  Circle, 
  BookOpen, 
  Search, 
  CheckSquare
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Card, Button, Badge } from '../components/ui';
import { RitmoEstudoWidget } from '../components/RitmoEstudoWidget';

interface RitmoEstudoPageProps {
  onNavigateToEdital?: () => void;
  onNavigateToQuestoes?: () => void;
}

export const RitmoEstudoPage: React.FC<RitmoEstudoPageProps> = ({
  onNavigateToEdital,
  onNavigateToQuestoes,
}) => {
  const { editais, topicos, alternarConclusaoTopico } = useAppStore();
  const editalAtivo = editais[0];

  const [busca, setBusca] = useState('');
  const [filtroDisciplina, setFiltroDisciplina] = useState<string>('todas');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'concluidos' | 'pendentes'>('todos');

  // Filtragem memoizada
  const topicosFiltrados = useMemo(() => {
    return topicos.filter((t) => {
      if (filtroDisciplina !== 'todas' && t.disciplinaId !== filtroDisciplina) {
        return false;
      }
      if (filtroStatus === 'concluidos' && !t.concluido) {
        return false;
      }
      if (filtroStatus === 'pendentes' && t.concluido) {
        return false;
      }
      if (busca.trim()) {
        const query = busca.toLowerCase();
        return t.nome.toLowerCase().includes(query);
      }
      return true;
    });
  }, [topicos, filtroDisciplina, filtroStatus, busca]);

  const totalConcluidos = topicos.filter((t) => t.concluido).length;
  const totalTopicos = topicos.length;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="neutral" className="font-mono text-caption">
              Planejamento Temporal
            </Badge>
            {editalAtivo && (
              <span className="text-caption font-mono text-text-secondary">
                {editalAtivo.concurso} • {editalAtivo.cargo}
              </span>
            )}
          </div>
          <h1 className="text-h1 text-text-primary tracking-tight">
            Ritmo de Estudo
          </h1>
          <p className="text-body text-text-secondary max-w-2xl">
            Simule e acompanhe o tempo necessário para fechar o edital conforme a sua rotina real da semana.
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
              Ver Edital
            </Button>
          )}
          {onNavigateToQuestoes && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onNavigateToQuestoes}
              icon={<CheckSquare className="w-4 h-4" />}
            >
              Registrar Questões
            </Button>
          )}
        </div>
      </div>

      {/* Widget da Calculadora Aritmética de Ritmo */}
      <RitmoEstudoWidget />

      {/* Gerenciamento Rápido de Conclusão de Tópicos */}
      <Card variant="default" padding="lg" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-border pb-4">
          <div>
            <h2 className="text-h2 text-text-primary font-semibold flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-accent-success" />
              Controle de Conclusão dos Tópicos
            </h2>
            <p className="text-caption text-text-secondary">
              Marque os tópicos já estudados para atualizar a contagem de tópicos restantes em tempo real.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={totalConcluidos === totalTopicos && totalTopicos > 0 ? 'success' : 'neutral'}>
              {totalConcluidos} de {totalTopicos} concluídos ({totalTopicos > 0 ? Math.round((totalConcluidos / totalTopicos) * 100) : 0}%)
            </Badge>
          </div>
        </div>

        {/* Barra de Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar tópico por nome..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full bg-surface-elevated border border-surface-border text-text-primary pl-9 pr-3 py-2 rounded-lg text-body focus:border-accent-success focus:outline-none transition-colors"
            />
          </div>

          <select
            value={filtroDisciplina}
            onChange={(e) => setFiltroDisciplina(e.target.value)}
            className="bg-surface-elevated border border-surface-border text-text-primary px-3 py-2 rounded-lg text-body focus:border-accent-success focus:outline-none transition-colors"
          >
            <option value="todas">Todas as Disciplinas</option>
            {editalAtivo?.disciplinas.map((disc) => (
              <option key={disc.id} value={disc.id}>
                {disc.nome}
              </option>
            ))}
          </select>

          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as any)}
            className="bg-surface-elevated border border-surface-border text-text-primary px-3 py-2 rounded-lg text-body focus:border-accent-success focus:outline-none transition-colors"
          >
            <option value="todos">Todos os status</option>
            <option value="pendentes">Apenas Pendentes (Restantes)</option>
            <option value="concluidos">Apenas Concluídos</option>
          </select>
        </div>

        {/* Lista de Tópicos com Checkbox de Conclusão */}
        {topicos.length === 0 ? (
          <div className="text-center py-10 text-text-secondary font-mono text-caption">
            Nenhum edital cadastrado ainda. Importe um edital para planejar seu ritmo.
          </div>
        ) : topicosFiltrados.length === 0 ? (
          <div className="text-center py-8 text-text-secondary font-mono text-caption">
            Nenhum tópico encontrado para os filtros selecionados.
          </div>
        ) : (
          <div className="divide-y divide-surface-border border border-surface-border rounded-lg overflow-hidden">
            {topicosFiltrados.map((topico) => {
              const disc = editalAtivo?.disciplinas.find((d) => d.id === topico.disciplinaId);
              return (
                <div
                  key={topico.id}
                  onClick={() => alternarConclusaoTopico(topico.id)}
                  className="p-3 bg-surface hover:bg-surface-elevated flex items-center justify-between gap-3 cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        alternarConclusaoTopico(topico.id);
                      }}
                      className="text-text-secondary group-hover:text-accent-success transition-colors flex-shrink-0"
                    >
                      {topico.concluido ? (
                        <CheckCircle2 className="w-5 h-5 text-accent-success" />
                      ) : (
                        <Circle className="w-5 h-5 text-text-secondary/50 group-hover:border-accent-success" />
                      )}
                    </button>

                    <div className="min-w-0">
                      <p
                        className={'text-body font-medium transition-colors ' + (topico.concluido ? 'line-through text-text-secondary/60' : 'text-text-primary')}
                      >
                        {topico.nome}
                      </p>
                      {disc && (
                        <span className="text-caption font-mono text-text-secondary/70">
                          {disc.nome}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    <span className="text-caption font-mono text-text-secondary">
                      Peso {topico.peso}
                    </span>
                    <Badge variant={topico.concluido ? 'success' : 'neutral'} className="font-mono text-caption">
                      {topico.concluido ? 'Concluído' : 'Restante'}
                    </Badge>
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

import React, { useState, useMemo } from 'react';
import { X, Search, Check, Filter } from 'lucide-react';
import { TaxonomiaDisciplina, QConcursosFiltro } from '../types';
import { Card, Button } from './ui';

interface ModalQConcursosSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  taxonomiaRecorte: TaxonomiaDisciplina[];
  topicoNome: string;
  currentFiltro: QConcursosFiltro | null;
  sugestoes?: QConcursosFiltro[];
  onSelect: (filtro: QConcursosFiltro | null) => void;
}

export const ModalQConcursosSelector: React.FC<ModalQConcursosSelectorProps> = ({
  isOpen,
  onClose,
  taxonomiaRecorte,
  topicoNome,
  currentFiltro,
  sugestoes,
  onSelect,
}) => {
  if (!isOpen) return null;

  const [selectedDiscId, setSelectedDiscId] = useState<number | null>(
    currentFiltro ? Number(currentFiltro.disciplinaId) : (taxonomiaRecorte[0]?.discipline_id || null)
  );
  const [searchTerm, setSearchTerm] = useState('');

  const activeDiscipline = useMemo(() => {
    return taxonomiaRecorte.find(d => d.discipline_id === selectedDiscId) || taxonomiaRecorte[0];
  }, [taxonomiaRecorte, selectedDiscId]);

  const filteredSubjects = useMemo(() => {
    if (!activeDiscipline) return [];
    if (!searchTerm.trim()) return activeDiscipline.subjects.slice(0, 50);

    const term = searchTerm.toLowerCase();
    return activeDiscipline.subjects
      .filter(s => s.nome.toLowerCase().includes(term) || String(s.id).includes(term))
      .slice(0, 50);
  }, [activeDiscipline, searchTerm]);

  const handleSelectSubject = (subjectId: number, subjectNome: string) => {
    if (!activeDiscipline) return;
    onSelect({
      disciplinaId: String(activeDiscipline.discipline_id),
      assuntoId: String(subjectId),
      disciplinaNome: activeDiscipline.discipline_nome,
      assuntoNome: subjectNome,
    });
    onClose();
  };

  const handleClearFiltro = () => {
    onSelect(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <Card
        variant="elevated"
        padding="none"
        className="w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border border-surface-border-elevated shadow-2xl"
      >
        {/* Header */}
        <div className="p-5 border-b border-surface-border flex items-center justify-between bg-surface-card">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-elevated border border-surface-border flex items-center justify-center text-accent-success">
              <Filter className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-h2 text-text-primary">Mapear Tópico no QConcursos</h3>
              <p className="text-caption text-text-secondary truncate max-w-md mt-0.5">
                {topicoNome}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary p-1.5 rounded-lg hover:bg-surface-elevated transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 overflow-y-auto space-y-5">
          {/* Seção de Sugestões Detectadas (se houver candidatos desambiguados) */}
          {sugestoes && sugestoes.length > 0 && (
            <div className="p-3.5 bg-surface-card border border-accent-warning/30 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-caption font-semibold uppercase tracking-wider text-accent-warning">
                  Sugestões Encontradas ({sugestoes.length})
                </span>
                <span className="text-caption text-text-secondary">
                  Clique para associar em 1 clique
                </span>
              </div>
              <div className="space-y-1.5">
                {sugestoes.map((sug, idx) => (
                  <button
                    key={`${sug.disciplinaId}_${sug.assuntoId}_${idx}`}
                    onClick={() => {
                      onSelect(sug);
                      onClose();
                    }}
                    className="w-full text-left p-2.5 rounded-md bg-surface border border-surface-border hover:border-accent-success/60 hover:bg-surface-elevated transition-all flex items-center justify-between group"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-caption font-mono text-text-secondary truncate">
                        {sug.disciplinaNome}
                      </div>
                      <div className="text-body text-text-primary font-medium truncate group-hover:text-accent-success transition-colors">
                        {sug.assuntoNome}
                      </div>
                    </div>
                    <span className="text-caption text-accent-success font-medium flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      Selecionar
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* Seletor de Disciplina */}
          <div>
            <label className="block text-caption font-medium uppercase tracking-wider text-text-secondary mb-1.5">
              1. Disciplina do QConcursos
            </label>
            <div className="flex flex-wrap gap-2">
              {taxonomiaRecorte.map(disc => {
                const isSelected = disc.discipline_id === selectedDiscId;
                return (
                  <button
                    key={disc.discipline_id}
                    onClick={() => setSelectedDiscId(disc.discipline_id)}
                    className={`px-3 py-1.5 rounded-lg text-caption font-mono transition-all border ${
                      isSelected
                        ? 'bg-surface-elevated text-accent-success border-accent-success/50 shadow-sm font-semibold'
                        : 'bg-surface border-surface-border text-text-secondary hover:text-text-primary hover:border-surface-border-elevated'
                    }`}
                  >
                    {disc.discipline_nome}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Busca de Assunto */}
          <div>
            <label className="block text-caption font-medium uppercase tracking-wider text-text-secondary mb-1.5">
              2. Assunto / Tópico no QConcursos
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar assunto ou lei por nome ou número..."
                className="w-full bg-surface border border-surface-border text-text-primary pl-9 pr-4 py-2 rounded-lg text-body placeholder:text-text-secondary/50 focus:border-accent-success focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Lista de Assuntos Filtrados */}
          <div className="border border-surface-border rounded-lg bg-surface max-h-56 overflow-y-auto divide-y divide-surface-border">
            {filteredSubjects.length === 0 ? (
              <div className="p-4 text-center text-caption text-text-secondary">
                Nenhum assunto encontrado para o termo pesquisado.
              </div>
            ) : (
              filteredSubjects.map(s => {
                const isCurrent = currentFiltro && currentFiltro.assuntoId === String(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => handleSelectSubject(s.id, s.nome)}
                    className={`w-full text-left px-3.5 py-2.5 text-body flex items-center justify-between hover:bg-surface-card transition-colors ${
                      isCurrent ? 'bg-surface-elevated text-accent-success font-medium' : 'text-text-primary'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <span className="text-caption font-mono text-text-secondary flex-shrink-0">
                        [{s.id}]
                      </span>
                      <span className="truncate">{s.nome}</span>
                    </div>
                    {isCurrent && <Check className="w-4 h-4 text-accent-success flex-shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-surface-border bg-surface-card flex items-center justify-between">
          <div>
            {currentFiltro && (
              <Button variant="secondary" size="sm" onClick={handleClearFiltro}>
                Remover Mapeamento
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

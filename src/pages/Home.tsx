import React from 'react';
import { ArrowRight, FileText, Database, ShieldAlert, CheckCircle, BookOpen } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { DEFAULT_USER_ID } from '../types';
import { Card, Button, Badge, MetricCard } from '../components/ui';

interface HomeProps {
  onNavigateToEdital?: () => void;
}

export const Home: React.FC<HomeProps> = ({ onNavigateToEdital }) => {
  const { editais, topicos, registrosQuestoes, errosRegistrados, revisoes, taxonomiaRecorte } = useAppStore();
  const editalAtivo = editais[0];
  const totalMapeados = topicos.filter(t => t.qconcursosFiltro !== null).length;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Card em Destaque com a Ação Principal da Tela */}
      <Card variant="elevated" padding="lg" className="relative overflow-hidden">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <Badge variant="success" icon={<CheckCircle className="w-3.5 h-3.5" />}>
              {editalAtivo ? 'EDITAL ATIVO CONFIGURADO' : 'PRONTO PARA ESTRUTURAÇÃO'}
            </Badge>
            <span className="text-caption font-mono text-text-secondary">
              Usuário: {DEFAULT_USER_ID}
            </span>
          </div>

          <div>
            <h1 className="text-h1 text-text-primary tracking-tight mb-2">
              {editalAtivo ? editalAtivo.concurso : 'AP90 — Organização de Estudos'}
            </h1>
            <p className="text-body text-text-secondary max-w-2xl leading-relaxed">
              {editalAtivo
                ? `Cargo: ${editalAtivo.cargo} • ${editalAtivo.disciplinas.length} disciplinas estruturadas e ${topicos.length} tópicos mapeados para o QConcursos.`
                : 'Ferramenta de alta performance para preparação para concursos públicos. Importe o conteúdo programático do edital para estruturar matérias, tópicos e questões com IA.'}
            </p>
          </div>

          {/* Ações: Ação Primária em Destaque Visual Máximo */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="primary"
              size="md"
              onClick={onNavigateToEdital}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              {editalAtivo ? 'Acessar Edital & Matérias' : 'Iniciar Configuração do Edital'}
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={onNavigateToEdital}
              icon={<FileText className="w-4 h-4" />}
            >
              {editalAtivo ? 'Reimportar Edital' : 'Importar Edital'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Seção de Métricas Base usando MetricCard */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-h2 text-text-primary">
            Estado da Base de Dados
          </h2>
          <span className="text-caption text-text-secondary font-mono">
            Persistência Local (localStorage)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            label="Editais Cadastrados"
            value={editais.length}
            context={editalAtivo ? editalAtivo.banca || 'Ativo' : 'Pronto para importação'}
            badge={editalAtivo ? <Badge variant="success">Ativo</Badge> : <Badge variant="neutral">Vazio</Badge>}
            icon={<BookOpen className="w-4 h-4" />}
          />

          <MetricCard
            label="Tópicos Mapeados"
            value={`${totalMapeados} / ${topicos.length}`}
            context={`${taxonomiaRecorte.length} disciplinas QC no recorte`}
            badge={
              topicos.length === 0 ? (
                <Badge variant="warning">Atenção</Badge>
              ) : (
                <Badge variant="success">{Math.round((totalMapeados / (topicos.length || 1)) * 100)}%</Badge>
              )
            }
            icon={<Database className="w-4 h-4" />}
          />

          <MetricCard
            label="Questões & Revisões"
            value={`${registrosQuestoes.length} / ${revisoes.length}`}
            context={`${errosRegistrados.length} erros registrados`}
            badge={
              revisoes.length === 0 ? (
                <Badge variant="neutral">Próxima Etapa</Badge>
              ) : (
                <Badge variant="success">Em dia</Badge>
              )
            }
            icon={<ShieldAlert className="w-4 h-4" />}
          />
        </div>
      </div>

      {/* Card Padrão Informativo sobre o Design System */}
      <Card variant="default" padding="md">
        <div className="flex items-start gap-4">
          <div className="w-8 h-8 rounded-lg bg-surface-elevated border border-surface-border flex items-center justify-center flex-shrink-0 text-text-secondary">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-h2 text-text-primary mb-1">
              Diretrizes de Interface Ativas
            </h2>
            <p className="text-body text-text-secondary leading-relaxed">
              Todas as telas utilizam exclusivamente os tokens de cores em camadas (<code className="text-caption font-mono text-text-primary">bg-surface</code>, <code className="text-caption font-mono text-text-primary">bg-surface-card</code>, <code className="text-caption font-mono text-text-primary">bg-surface-elevated</code>), tipografia estrita (<code className="text-caption font-mono text-text-primary">text-h1</code>, <code className="text-caption font-mono text-text-primary">text-h2</code>, <code className="text-caption font-mono text-text-primary">text-body</code>, <code className="text-caption font-mono text-text-primary">text-caption</code>) e componentes base (<code className="text-caption font-mono text-text-primary">Card</code>, <code className="text-caption font-mono text-text-primary">Button</code>, <code className="text-caption font-mono text-text-primary">Badge</code>, <code className="text-caption font-mono text-text-primary">MetricCard</code>).
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

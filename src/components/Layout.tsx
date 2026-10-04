import React from 'react';
import { Sidebar, NavigationPage } from './Sidebar';
import { 
  Zap, 
  Wifi, 
  ChevronDown, 
  Compass, 
  Wind, 
  TrendingUp, 
  Signal, 
  Play 
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

interface LayoutProps {
  currentPage: NavigationPage;
  onNavigate: (page: NavigationPage) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ currentPage, onNavigate, children }) => {
  const { editais, topicos, ritmoConfig, registrosQuestoes } = useAppStore();
  const safeEditais = editais || [];
  const safeTopicos = topicos || [];
  const safeRegistros = registrosQuestoes || [];
  
  const editalAtivo = safeEditais[0];
  const topicosRestantes = safeTopicos.filter(t => !t?.concluido).length;
  
  // Horas semanais
  const horasSemanais = Object.values(ritmoConfig?.disponibilidade || {}).reduce(
    (acc: number, h: unknown) => acc + (Number(h) || 0), 
    0
  );

  // Aproveitamento geral
  const totalFeitas = safeRegistros.reduce((acc, r) => acc + (r?.quantidade || 0), 0);
  const totalAcertos = safeRegistros.reduce((acc, r) => acc + (r?.acertos || 0), 0);
  const aproveitamento = totalFeitas > 0 ? Math.round((totalAcertos / totalFeitas) * 100) : 0;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#07090d] text-text-primary antialiased font-sans">
      {/* Sidebar */}
      <Sidebar currentPage={currentPage} onNavigate={onNavigate} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-transparent">
        {/* Top Header */}
        <header className="h-14 border-b border-white/10 bg-[#07090d]/80 backdrop-blur-xl px-6 flex items-center justify-between flex-shrink-0 z-10">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-caption font-mono font-semibold bg-[#00e676]/10 text-[#00e676] border border-[#00e676]/30 shadow-[0_0_12px_rgba(0,230,118,0.2)]">
              <span className="w-2 h-2 rounded-full bg-[#00e676] animate-pulse shadow-[0_0_6px_#00e676]" />
              SISTEMA SINCRONIZADO
            </span>
            <span className="text-white/20 font-mono">/</span>
            <span className="text-caption text-text-secondary font-mono tracking-tight">
              {editalAtivo ? `${editalAtivo.concurso} • ${editalAtivo.cargo}` : 'Workspace AP90'}
            </span>
          </div>

          <div className="flex items-center gap-4 text-caption font-mono text-text-secondary">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full glass-pill text-[#00e676]">
              <Zap className="w-3.5 h-3.5 fill-[#00e676]" />
              <span className="font-semibold text-xs">100% Sync</span>
            </div>

            <div className="flex items-center gap-2 px-3 py-1 rounded-full glass-pill text-emerald-400">
              <Wifi className="w-3.5 h-3.5" />
              <span className="text-xs text-text-secondary">QC Link</span>
            </div>

            <div className="flex items-center gap-2.5 px-3.5 py-1 rounded-full glass-pill border-white/15 hover:border-white/30 transition-all cursor-pointer">
              <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-[#00e676] to-emerald-400 flex items-center justify-center text-[#07090d] font-bold text-[10px]">
                AP
              </div>
              <span className="text-xs text-white font-medium">Perfil AP90</span>
              <ChevronDown className="w-3.5 h-3.5 text-text-secondary" />
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-transparent">
          {children}
        </main>

        {/* Bottom Status Bar */}
        <footer className="h-16 border-t border-white/10 bg-[#090d12]/90 backdrop-blur-2xl px-6 flex items-center justify-between flex-shrink-0 z-10">
          <div className="flex items-center gap-8 text-xs font-mono">
            {/* Edital / Concurso */}
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-xl glass-pill flex items-center justify-center text-[#00e676] border-[#00e676]/30">
                <Compass className="w-4 h-4" />
              </span>
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Edital / Concurso</p>
                <p className="text-text-primary font-semibold truncate max-w-[180px]">
                  {editalAtivo ? editalAtivo.concurso : 'Nenhum Edital'}
                </p>
              </div>
            </div>

            {/* Rhythm */}
            <div className="hidden sm:flex items-center gap-2.5 border-l border-white/10 pl-6">
              <span className="w-7 h-7 rounded-xl glass-pill flex items-center justify-center text-text-secondary">
                <Wind className="w-4 h-4" />
              </span>
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Ritmo Semanal</p>
                <p className="text-text-primary font-semibold">{horasSemanais}h / sem</p>
              </div>
            </div>

            {/* Progress / Topics */}
            <div className="hidden md:flex items-center gap-2.5 border-l border-white/10 pl-6">
              <span className="w-7 h-7 rounded-xl glass-pill flex items-center justify-center text-text-secondary">
                <TrendingUp className="w-4 h-4" />
              </span>
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Progresso do Edital</p>
                <p className="text-text-primary font-semibold">
                  {topicosRestantes} tópicos restantes {topicos.length > 0 && `(${topicos.length - topicosRestantes}/${topicos.length})`}
                </p>
              </div>
            </div>

            {/* Accuracy */}
            <div className="hidden lg:flex items-center gap-2.5 border-l border-white/10 pl-6">
              <span className="w-7 h-7 rounded-xl glass-pill flex items-center justify-center text-[#00e676] border-[#00e676]/30">
                <Signal className="w-4 h-4" />
              </span>
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Taxa de Acerto</p>
                <p className="text-text-primary font-semibold">
                  {totalFeitas > 0 ? `${aproveitamento}% (${totalFeitas} q)` : 'Sem dados'}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Action Study Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate(editalAtivo ? 'calendario' : 'edital')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-b from-[#00f584] via-[#00e676] to-[#00b355] text-[#031d10] font-bold text-xs shadow-[0_0_20px_rgba(0,230,118,0.45)] hover:shadow-[0_0_30px_rgba(0,230,118,0.7)] hover:brightness-105 active:scale-95 transition-all border border-[#7affba]/60"
            >
              <Play className="w-3.5 h-3.5 fill-[#031d10]" />
              <span>{editalAtivo ? 'Acessar Cronograma' : 'Iniciar Edital'}</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

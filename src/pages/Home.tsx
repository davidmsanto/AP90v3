import React from 'react';
import { 
  Play, 
  ArrowRight, 
  CalendarDays, 
  BookOpen, 
  RotateCcw, 
  AlertTriangle, 
  CheckCircle2, 
  Target, 
  Award, 
  ChevronRight, 
  Clock,
  Sparkles
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { DEFAULT_USER_ID } from '../types';
import { NavigationPage } from '../components/Sidebar';

interface HomeProps {
  onNavigateToEdital?: () => void;
  onNavigate?: (page: NavigationPage) => void;
}

export const Home: React.FC<HomeProps> = ({ onNavigateToEdital, onNavigate }) => {
  const { editais, topicos, registrosQuestoes, errosRegistrados, revisoes, ritmoConfig } = useAppStore();
  const safeEditais = editais || [];
  const safeTopicos = topicos || [];
  const safeRegistros = registrosQuestoes || [];
  const safeErros = errosRegistrados || [];
  const safeRevisoes = revisoes || [];

  const editalAtivo = safeEditais[0];
  const totalMapeados = safeTopicos.filter(t => t?.qconcursosFiltro !== null).length;
  const topicosConcluidos = safeTopicos.filter(t => t?.concluido).length;
  const pctConcluido = safeTopicos.length > 0 ? Math.round((topicosConcluidos / safeTopicos.length) * 100) : 0;
  
  const navigate = (page: NavigationPage) => {
    if (onNavigate) {
      onNavigate(page);
    } else if (page === 'edital' && onNavigateToEdital) {
      onNavigateToEdital();
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Grid: Hero Cockpit Banner + Daily Challenge Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Hero Card (2 columns) */}
        <div className="lg:col-span-2 relative rounded-3xl overflow-hidden glass-card-elevated border border-white/10 p-8 flex flex-col justify-between min-h-[380px] group">
          {/* Background Ambient Glows */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#00e676]/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
          <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-emerald-600/5 rounded-full blur-2xl pointer-events-none" />

          {/* Header Tag */}
          <div className="relative z-10 flex items-center justify-between">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono font-semibold bg-[#00e676]/10 text-[#00e676] border border-[#00e676]/30 shadow-[0_0_12px_rgba(0,230,118,0.2)]">
              <Sparkles className="w-3 h-3 text-[#00e676]" />
              <span>SISTEMA DE ALTA PERFORMANCE</span>
            </div>
            <span className="text-xs font-mono text-text-muted">Estudante: {DEFAULT_USER_ID}</span>
          </div>

          {/* Hero Content & Visual Centerpiece */}
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-6 items-center my-6">
            <div className="md:col-span-7 space-y-4">
              <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-[1.1]">
                Planeje.<br />
                Estude.<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00e676] to-emerald-300 drop-shadow-[0_0_20px_rgba(0,230,118,0.4)]">
                  Aprove.
                </span>
              </h1>
              <p className="text-sm text-text-secondary leading-relaxed max-w-md">
                {editalAtivo 
                  ? `Painel de estudos ativo para ${editalAtivo.concurso} (${editalAtivo.cargo}). Cronograma e revisões calculados para máxima retenção.`
                  : 'A plataforma definitiva para concurseiros de alta performance. Importe seu edital, sincronize com o QConcursos e domine cada matéria.'}
              </p>
            </div>

            {/* Logo Centerpiece with Holographic Glow */}
            <div className="md:col-span-5 flex justify-center items-center">
              <div className="relative w-48 h-48 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#00e676]/25 to-transparent blur-xl opacity-70 animate-pulse" />
                <div className="w-44 h-44 rounded-3xl glass-pill flex items-center justify-center p-4 border-white/10 shadow-[0_0_30px_rgba(0,230,118,0.15)] backdrop-blur-md">
                  <img 
                    src="/logo-ap90.png" 
                    alt="Logo AP90" 
                    className="max-h-36 max-w-36 object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Actions of Hero */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/5">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(editalAtivo ? 'calendario' : 'edital')}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-b from-[#00f584] via-[#00e676] to-[#00b355] text-[#031d10] font-bold text-sm shadow-[0_0_24px_rgba(0,230,118,0.45)] hover:shadow-[0_0_35px_rgba(0,230,118,0.7)] hover:brightness-105 active:scale-95 transition-all border border-[#7affba]/60"
              >
                <Play className="w-4 h-4 fill-[#031d10]" />
                <span>{editalAtivo ? 'Acessar Cronograma' : 'Configurar Edital'}</span>
              </button>

              <button
                onClick={() => navigate('edital')}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-full glass-pill text-text-primary hover:text-white hover:bg-white/[0.08] hover:border-white/20 text-sm font-medium transition-all"
              >
                <BookOpen className="w-4 h-4 text-text-secondary" />
                <span>Ver Matérias</span>
              </button>
            </div>

            {/* Status Pill */}
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full glass-pill text-xs font-mono text-text-secondary">
              <Clock className="w-3.5 h-3.5 text-[#00e676]" />
              <span>{ritmoConfig?.tempoMedioMinutosPorTopico ?? 45} min / tópico</span>
            </div>
          </div>
        </div>

        {/* Daily Challenge Card (Right Column) */}
        <div className="rounded-3xl glass-card-elevated border border-white/10 p-6 flex flex-col justify-between">
          <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-white tracking-tight">Meta Diária</h2>
              <span className="w-8 h-8 rounded-xl glass-pill flex items-center justify-center text-[#00e676] border-[#00e676]/30">
                <CalendarDays className="w-4 h-4" />
              </span>
            </div>

            {/* Inner Challenge Box */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3 mb-5">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-[#00e676]/15 border border-[#00e676]/30 flex items-center justify-center text-[#00e676]">
                  <Target className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">Nível: Foco Total</h3>
                  <p className="text-xs text-text-muted">Cumpra as metas do dia e zere as revisões.</p>
                </div>
              </div>

              {/* Progress */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-text-secondary">Progresso Edital</span>
                  <span className="text-[#00e676] font-bold">{pctConcluido}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-black/40 overflow-hidden p-0.5 border border-white/5">
                  <div 
                    className="h-full rounded-full bg-gradient-to-r from-[#00e676] to-emerald-400 shadow-[0_0_10px_#00e676] transition-all duration-500" 
                    style={{ width: `${Math.max(5, pctConcluido)}%` }}
                  />
                </div>
              </div>

              {/* Rewards HUD */}
              <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs font-mono">
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <Award className="w-4 h-4 text-[#00e676]" />
                  <span>+{topicosConcluidos * 50} XP</span>
                </div>
                <div className="flex items-center gap-1.5 text-text-secondary">
                  <CheckCircle2 className="w-4 h-4 text-[#00e676]" />
                  <span>{safeRegistros.length} Sessões</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={() => navigate('questoes')}
            className="w-full py-3 rounded-2xl bg-gradient-to-b from-[#00f584] via-[#00e676] to-[#00b355] text-[#031d10] font-bold text-sm shadow-[0_0_20px_rgba(0,230,118,0.4)] hover:shadow-[0_0_28px_rgba(0,230,118,0.65)] hover:brightness-105 active:scale-95 transition-all border border-[#7affba]/60 flex items-center justify-center gap-2"
          >
            <span>Registrar Questões</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* Bottom Grid: 4 Action Modules */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Module 1: Edital & Matérias */}
        <div 
          onClick={() => navigate('edital')}
          className="group p-5 rounded-2xl glass-card hover:glass-card-elevated border border-white/10 hover:border-[#00e676]/40 cursor-pointer transition-all flex flex-col justify-between min-h-[140px]"
        >
          <div className="flex items-center justify-between">
            <span className="w-9 h-9 rounded-xl glass-pill flex items-center justify-center text-[#00e676] group-hover:border-[#00e676]/40 transition-colors">
              <BookOpen className="w-5 h-5" />
            </span>
            <span className="w-6 h-6 rounded-full glass-pill flex items-center justify-center text-text-muted group-hover:text-white group-hover:translate-x-0.5 transition-all">
              <ChevronRight className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-caption font-semibold text-text-muted uppercase tracking-wider">Edital Ativo</div>
            <div className="text-base font-bold text-white group-hover:text-[#00e676] transition-colors truncate">
              {editalAtivo ? editalAtivo.concurso : 'Nenhum Cadastrado'}
            </div>
            <div className="text-xs font-mono text-text-secondary mt-0.5">
              {editalAtivo ? `${(editalAtivo.disciplinas || []).length} Disciplinas • ${totalMapeados} tópicos QC` : 'Importar Edital'}
            </div>
          </div>
        </div>

        {/* Module 2: Calendário Inteligente */}
        <div 
          onClick={() => navigate('calendario')}
          className="group p-5 rounded-2xl glass-card hover:glass-card-elevated border border-white/10 hover:border-[#00e676]/40 cursor-pointer transition-all flex flex-col justify-between min-h-[140px]"
        >
          <div className="flex items-center justify-between">
            <span className="w-9 h-9 rounded-xl glass-pill flex items-center justify-center text-[#00e676] group-hover:border-[#00e676]/40 transition-colors">
              <CalendarDays className="w-5 h-5" />
            </span>
            <span className="w-6 h-6 rounded-full glass-pill flex items-center justify-center text-text-muted group-hover:text-white group-hover:translate-x-0.5 transition-all">
              <ChevronRight className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-caption font-semibold text-text-muted uppercase tracking-wider">Cronograma</div>
            <div className="text-base font-bold text-white group-hover:text-[#00e676] transition-colors truncate">
              Calendário Mensal
            </div>
            <div className="text-xs font-mono text-text-secondary mt-0.5">
              Alocação por Peso & Rollover
            </div>
          </div>
        </div>

        {/* Module 3: Revisões Espaçadas */}
        <div 
          onClick={() => navigate('revisoes')}
          className="group p-5 rounded-2xl glass-card hover:glass-card-elevated border border-white/10 hover:border-[#00e676]/40 cursor-pointer transition-all flex flex-col justify-between min-h-[140px]"
        >
          <div className="flex items-center justify-between">
            <span className="w-9 h-9 rounded-xl glass-pill flex items-center justify-center text-[#00e676] group-hover:border-[#00e676]/40 transition-colors">
              <RotateCcw className="w-5 h-5" />
            </span>
            <span className="w-6 h-6 rounded-full glass-pill flex items-center justify-center text-text-muted group-hover:text-white group-hover:translate-x-0.5 transition-all">
              <ChevronRight className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-caption font-semibold text-text-muted uppercase tracking-wider">Repetição Espaçada</div>
            <div className="text-base font-bold text-white group-hover:text-[#00e676] transition-colors truncate">
              Revisões R1 • R2 • R3
            </div>
            <div className="text-xs font-mono text-text-secondary mt-0.5">
              {safeRevisoes.filter(r => !r?.concluida).length} Pendências para Revisar
            </div>
          </div>
        </div>

        {/* Module 4: Caderno de Erros */}
        <div 
          onClick={() => navigate('erros')}
          className="group p-5 rounded-2xl glass-card hover:glass-card-elevated border border-white/10 hover:border-[#00e676]/40 cursor-pointer transition-all flex flex-col justify-between min-h-[140px]"
        >
          <div className="flex items-center justify-between">
            <span className="w-9 h-9 rounded-xl glass-pill flex items-center justify-center text-amber-400 group-hover:border-amber-500/40 transition-colors">
              <AlertTriangle className="w-5 h-5" />
            </span>
            <span className="w-6 h-6 rounded-full glass-pill flex items-center justify-center text-text-muted group-hover:text-white group-hover:translate-x-0.5 transition-all">
              <ChevronRight className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-caption font-semibold text-text-muted uppercase tracking-wider">Diagnóstico</div>
            <div className="text-base font-bold text-white group-hover:text-amber-400 transition-colors truncate">
              Caderno de Erros
            </div>
            <div className="text-xs font-mono text-text-secondary mt-0.5">
              {safeErros.length} Questões Registradas
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

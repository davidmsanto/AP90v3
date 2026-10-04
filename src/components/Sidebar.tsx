import React from 'react';
import { 
  Terminal, 
  BookOpen, 
  CheckSquare, 
  RotateCcw, 
  AlertTriangle, 
  Activity, 
  User, 
  Clock, 
  CalendarDays 
} from 'lucide-react';
import { DEFAULT_USER_ID } from '../types';
import { Badge } from './ui';

export type NavigationPage = 'home' | 'edital' | 'erros' | 'questoes' | 'ritmo' | 'revisoes' | 'calendario';

interface SidebarProps {
  currentPage: NavigationPage;
  onNavigate: (page: NavigationPage) => void;
}

interface MenuItem {
  id: NavigationPage;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  enabled: boolean;
  badge?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate }) => {
  const menuItems: MenuItem[] = [
    { id: 'home', label: 'Visão Geral', icon: Activity, enabled: true },
    { id: 'edital', label: 'Editais & Matérias', icon: BookOpen, enabled: true },
    { id: 'calendario', label: 'Calendário de Estudos', icon: CalendarDays, enabled: true },
    { id: 'questoes', label: 'Registro de Questões', icon: CheckSquare, enabled: true },
    { id: 'revisoes', label: 'Revisões Pendentes', icon: RotateCcw, enabled: true },
    { id: 'ritmo', label: 'Ritmo de Estudo', icon: Clock, enabled: true },
    { id: 'erros', label: 'Caderno de Erros', icon: AlertTriangle, enabled: true },
  ];

  return (
    <aside className="w-64 h-screen bg-[#090d12]/90 backdrop-blur-2xl border-r border-white/10 flex flex-col flex-shrink-0 select-none z-20">
      {/* Brand Header with Official Logo */}
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12 flex items-center justify-center rounded-2xl bg-white/[0.03] border border-white/10 shadow-[0_0_15px_rgba(0,230,118,0.15)] overflow-hidden flex-shrink-0">
            <div className="absolute inset-0 bg-gradient-to-tr from-[#00e676]/20 via-transparent to-transparent opacity-60" />
            <img 
              src="/logo-ap90.png" 
              alt="Logo AP90" 
              className="w-10 h-10 object-contain relative z-10 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
            />
          </div>
          <div className="overflow-hidden">
            <div className="flex items-center gap-2">
              <span className="font-mono font-extrabold text-xl text-white tracking-wider">AP90</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#00e676]/15 text-[#00e676] border border-[#00e676]/30 shadow-[0_0_8px_rgba(0,230,118,0.2)]">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-text-secondary font-mono tracking-tight truncate">
              Aprovação em Alta Performance
            </p>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <div className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-mono uppercase tracking-widest text-text-muted font-semibold flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-[#00e676]" />
          <span>Área do Aluno</span>
        </div>

        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;

          if (item.enabled) {
            return (
              <button
                key={item.label}
                onClick={() => onNavigate(item.id)}
                className={`w-full text-left flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-body transition-all duration-200 ${
                  isActive
                    ? 'active-nav-glow text-[#00e676] font-semibold'
                    : 'text-text-secondary hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-[#00e676]' : 'text-text-secondary'}`} />
                  <span className="tracking-tight">{item.label}</span>
                </div>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00e676] shadow-[0_0_8px_#00e676]" />
                )}
              </button>
            );
          }

          return (
            <div
              key={item.label}
              className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-body text-text-muted cursor-not-allowed opacity-50"
            >
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4 text-text-muted" />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <Badge variant="neutral" className="text-[10px] py-0 px-1.5">
                  {item.badge}
                </Badge>
              )}
            </div>
          );
        })}
      </div>

      {/* User / Session Footer */}
      <div className="p-3 border-t border-white/10 bg-black/20">
        <div className="p-2.5 rounded-2xl glass-card border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-white/[0.05] border border-white/15 flex items-center justify-center text-text-primary">
                <User className="w-4 h-4 text-[#00e676]" />
              </div>
              <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-[#00e676] ring-2 ring-[#090d12] shadow-[0_0_6px_#00e676]" />
            </div>
            <div className="overflow-hidden">
              <p className="text-caption font-semibold text-text-primary truncate">{DEFAULT_USER_ID}</p>
              <p className="text-[10px] font-mono text-text-secondary">Sessão Ativa</p>
            </div>
          </div>
          <span className="w-2 h-2 rounded-full bg-[#00e676] shadow-[0_0_8px_#00e676]" />
        </div>
      </div>
    </aside>
  );
};

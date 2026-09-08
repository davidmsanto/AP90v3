import React from 'react';
import { 
  Terminal, 
  BookOpen, 
  CheckSquare, 
  RotateCcw, 
  AlertTriangle, 
  Layers, 
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
    <aside className="w-64 h-screen bg-surface border-r border-surface-border flex flex-col flex-shrink-0 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-surface-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-surface-elevated border border-surface-border-elevated flex items-center justify-center text-text-primary">
            <Layers className="w-5 h-5 text-accent-success" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-h2 text-text-primary tracking-wider">AP90</span>
              <Badge variant="success" className="text-[10px] py-0 px-1.5 font-bold">
                v0.3
              </Badge>
            </div>
            <p className="text-caption text-text-secondary font-mono">Alta Performance Concursos</p>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-caption font-mono uppercase tracking-wider text-text-secondary font-medium flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5" />
          <span>Módulos</span>
        </div>

        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;

          if (item.enabled) {
            return (
              <button
                key={item.label}
                onClick={() => onNavigate(item.id)}
                className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-body transition-colors ${
                  isActive
                    ? 'bg-surface-elevated text-text-primary border border-surface-border-elevated font-medium'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-card'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-accent-success' : 'text-text-secondary'}`} />
                  <span>{item.label}</span>
                </div>
              </button>
            );
          }

          return (
            <div
              key={item.label}
              className="flex items-center justify-between px-3 py-2 rounded-lg text-body text-text-secondary hover:bg-surface-card cursor-not-allowed opacity-60"
            >
              <div className="flex items-center gap-2.5">
                <Icon className="w-4 h-4 text-text-secondary" />
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
      <div className="p-3 border-t border-surface-border bg-surface-card">
        <div className="p-2.5 rounded-lg bg-surface-elevated border border-surface-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-7 h-7 rounded-full bg-surface-card border border-surface-border-elevated flex items-center justify-center text-text-primary">
                <User className="w-3.5 h-3.5 text-text-secondary" />
              </div>
              <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-accent-success ring-2 ring-surface" />
            </div>
            <div className="overflow-hidden">
              <p className="text-caption font-medium text-text-primary truncate">{DEFAULT_USER_ID}</p>
              <p className="text-[10px] font-mono text-text-secondary">Sessão Local</p>
            </div>
          </div>
          <Badge variant="success" className="p-1 px-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-success" />
          </Badge>
        </div>
      </div>
    </aside>
  );
};

import React from 'react';
import { Sidebar, NavigationPage } from './Sidebar';
import { ShieldCheck, HardDrive } from 'lucide-react';
import { Badge } from './ui';

interface LayoutProps {
  currentPage: NavigationPage;
  onNavigate: (page: NavigationPage) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ currentPage, onNavigate, children }) => {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface text-text-primary antialiased font-sans">
      {/* Sidebar */}
      <Sidebar currentPage={currentPage} onNavigate={onNavigate} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-surface">
        {/* Top Header */}
        <header className="h-14 border-b border-surface-border bg-surface/80 backdrop-blur px-6 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <Badge variant="success" icon={<span className="w-1.5 h-1.5 rounded-full bg-accent-success animate-pulse" />}>
              SISTEMA ONLINE
            </Badge>
            <span className="text-surface-border font-mono">/</span>
            <span className="text-caption text-text-secondary font-mono">Workspace AP90</span>
          </div>

          <div className="flex items-center gap-4 text-caption font-mono text-text-secondary">
            <div className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-text-secondary" />
              <span>Persistência: localStorage</span>
            </div>
            <div className="flex items-center gap-1.5 border-l border-surface-border pl-4">
              <ShieldCheck className="w-3.5 h-3.5 text-text-secondary" />
              <span>Modo Offline</span>
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 overflow-y-auto p-8 bg-surface">
          {children}
        </main>
      </div>
    </div>
  );
};

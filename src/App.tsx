import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { ImportarEdital } from './pages/ImportarEdital';
import { EditalAtivo } from './pages/EditalAtivo';
import { CadernoErros } from './pages/CadernoErros';
import { RegistroQuestoesPage } from './pages/RegistroQuestoesPage';
import { RitmoEstudoPage } from './pages/RitmoEstudoPage';
import { RevisoesPage } from './pages/RevisoesPage';
import { CalendarioEstudoPage } from './pages/CalendarioEstudoPage';
import { NavigationPage } from './components/Sidebar';
import { useAppStore } from './store/useAppStore';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('AP90 Runtime Error:', error, errorInfo);
  }

  handleReset = () => {
    try {
      localStorage.removeItem('ap90-storage');
    } catch (_) {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-[#07090d] text-white flex items-center justify-center p-6">
          <div className="max-w-lg w-full glass-card-elevated border border-red-500/30 rounded-3xl p-8 space-y-6 text-center shadow-[0_0_30px_rgba(239,68,68,0.2)]">
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
              <span className="text-2xl font-bold">!</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white mb-2">Erro de Execução Detectado</h1>
              <p className="text-sm text-text-secondary">
                Ocorreu uma inconsistência de dados ou renderização. Você pode tentar recarregar ou resetar o cache local.
              </p>
            </div>
            {this.state.error && (
              <div className="p-3 rounded-xl bg-black/40 border border-white/10 text-left font-mono text-xs text-red-300 overflow-x-auto">
                {this.state.error.message}
              </div>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 rounded-full glass-pill text-white text-sm font-medium hover:bg-white/10 transition-all"
              >
                Recarregar Página
              </button>
              <button
                onClick={this.handleReset}
                className="px-5 py-2.5 rounded-full bg-gradient-to-b from-[#00f584] to-[#00b355] text-[#031d10] text-sm font-bold shadow-[0_0_20px_rgba(0,230,118,0.4)] hover:brightness-105 transition-all"
              >
                Resetar Cache Local
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export const AppContent: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<NavigationPage>('home');
  const [editalMode, setEditalMode] = useState<'view' | 'importing'>('view');
  const { editais } = useAppStore();
  const safeEditais = editais || [];

  const handleNavigate = (page: NavigationPage) => {
    setCurrentPage(page);
    if (page === 'edital') {
      setEditalMode(safeEditais.length > 0 ? 'view' : 'importing');
    }
  };

  return (
    <Layout currentPage={currentPage} onNavigate={handleNavigate}>
      {currentPage === 'home' && (
        <Home
          onNavigate={handleNavigate}
          onNavigateToEdital={() => {
            setCurrentPage('edital');
            setEditalMode(safeEditais.length > 0 ? 'view' : 'importing');
          }}
        />
      )}

      {currentPage === 'edital' && (
        <>
          {safeEditais.length > 0 && editalMode === 'view' ? (
            <EditalAtivo 
              onNovoEdital={() => setEditalMode('importing')} 
              onRegistrarQuestoes={() => handleNavigate('questoes')}
              onNavigateToRitmo={() => handleNavigate('ritmo')}
              onNavigateToCalendario={() => handleNavigate('calendario')}
            />
          ) : (
            <ImportarEdital
              onSuccess={() => {
                setEditalMode('view');
                setCurrentPage('edital');
              }}
            />
          )}
        </>
      )}

      {currentPage === 'calendario' && (
        <CalendarioEstudoPage 
          onNavigateToEdital={() => handleNavigate('edital')}
          onNavigateToRitmo={() => handleNavigate('ritmo')}
        />
      )}

      {currentPage === 'erros' && <CadernoErros />}

      {currentPage === 'questoes' && <RegistroQuestoesPage />}

      {currentPage === 'ritmo' && (
        <RitmoEstudoPage 
          onNavigateToEdital={() => handleNavigate('edital')}
          onNavigateToQuestoes={() => handleNavigate('questoes')}
        />
      )}

      {currentPage === 'revisoes' && (
        <RevisoesPage 
          onNavigateToEdital={() => handleNavigate('edital')}
          onNavigateToQuestoes={() => handleNavigate('questoes')}
        />
      )}
    </Layout>
  );
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
};

export default App;

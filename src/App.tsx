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

export const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<NavigationPage>('home');
  const [editalMode, setEditalMode] = useState<'view' | 'importing'>('view');
  const { editais } = useAppStore();

  const handleNavigate = (page: NavigationPage) => {
    setCurrentPage(page);
    if (page === 'edital') {
      setEditalMode(editais.length > 0 ? 'view' : 'importing');
    }
  };

  return (
    <Layout currentPage={currentPage} onNavigate={handleNavigate}>
      {currentPage === 'home' && (
        <Home
          onNavigateToEdital={() => {
            setCurrentPage('edital');
            setEditalMode(editais.length > 0 ? 'view' : 'importing');
          }}
        />
      )}

      {currentPage === 'edital' && (
        <>
          {editais.length > 0 && editalMode === 'view' ? (
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

export default App;

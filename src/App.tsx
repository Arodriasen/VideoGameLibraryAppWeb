import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './ui/hooks/useAuth';
import { GamesProvider } from './ui/hooks/useGames';
import { CollectionPage } from './ui/pages/CollectionPage';
import { GameDetailPage } from './ui/pages/GameDetailPage';
import { GameEditPage } from './ui/pages/GameEditPage';
import { LoginPage } from './ui/pages/LoginPage';
import { SettingsPage } from './ui/pages/SettingsPage';
import { StatsPage } from './ui/pages/StatsPage';
import { TrashPage } from './ui/pages/TrashPage';

// Aparte, para no cargar el lector de códigos (casi 1 MB) hasta abrir el escáner.
const ScannerPage = lazy(() => import('./ui/pages/ScannerPage').then((module) => ({ default: module.ScannerPage })));

function Routing() {
  const { session, loading, recovering } = useAuth();
  if (loading) return null;
  if (!session || recovering) return <LoginPage />;

  return (
    <GamesProvider>
      <BrowserRouter>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/escanear" element={<ScannerPage />} />
            <Route path="/ajustes" element={<SettingsPage />} />
            <Route path="/estadisticas" element={<StatsPage />} />
            <Route path="/papelera" element={<TrashPage />} />
            <Route path="/juego/nuevo" element={<GameEditPage />} />
            <Route path="/juego/:id" element={<GameDetailPage />} />
            <Route path="/juego/:id/editar" element={<GameEditPage />} />
            <Route path="*" element={<CollectionPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </GamesProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routing />
    </AuthProvider>
  );
}

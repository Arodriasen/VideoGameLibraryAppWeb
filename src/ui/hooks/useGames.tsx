import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react';
import type { Game } from '../../domain/game';
import { ApiError, fetchCollectionName, fetchGames } from '../../infrastructure/gameApi';
import { supabase } from '../../infrastructure/supabase';

interface GamesState {
  games: Game[] | null;
  error: string | null;
  collectionName: string;
  reload: () => void;
  /** Refleja en pantalla un juego recién guardado, sin volver a leer la colección. */
  saveLocally: (game: Game) => void;
  removeLocally: (id: number) => void;
  setCollectionName: (name: string) => void;
}

const noop = () => undefined;
const GamesContext = createContext<GamesState>({
  games: null,
  error: null,
  collectionName: '',
  reload: noop,
  saveLocally: noop,
  removeLocally: noop,
  setCollectionName: noop,
});

const byTitle = (a: Game, b: Game) => a.title.localeCompare(b.title, 'es');

/** Compartido entre pantallas para no volver a leer la colección al cambiar de una a otra. */
export function GamesProvider({ children }: { children: ReactNode }) {
  const [games, setGames] = useState<Game[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collectionName, setCollectionName] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchGames()
      .then((loaded) => {
        if (!cancelled) setGames(loaded);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) {
          void supabase.auth.signOut({ scope: 'local' });
          return;
        }
        setError(e instanceof Error ? e.message : 'No se ha podido leer la colección.');
      });
    // El nombre es secundario: si falla, la app sigue con el título de siempre.
    fetchCollectionName()
      .then((name) => {
        if (!cancelled) setCollectionName(name);
      })
      .catch(noop);
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reload = useCallback(() => {
    setError(null);
    setAttempt((value) => value + 1);
  }, []);

  const saveLocally = useCallback((game: Game) => {
    setGames((current) => [...(current ?? []).filter((item) => item.id !== game.id), game].sort(byTitle));
  }, []);

  const removeLocally = useCallback((id: number) => {
    setGames((current) => current?.filter((item) => item.id !== id) ?? null);
  }, []);

  return (
    <GamesContext value={{ games, error, collectionName, reload, saveLocally, removeLocally, setCollectionName }}>
      {children}
    </GamesContext>
  );
}

export function useGames(): GamesState {
  return use(GamesContext);
}

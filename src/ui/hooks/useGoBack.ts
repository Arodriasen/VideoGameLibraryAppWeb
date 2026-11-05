import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/** Vuelve a la pantalla anterior, conservando su lista y búsqueda; sin historial, a la colección. */
export function useGoBack(): () => void {
  const navigate = useNavigate();
  return useCallback(() => {
    const hasHistory = ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0;
    if (hasHistory) void navigate(-1);
    else void navigate('/', { replace: true });
  }, [navigate]);
}

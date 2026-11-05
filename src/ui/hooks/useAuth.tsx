import type { Session } from '@supabase/supabase-js';
import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../../infrastructure/supabase';

interface AuthState {
  session: Session | null;
  /** true hasta saber si había una sesión guardada en este dispositivo. */
  loading: boolean;
  /**
   * true mientras se recupera la contraseña. Validar el código ya abre sesión, y sin esto la app
   * saltaría a la colección antes de poder escribir la contraseña nueva.
   */
  recovering: boolean;
  setRecovering: (recovering: boolean) => void;
}

const AuthContext = createContext<AuthState>({
  session: null,
  loading: true,
  recovering: false,
  setRecovering: () => undefined,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<{ session: Session | null; loading: boolean }>({ session: null, loading: true });
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    // Avisa al arrancar (con la sesión guardada) y en cada entrada, salida o renovación del token.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuth({ session, loading: false });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo(() => ({ ...auth, recovering, setRecovering }), [auth, recovering]);
  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthState {
  return use(AuthContext);
}

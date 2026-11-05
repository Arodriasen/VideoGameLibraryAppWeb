import { createClient } from '@supabase/supabase-js';

// Misma cuenta que el escritorio y Android. La clave "anon" es pública por diseño: quien protege los
// datos es Row Level Security.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  { auth: { persistSession: true, autoRefreshToken: true } },
);

// Identifica al usuario y carga sus ajustes desde Supabase, la misma cuenta del escritorio y Android.
import { error, type Env } from './http';

export interface UserSettings {
  connectionString: string;
  scanDexToken: string;
  igdbClientId: string;
  igdbClientSecret: string;
  rawgApiKey: string;
  theGamesDbApiKey: string;
}

interface UserSettingsRow {
  connection_string: string | null;
  scan_dex_token: string | null;
  igdb_client_id: string | null;
  igdb_client_secret: string | null;
  rawg_api_key: string | null;
  thegamesdb_api_key: string | null;
}

const COLUMNS =
  'connection_string,scan_dex_token,igdb_client_id,igdb_client_secret,rawg_api_key,thegamesdb_api_key';

/**
 * Devuelve los ajustes de quien hace la petición, o la respuesta de error que hay que enviarle.
 *
 * Una sola llamada basta para las dos cosas: Supabase valida el token de sesión y, gracias a RLS
 * (auth.uid() = user_id), solo devuelve la fila de ese usuario.
 */
export async function loadSettings(request: Request, env: Env): Promise<UserSettings | Response> {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return error('Inicia sesión para continuar.', 401);
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return error('El servidor no tiene configurado Supabase.', 500);
  }

  let response: Response;
  try {
    response = await fetch(`${env.SUPABASE_URL}/rest/v1/user_settings?select=${COLUMNS}&limit=1`, {
      headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: authorization },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    // Solo el tipo de fallo: la URL y las cabeceras no deben acabar en los logs.
    console.error('Supabase: sin respuesta', e instanceof Error ? e.name : 'error');
    return error('El servicio de cuentas no responde. Inténtalo más tarde.', 502);
  }

  if (response.status === 401 || response.status === 403) {
    return error('Tu sesión ha caducado. Vuelve a iniciar sesión.', 401);
  }
  if (!response.ok) {
    console.error('Supabase: respuesta', response.status);
    return error('El servicio de cuentas no responde. Inténtalo más tarde.', 502);
  }

  const [row] = (await response.json()) as UserSettingsRow[];
  if (!row?.connection_string) {
    return error('Esta cuenta aún no tiene base de datos. Configúrala en la app de escritorio o de Android.', 409);
  }

  return {
    connectionString: row.connection_string,
    scanDexToken: row.scan_dex_token ?? '',
    igdbClientId: row.igdb_client_id ?? '',
    igdbClientSecret: row.igdb_client_secret ?? '',
    rawgApiKey: row.rawg_api_key ?? '',
    theGamesDbApiKey: row.thegamesdb_api_key ?? '',
  };
}

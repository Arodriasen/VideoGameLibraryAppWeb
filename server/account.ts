// Identifica al usuario y gestiona sus ajustes en Supabase, la misma cuenta del escritorio y Android.
import { error, type Env } from './http';

export interface UserSettings {
  connectionString: string;
  scanDexToken: string;
  igdbClientId: string;
  igdbClientSecret: string;
  rawgApiKey: string;
  theGamesDbApiKey: string;
}

export interface AccountSettings extends UserSettings {
  userId: string;
}

interface UserSettingsRow {
  user_id: string;
  connection_string: string | null;
  scan_dex_token: string | null;
  igdb_client_id: string | null;
  igdb_client_secret: string | null;
  rawg_api_key: string | null;
  thegamesdb_api_key: string | null;
}

const COLUMNS =
  'user_id,connection_string,scan_dex_token,igdb_client_id,igdb_client_secret,rawg_api_key,thegamesdb_api_key';

const TIMEOUT_MS = 15_000;
const UNAVAILABLE = 'El servicio de cuentas no responde. Inténtalo más tarde.';

/**
 * Devuelve los ajustes de quien hace la petición, o la respuesta de error que hay que enviarle.
 *
 * Una sola llamada basta para las dos cosas: Supabase valida el token de sesión y, gracias a RLS
 * (auth.uid() = user_id), solo devuelve la fila de ese usuario.
 */
export async function loadSettings(request: Request, env: Env): Promise<AccountSettings | Response> {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return error('Inicia sesión para continuar.', 401);
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return error('El servidor no tiene configurado Supabase.', 500);
  }

  let response: Response;
  try {
    response = await fetch(`${env.SUPABASE_URL}/rest/v1/user_settings?select=${COLUMNS}&limit=1`, {
      headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: authorization },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    // Solo el tipo de fallo: la URL y las cabeceras no deben acabar en los logs.
    console.error('Supabase: sin respuesta', e instanceof Error ? e.name : 'error');
    return error(UNAVAILABLE, 502);
  }

  if (response.status === 401 || response.status === 403) {
    return error('Tu sesión ha caducado. Vuelve a iniciar sesión.', 401);
  }
  if (!response.ok) {
    console.error('Supabase: respuesta', response.status);
    return error(UNAVAILABLE, 502);
  }

  const [row] = (await response.json()) as UserSettingsRow[];
  if (!row?.connection_string) {
    return error('Esta cuenta aún no tiene base de datos. Configúrala en la app de escritorio o de Android.', 409);
  }

  return {
    userId: row.user_id,
    connectionString: row.connection_string,
    scanDexToken: row.scan_dex_token ?? '',
    igdbClientId: row.igdb_client_id ?? '',
    igdbClientSecret: row.igdb_client_secret ?? '',
    rawgApiKey: row.rawg_api_key ?? '',
    theGamesDbApiKey: row.thegamesdb_api_key ?? '',
  };
}

/**
 * Guarda los ajustes en la cuenta. Devuelve null si ha ido bien, o la respuesta de error.
 *
 * El filtro por user_id es obligatorio: Supabase rechaza un UPDATE sin filtro. Y hay que comprobar
 * que se ha actualizado una fila, porque si RLS la excluye la respuesta sigue siendo correcta.
 */
export async function saveSettings(
  request: Request,
  env: Env,
  userId: string,
  settings: UserSettings,
): Promise<Response | null> {
  let response: Response;
  try {
    response = await fetch(`${env.SUPABASE_URL}/rest/v1/user_settings?user_id=eq.${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: request.headers.get('Authorization') ?? '',
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        connection_string: settings.connectionString,
        scan_dex_token: settings.scanDexToken,
        igdb_client_id: settings.igdbClientId,
        igdb_client_secret: settings.igdbClientSecret,
        rawg_api_key: settings.rawgApiKey,
        thegamesdb_api_key: settings.theGamesDbApiKey,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    console.error('Supabase: sin respuesta', e instanceof Error ? e.name : 'error');
    return error(UNAVAILABLE, 502);
  }

  if (response.status === 401 || response.status === 403) {
    return error('Tu sesión ha caducado. Vuelve a iniciar sesión.', 401);
  }
  if (!response.ok) {
    console.error('Supabase: respuesta', response.status);
    return error(UNAVAILABLE, 502);
  }

  const rows = (await response.json()) as unknown[];
  return rows.length === 1 ? null : error('No se han podido guardar los ajustes.', 502);
}

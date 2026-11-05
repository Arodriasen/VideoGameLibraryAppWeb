// Utilidades comunes de las Pages Functions.
import { ConnectionStringError } from './connectionString';
import { DuplicateBarcodeError } from './gameRepository';

export interface Env {
  /** URL del proyecto Supabase, el mismo que usan el escritorio y Android. */
  SUPABASE_URL: string;
  /** Clave pública "anon" de ese proyecto. */
  SUPABASE_ANON_KEY: string;
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export function error(message: string, status: number): Response {
  return json({ error: message }, status);
}

/** Convierte un fallo de la base de datos en la respuesta que ve el usuario. */
export function databaseError(e: unknown, action: string): Response {
  if (e instanceof ConnectionStringError || e instanceof DuplicateBarcodeError) return error(e.message, 409);
  // Solo el nombre: el mensaje del driver podría llevar datos de la conexión.
  console.error(action, e instanceof Error ? e.name : 'error');
  return error(`No se ha podido ${action}. Inténtalo de nuevo.`, 502);
}

/** Cuerpo JSON de la petición, o undefined si no se puede leer. */
export async function readJson(request: Request): Promise<unknown> {
  return request.json().catch(() => undefined);
}

/** Cloudflare sabe la zona horaria de quien llama; las fechas se guardan en su hora local. */
export function requestTimeZone(request: Request): string {
  const zone = (request as { cf?: { timezone?: string } }).cf?.timezone;
  return zone || 'Europe/Madrid';
}

/** Id de la ruta, o null si no es válido. */
export function parseId(value: string | string[] | undefined): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

import type { Game, GameCandidate, GameInput, TrashedGame } from '../domain/game';
import { supabase } from './supabase';

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Llamada a /api con la sesión actual. getSession() renueva el token si ha caducado. */
async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new ApiError('Inicia sesión para continuar.', 401);

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${data.session.access_token}`);

  let response: Response;
  try {
    response = await fetch(path, { ...init, headers });
  } catch {
    throw new ApiError('No hay conexión con el servidor.', 0);
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(body?.error ?? 'Se ha producido un error en el servidor.', response.status);
  }
  return response;
}

function sendJson(method: string, body: unknown): RequestInit {
  return { method, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } };
}

export async function fetchGames(): Promise<Game[]> {
  return (await apiFetch('/api/games')).json() as Promise<Game[]>;
}

export async function createGame(game: GameInput): Promise<Game> {
  return (await apiFetch('/api/games', sendJson('POST', game))).json() as Promise<Game>;
}

export async function updateGame(id: number, changes: Partial<GameInput>): Promise<Game> {
  return (await apiFetch(`/api/games/${id}`, sendJson('PATCH', changes))).json() as Promise<Game>;
}

export async function deleteGame(id: number): Promise<void> {
  await apiFetch(`/api/games/${id}`, { method: 'DELETE' });
}

/** Devuelve los que se han movido a la papelera. */
export async function deleteGames(ids: number[]): Promise<number[]> {
  const response = await apiFetch('/api/games/trash', sendJson('POST', { ids }));
  return ((await response.json()) as { moved: number[] }).moved;
}

export async function fetchTrash(): Promise<TrashedGame[]> {
  return (await apiFetch('/api/trash')).json() as Promise<TrashedGame[]>;
}

export async function restoreGame(id: number): Promise<Game> {
  return (await apiFetch(`/api/trash/${id}/restore`, { method: 'POST' })).json() as Promise<Game>;
}

export async function deleteGameForever(id: number): Promise<void> {
  await apiFetch(`/api/trash/${id}`, { method: 'DELETE' });
}

export async function lookupByBarcode(barcode: string): Promise<GameCandidate[]> {
  const response = await apiFetch(`/api/lookup?barcode=${encodeURIComponent(barcode)}`);
  return response.json() as Promise<GameCandidate[]>;
}

export async function lookupByName(name: string): Promise<GameCandidate[]> {
  const response = await apiFetch(`/api/lookup?name=${encodeURIComponent(name)}`);
  return response.json() as Promise<GameCandidate[]>;
}

export interface AppSettings {
  connectionString: string;
  scanDexToken: string;
  igdbClientId: string;
  igdbClientSecret: string;
  rawgApiKey: string;
  theGamesDbApiKey: string;
}

export async function fetchSettings(): Promise<AppSettings> {
  return (await apiFetch('/api/settings')).json() as Promise<AppSettings>;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await apiFetch('/api/settings', sendJson('PUT', settings));
}

export async function fetchCollectionName(): Promise<string> {
  const { name } = (await (await apiFetch('/api/collection')).json()) as { name: string };
  return name;
}

export async function saveCollectionName(name: string): Promise<void> {
  await apiFetch('/api/collection', sendJson('PUT', { name }));
}

const COVER_CACHE = 'portadas-v1';

/** Al cambiar de base de datos, las portadas guardadas podrían confundirse con las de otros juegos. */
export async function clearCoverCache(): Promise<void> {
  await caches.delete(COVER_CACHE).catch(() => undefined);
}

/**
 * Portada guardada en la base de datos. Se conserva en el móvil para no gastar la transferencia de
 * Neon cada vez; la clave incluye el tamaño para notar si ha cambiado desde otro dispositivo.
 */
export async function fetchCover(game: Game): Promise<Blob> {
  const key = `/portadas/${game.id}-${game.coverSize}`;
  const cache = await caches.open(COVER_CACHE).catch(() => null);

  const cached = await cache?.match(key);
  if (cached) return cached.blob();

  const response = await apiFetch(`/api/games/${game.id}/cover`);
  const blob = await response.blob();
  await cache?.put(key, new Response(blob, { headers: { 'Content-Type': blob.type } })).catch(() => undefined);
  return blob;
}

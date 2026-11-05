// Busca juegos en las fuentes externas, con el mismo orden que GameApiService del escritorio y Android.
// Las claves son opcionales: si falta una, esa fuente se salta sin error.
import { barcodeVariants, extractYear, normalizeBarcode } from '../src/domain/barcode';
import type { GameCandidate } from '../src/domain/game';
import type { UserSettings } from './account';

type LookupKeys = Pick<
  UserSettings,
  'scanDexToken' | 'igdbClientId' | 'igdbClientSecret' | 'rawgApiKey' | 'theGamesDbApiKey'
>;

const TIMEOUT_MS = 12_000;
const USER_AGENT = 'VideoGameLibrary/1.0 (contact@videogamelibrary.app)';
const MAX_BARCODE_CANDIDATES = 6;
const MAX_NAME_CANDIDATES = 25;

function emptyCandidate(title: string, barcode: string | null = null): GameCandidate {
  return { barcode, title, platform: '', genre: '', year: null, coverUrl: '' };
}

/** null si la fuente falla: una fuente caída no debe impedir probar la siguiente. */
async function fetchJson<T>(source: string, url: string, init: RequestInit = {}): Promise<T | null> {
  try {
    const headers = new Headers(init.headers);
    headers.set('User-Agent', USER_AGENT);
    const response = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) {
      console.error(`${source}: respuesta ${response.status}`);
      return null;
    }
    return (await response.json()) as T;
  } catch (e) {
    // Sin la URL: lleva las claves de API.
    console.error(`${source}: ${e instanceof Error ? e.name : 'error'}`);
    return null;
  }
}

function joinNames(items: { name?: string }[] | undefined): string {
  return (items ?? [])
    .map((item) => item.name ?? '')
    .filter(Boolean)
    .join(', ');
}

/** Rellena solo los huecos. Devuelve si ha aportado algo. */
function fillGaps(target: GameCandidate, source: GameCandidate): boolean {
  let filled = false;
  if (!target.coverUrl && source.coverUrl) {
    target.coverUrl = source.coverUrl;
    filled = true;
  }
  if (!target.genre && source.genre) {
    target.genre = source.genre;
    filled = true;
  }
  if (!target.platform && source.platform) {
    target.platform = source.platform;
    filled = true;
  }
  if (target.year === null && source.year !== null) {
    target.year = source.year;
    filled = true;
  }
  return filled;
}

// ── Búsqueda por código de barras ──────────────────────────────────────────

interface ScanDexResponse {
  igdb_metadata?: { name?: string; platform?: { name?: string } };
}

async function searchScanDex(barcode: string, keys: LookupKeys): Promise<GameCandidate | null> {
  const json = await fetchJson<ScanDexResponse>(
    'ScanDex',
    `https://scandex.gamery.app/api/v2/lookup?value=${barcode}`,
    { headers: { Authorization: keys.scanDexToken } },
  );
  const title = json?.igdb_metadata?.name;
  if (!title) return null;
  return { ...emptyCandidate(title, barcode), platform: json?.igdb_metadata?.platform?.name ?? '' };
}

interface UpcItemDbResponse {
  items?: { title?: string; images?: string[] }[];
}

async function searchUpcItemDb(barcode: string): Promise<GameCandidate[]> {
  const json = await fetchJson<UpcItemDbResponse>(
    'UPCitemdb',
    `https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`,
  );
  return (json?.items ?? [])
    .slice(0, MAX_BARCODE_CANDIDATES)
    .filter((item) => item.title)
    .map((item) => ({ ...emptyCandidate(item.title ?? '', barcode), coverUrl: item.images?.[0] ?? '' }));
}

export async function searchByBarcode(rawBarcode: string, keys: LookupKeys): Promise<GameCandidate[]> {
  const barcode = normalizeBarcode(rawBarcode);
  if (!barcode) return [];
  const variants = barcodeVariants(barcode);

  const candidates: GameCandidate[] = [];
  if (keys.scanDexToken) {
    for (const variant of variants) {
      const game = await searchScanDex(variant, keys);
      if (game) {
        candidates.push(game);
        break;
      }
    }
  }

  if (candidates.length === 0) {
    for (const variant of variants) {
      const items = await searchUpcItemDb(variant);
      if (items.length > 0) {
        candidates.push(...items);
        break;
      }
    }
  }

  await Promise.all(
    candidates.map(async (candidate) => {
      candidate.barcode = barcode;
      await enrichFromName(candidate, keys);
    }),
  );
  return candidates;
}

// ── Búsqueda por nombre ────────────────────────────────────────────────────

export async function searchByName(rawName: string, keys: LookupKeys): Promise<GameCandidate[]> {
  const name = rawName.trim();
  if (!name) return [];

  const igdb = await searchIgdb(name, MAX_NAME_CANDIDATES, keys);
  return igdb.length > 0 ? igdb : searchRawg(name, MAX_NAME_CANDIDATES, keys);
}

async function enrichFromName(game: GameCandidate, keys: LookupKeys): Promise<void> {
  if (!game.title) return;

  const [igdb] = await searchIgdb(game.title, 1, keys);
  if (igdb && fillGaps(game, igdb)) return;

  const [rawg] = await searchRawg(game.title, 1, keys);
  if (rawg && fillGaps(game, rawg)) return;

  if (!game.coverUrl) game.coverUrl = await searchTheGamesDbCover(game.title, keys);
}

// ── IGDB ───────────────────────────────────────────────────────────────────

interface TwitchToken {
  clientId: string;
  token: string;
  expiresAt: number;
}

// Se reaprovecha mientras viva el proceso, para no pedir a Twitch un token en cada búsqueda.
let cachedToken: TwitchToken | null = null;

async function getIgdbToken(keys: LookupKeys): Promise<string | null> {
  if (!keys.igdbClientId || !keys.igdbClientSecret) return null;
  if (cachedToken?.clientId === keys.igdbClientId && Date.now() < cachedToken.expiresAt) return cachedToken.token;

  const params = new URLSearchParams({
    client_id: keys.igdbClientId,
    client_secret: keys.igdbClientSecret,
    grant_type: 'client_credentials',
  });
  const json = await fetchJson<{ access_token?: string; expires_in?: number }>(
    'Twitch',
    `https://id.twitch.tv/oauth2/token?${params}`,
    { method: 'POST' },
  );
  if (!json?.access_token) return null;

  cachedToken = {
    clientId: keys.igdbClientId,
    token: json.access_token,
    expiresAt: Date.now() + Math.max((json.expires_in ?? 0) - 60, 0) * 1000,
  };
  return json.access_token;
}

interface IgdbGame {
  name?: string;
  cover?: { url?: string };
  genres?: { name?: string }[];
  platforms?: { name?: string }[];
  first_release_date?: number;
}

async function searchIgdb(name: string, limit: number, keys: LookupKeys): Promise<GameCandidate[]> {
  const token = await getIgdbToken(keys);
  if (!token) return [];

  const escaped = name.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
  const json = await fetchJson<IgdbGame[]>('IGDB', 'https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: { 'Client-ID': keys.igdbClientId, Authorization: `Bearer ${token}` },
    body: `search "${escaped}"; fields name,cover.url,genres.name,platforms.name,first_release_date; limit ${limit};`,
  });

  return (json ?? [])
    .filter((item) => item.name)
    .map((item) => ({
      ...emptyCandidate(item.name ?? ''),
      coverUrl: item.cover?.url ? `https:${item.cover.url.replace('t_thumb', 't_cover_big')}` : '',
      genre: joinNames(item.genres),
      platform: joinNames(item.platforms),
      year: item.first_release_date ? new Date(item.first_release_date * 1000).getUTCFullYear() : null,
    }));
}

// ── RAWG ───────────────────────────────────────────────────────────────────

interface RawgResponse {
  results?: {
    name?: string;
    background_image?: string | null;
    genres?: { name?: string }[];
    platforms?: { platform?: { name?: string } }[];
    released?: string | null;
  }[];
}

async function searchRawg(name: string, limit: number, keys: LookupKeys): Promise<GameCandidate[]> {
  if (!keys.rawgApiKey) return [];

  const json = await fetchJson<RawgResponse>(
    'RAWG',
    `https://api.rawg.io/api/games?search=${encodeURIComponent(name)}&key=${encodeURIComponent(keys.rawgApiKey)}&page_size=${limit}`,
  );
  return (json?.results ?? [])
    .filter((item) => item.name)
    .map((item) => ({
      ...emptyCandidate(item.name ?? ''),
      coverUrl: item.background_image ?? '',
      genre: joinNames(item.genres),
      platform: joinNames(item.platforms?.map((entry) => entry.platform ?? {})),
      year: extractYear(item.released ?? ''),
    }));
}

// ── TheGamesDB (último recurso, solo portada) ──────────────────────────────

interface TheGamesDbResponse {
  data?: { games?: { id?: number }[] };
  include?: {
    boxart?: {
      base_url?: { original?: string };
      data?: Record<string, { side?: string; filename?: string }[]>;
    };
  };
}

async function searchTheGamesDbCover(title: string, keys: LookupKeys): Promise<string> {
  if (!keys.theGamesDbApiKey) return '';

  const json = await fetchJson<TheGamesDbResponse>(
    'TheGamesDB',
    `https://api.thegamesdb.net/v1/Games/ByGameName?apikey=${encodeURIComponent(keys.theGamesDbApiKey)}&name=${encodeURIComponent(title)}&include=boxart`,
  );
  const gameId = json?.data?.games?.[0]?.id;
  const boxart = json?.include?.boxart;
  const baseUrl = boxart?.base_url?.original;
  if (gameId === undefined || !baseUrl) return '';

  const images = boxart?.data?.[String(gameId)] ?? [];
  const file = images.find((image) => image.side === 'front')?.filename ?? images[0]?.filename;
  return file ? baseUrl + file : '';
}

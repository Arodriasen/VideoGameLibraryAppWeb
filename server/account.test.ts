import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSettings, saveSettings } from './account';
import type { Env } from './http';

const env: Env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon' };
const request = new Request('https://app/api/settings', { headers: { Authorization: 'Bearer token' } });
const settings = {
  connectionString: 'Host=a.neon.tech;Database=d;Username=u;Password=p',
  scanDexToken: 'scan',
  igdbClientId: 'id',
  igdbClientSecret: 'secret',
  rawgApiKey: 'rawg',
  theGamesDbApiKey: 'tgdb',
};

function mockFetch(body: unknown, status = 200) {
  const mock = vi.fn(async (..._args: [string, RequestInit]) => Response.json(body, { status }));
  vi.stubGlobal('fetch', mock);
  return mock;
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('loadSettings', () => {
  it('sin token ni siquiera consulta Supabase', async () => {
    const fetchMock = mockFetch([]);
    const result = await loadSettings(new Request('https://app/api/settings'), env);
    expect((result as Response).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('devuelve el id del usuario y sus ajustes', async () => {
    mockFetch([{ user_id: 'abc', connection_string: 'cadena', rawg_api_key: null }]);
    await expect(loadSettings(request, env)).resolves.toMatchObject({
      userId: 'abc',
      connectionString: 'cadena',
      rawgApiKey: '',
    });
  });

  it('avisa si la cuenta no tiene base de datos', async () => {
    mockFetch([]);
    expect(((await loadSettings(request, env)) as Response).status).toBe(409);
  });
});

describe('saveSettings', () => {
  it('filtra por usuario y escribe las columnas de la cuenta', async () => {
    const fetchMock = mockFetch([{ user_id: 'abc' }]);

    await expect(saveSettings(request, env, 'abc', settings)).resolves.toBeNull();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://x.supabase.co/rest/v1/user_settings?user_id=eq.abc');
    expect(init.method).toBe('PATCH');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer token');
    expect(JSON.parse(init.body as string)).toEqual({
      connection_string: settings.connectionString,
      scan_dex_token: 'scan',
      igdb_client_id: 'id',
      igdb_client_secret: 'secret',
      rawg_api_key: 'rawg',
      thegamesdb_api_key: 'tgdb',
    });
  });

  it('no da por guardado si no se ha actualizado ninguna fila', async () => {
    mockFetch([]);
    const result = await saveSettings(request, env, 'abc', settings);
    expect(result?.status).toBe(502);
  });

  it('informa de la sesión caducada', async () => {
    mockFetch({ message: 'JWT expired' }, 401);
    const result = await saveSettings(request, env, 'abc', settings);
    expect(result?.status).toBe(401);
  });

  it('informa si Supabase no responde', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('sin red')));
    const result = await saveSettings(request, env, 'abc', settings);
    expect(result?.status).toBe(502);
  });
});

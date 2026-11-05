import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { searchByBarcode, searchByName } from './gameLookup';

const NO_KEYS = { scanDexToken: '', igdbClientId: '', igdbClientSecret: '', rawgApiKey: '', theGamesDbApiKey: '' };
const ALL_KEYS = { scanDexToken: 'scan', igdbClientId: 'client', igdbClientSecret: 'secret', rawgApiKey: 'rawg', theGamesDbApiKey: 'tgdb' };

type Responder = (url: string, init?: RequestInit) => unknown;

function mockFetch(respond: Responder) {
  const mock = vi.fn(async (url: string, init?: RequestInit) => {
    const body = respond(url, init);
    return body === undefined ? new Response('', { status: 404 }) : Response.json(body);
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

const twitch = { access_token: 'token', expires_in: 5000 };
const igdbGame = {
  name: 'Halo 3',
  cover: { url: '//images.igdb.com/t_thumb/co1.jpg' },
  genres: [{ name: 'Shooter' }, { name: 'Acción' }],
  platforms: [{ name: 'Xbox 360' }],
  first_release_date: 1190073600,
};

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('searchByBarcode', () => {
  it('usa ScanDex primero y completa los huecos con IGDB', async () => {
    const fetchMock = mockFetch((url) => {
      if (url.includes('scandex')) return { igdb_metadata: { name: 'Halo 3', platform: { name: 'Xbox' } } };
      if (url.includes('twitch')) return twitch;
      if (url.includes('igdb')) return [igdbGame];
      return undefined;
    });

    const [game] = await searchByBarcode('0454-9659-0048', ALL_KEYS);

    expect(game).toEqual({
      barcode: '045496590048',
      title: 'Halo 3',
      platform: 'Xbox', // El de ScanDex se respeta: IGDB solo rellena huecos.
      genre: 'Shooter, Acción',
      year: 2007,
      coverUrl: 'https://images.igdb.com/t_cover_big/co1.jpg',
    });
    expect(fetchMock.mock.calls.some(([url]) => url.includes('upcitemdb'))).toBe(false);
  });

  it('prueba las dos formas del código en UPCitemdb', async () => {
    const fetchMock = mockFetch((url) => {
      if (url.includes('upc=0045496590048')) return { items: [{ title: 'Juego', images: ['http://a/b.jpg'] }] };
      if (url.includes('upc=045496590048')) return { items: [] };
      return undefined;
    });

    const games = await searchByBarcode('045496590048', NO_KEYS);

    expect(games.map((game) => game.title)).toEqual(['Juego']);
    expect(games[0].barcode).toBe('045496590048');
    expect(games[0].coverUrl).toBe('http://a/b.jpg');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('devuelve vacío si no hay nada, aunque las fuentes fallen', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('sin red')));
    await expect(searchByBarcode('123456789012', ALL_KEYS)).resolves.toEqual([]);
  });

  it('usa TheGamesDB para la portada si nada más la da', async () => {
    mockFetch((url) => {
      if (url.includes('upcitemdb')) return { items: [{ title: 'Raro' }] };
      if (url.includes('thegamesdb')) {
        return {
          data: { games: [{ id: 7 }] },
          include: {
            boxart: {
              base_url: { original: 'https://cdn/' },
              data: { 7: [{ side: 'back', filename: 'b.jpg' }, { side: 'front', filename: 'f.jpg' }] },
            },
          },
        };
      }
      return undefined;
    });

    const [game] = await searchByBarcode('123456789012', { ...NO_KEYS, theGamesDbApiKey: 'tgdb' });
    expect(game.coverUrl).toBe('https://cdn/f.jpg');
  });
});

describe('searchByName', () => {
  it('escapa las comillas del título al buscar en IGDB', async () => {
    const fetchMock = mockFetch((url) => {
      if (url.includes('twitch')) return twitch;
      if (url.includes('igdb')) return [igdbGame];
      return undefined;
    });

    const games = await searchByName('  Halo "3"  ', ALL_KEYS);

    expect(games).toHaveLength(1);
    const igdbCall = fetchMock.mock.calls.find(([url]) => url.includes('igdb'));
    expect(igdbCall?.[1]?.body).toContain('search "Halo \\"3\\"";');
    expect(igdbCall?.[1]?.body).toContain('limit 25;');
  });

  it('recurre a RAWG si IGDB no encuentra nada', async () => {
    mockFetch((url) => {
      if (url.includes('twitch')) return twitch;
      if (url.includes('igdb')) return [];
      if (url.includes('rawg')) {
        return {
          results: [
            {
              name: 'Zelda',
              background_image: 'https://r/z.jpg',
              genres: [{ name: 'Aventura' }],
              platforms: [{ platform: { name: 'Switch' } }],
              released: '2017-03-03',
            },
          ],
        };
      }
      return undefined;
    });

    await expect(searchByName('zelda', ALL_KEYS)).resolves.toEqual([
      { barcode: null, title: 'Zelda', platform: 'Switch', genre: 'Aventura', year: 2017, coverUrl: 'https://r/z.jpg' },
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import type { Game } from './game';
import { computeStats } from './gameStats';

function game(changes: Partial<Game>): Game {
  return {
    id: 1,
    barcode: null,
    title: 'Juego',
    platform: '',
    publisher: '',
    genre: '',
    tags: '',
    year: null,
    coverUrl: '',
    notes: '',
    rating: 0,
    played: false,
    isWishlist: false,
    addedDate: '2026-01-15 10:00:00.123456',
    coverSize: 0,
    ...changes,
  };
}

describe('computeStats', () => {
  it('sin juegos no inventa un porcentaje', () => {
    expect(computeStats([])).toMatchObject({ total: 0, played: 0, playedPercent: null, wishlist: 0, byPlatform: [] });
  });

  it('no mezcla los deseados con la colección', () => {
    const stats = computeStats([
      game({ played: true, platform: 'PC' }),
      game({ platform: 'PC' }),
      game({ platform: 'Switch' }),
      game({ isWishlist: true, played: true, platform: 'Xbox' }),
    ]);

    expect(stats).toMatchObject({ total: 3, played: 1, wishlist: 1 });
    expect(stats.byPlatform.map((row) => row.label)).toEqual(['PC', 'Switch']);
  });

  it('redondea hacia abajo, como el escritorio', () => {
    const stats = computeStats([game({ played: true }), game({ played: true }), game({})]);
    expect(stats.playedPercent).toBe(66);
  });

  it('un juego con varios géneros cuenta en cada uno', () => {
    const stats = computeStats([game({ genre: 'Acción, Aventura' }), game({ genre: 'Acción' })]);
    expect(stats.byGenre).toEqual([
      { label: 'Acción', count: 2, percent: 100 },
      { label: 'Aventura', count: 1, percent: 50 },
    ]);
  });

  it('agrupa sin distinguir mayúsculas ni acentos', () => {
    const stats = computeStats([game({ genre: 'Acción' }), game({ genre: 'accion' })]);
    expect(stats.byGenre).toEqual([{ label: 'Acción', count: 2, percent: 100 }]);
  });

  it('ordena de más a menos y desempata por nombre', () => {
    const stats = computeStats([game({ tags: 'zeta' }), game({ tags: 'alfa' }), game({ tags: 'beta, alfa' })]);
    expect(stats.byTag.map((row) => row.label)).toEqual(['alfa', 'beta', 'zeta']);
  });

  it('los años de alta van en orden cronológico', () => {
    const stats = computeStats([
      game({ addedDate: '2026-03-01 10:00:00' }),
      game({ addedDate: '2024-03-01 10:00:00' }),
      game({ addedDate: '2026-04-01 10:00:00' }),
    ]);
    expect(stats.byYearAdded).toEqual([
      { label: '2024', count: 1, percent: 33 },
      { label: '2026', count: 2, percent: 66 },
    ]);
  });

  it('agrupa por década e ignora los juegos sin año', () => {
    const stats = computeStats([game({ year: 1998 }), game({ year: 1991 }), game({ year: 2003 }), game({})]);
    expect(stats.byReleaseDecade.map((row) => [row.label, row.count])).toEqual([
      ['1990s', 2],
      ['2000s', 1],
    ]);
  });
});

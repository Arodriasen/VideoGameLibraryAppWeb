import { describe, expect, it } from 'vitest';
import type { Game } from './game';
import {
  activeFilterCount,
  filterOptions,
  matchesFilters,
  NO_FILTERS,
  readFilters,
  readSort,
  sortGames,
  writeFilters,
} from './gameFilter';

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
    addedDate: '2026-01-01 10:00:00',
    coverSize: 0,
    ...changes,
  };
}

describe('matchesFilters', () => {
  it('sin filtros entra todo', () => {
    expect(matchesFilters(game({}), NO_FILTERS)).toBe(true);
  });

  it('encuentra una plataforma dentro de una lista', () => {
    const multi = game({ platform: 'PC, PlayStation 4' });
    expect(matchesFilters(multi, { ...NO_FILTERS, platforms: ['PC'] })).toBe(true);
    expect(matchesFilters(multi, { ...NO_FILTERS, platforms: ['Xbox'] })).toBe(false);
  });

  it('no confunde una plataforma con otra que la contiene', () => {
    const ps4 = game({ platform: 'PlayStation 4' });
    expect(matchesFilters(ps4, { ...NO_FILTERS, platforms: ['PlayStation'] })).toBe(false);
  });

  it('dentro de una categoría basta con una opción', () => {
    expect(matchesFilters(game({ genre: 'RPG' }), { ...NO_FILTERS, genres: ['Acción', 'RPG'] })).toBe(true);
  });

  it('entre categorías deben cumplirse todas', () => {
    const rpg = game({ genre: 'RPG', year: 2020 });
    expect(matchesFilters(rpg, { ...NO_FILTERS, genres: ['RPG'], years: ['2021'] })).toBe(false);
  });

  it('filtra por etiqueta, puntuación y estado', () => {
    const item = game({ tags: 'favorito, prestado', rating: 0, played: true });
    expect(matchesFilters(item, { ...NO_FILTERS, tags: ['prestado'] })).toBe(true);
    expect(matchesFilters(item, { ...NO_FILTERS, ratings: ['0'] })).toBe(true);
    expect(matchesFilters(item, { ...NO_FILTERS, ratings: ['5'] })).toBe(false);
    expect(matchesFilters(item, { ...NO_FILTERS, played: ['si'] })).toBe(true);
    expect(matchesFilters(item, { ...NO_FILTERS, played: ['no'] })).toBe(false);
  });
});

describe('sortGames', () => {
  const games = [
    game({ id: 1, title: 'Beta', platform: 'Switch', year: 2020, addedDate: '2026-01-01 10:00:00' }),
    game({ id: 2, title: 'Álfa', platform: 'PC', year: null, addedDate: '2026-03-01 10:00:00' }),
    game({ id: 3, title: 'Casa', platform: 'PC', year: 2024, addedDate: '2026-02-01 10:00:00' }),
  ];
  const ids = (sort: Parameters<typeof sortGames>[1]) => sortGames(games, sort).map((item) => item.id);

  it('ordena por título respetando los acentos', () => {
    expect(ids('titulo')).toEqual([2, 1, 3]);
  });

  it('por plataforma y luego por título', () => {
    expect(ids('plataforma')).toEqual([2, 3, 1]);
  });

  it('por año, con los que no tienen al final', () => {
    expect(ids('anio')).toEqual([3, 1, 2]);
  });

  it('los añadidos más recientes primero', () => {
    expect(ids('recientes')).toEqual([2, 3, 1]);
  });

  it('no altera la lista original', () => {
    sortGames(games, 'anio');
    expect(games.map((item) => item.id)).toEqual([1, 2, 3]);
  });
});

describe('filterOptions', () => {
  it('saca opciones sin repetir y años de mayor a menor', () => {
    const options = filterOptions([
      game({ platform: 'PC, Switch', genre: 'RPG', tags: 'favorito', year: 2020 }),
      game({ platform: 'pc', genre: 'Acción, RPG', year: 2024 }),
      game({ year: null }),
    ]);

    expect(options).toEqual({
      platforms: ['PC', 'Switch'],
      genres: ['Acción', 'RPG'],
      tags: ['favorito'],
      years: ['2024', '2020'],
    });
  });
});

describe('filtros en la dirección', () => {
  it('se conservan de ida y vuelta, sin tocar el resto de parámetros', () => {
    const filters = { ...NO_FILTERS, platforms: ['PC', 'Nintendo Switch'], ratings: ['5'] };

    const params = writeFilters(new URLSearchParams('lista=deseados'), filters);

    expect(readFilters(params)).toEqual(filters);
    expect(params.get('lista')).toBe('deseados');
  });

  it('quitar filtros limpia la dirección', () => {
    const params = writeFilters(new URLSearchParams('plataforma=PC&q=zelda'), NO_FILTERS);
    expect(params.toString()).toBe('q=zelda');
  });

  it('cuenta las opciones activas', () => {
    expect(activeFilterCount({ ...NO_FILTERS, platforms: ['PC', 'Switch'], played: ['si'] })).toBe(3);
  });

  it('un orden desconocido vuelve al título', () => {
    expect(readSort(new URLSearchParams('orden=toString'))).toBe('titulo');
    expect(readSort(new URLSearchParams('orden=rara'))).toBe('titulo');
    expect(readSort(new URLSearchParams('orden=anio'))).toBe('anio');
  });
});

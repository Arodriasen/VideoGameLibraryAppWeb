import { distinctSorted, splitList, type Game } from './game';

export type GameSort = 'titulo' | 'plataforma' | 'anio' | 'recientes';

export const SORT_LABELS: Record<GameSort, string> = {
  titulo: 'Título',
  plataforma: 'Plataforma',
  anio: 'Año',
  recientes: 'Añadidos recientemente',
};

export interface GameFilters {
  platforms: string[];
  genres: string[];
  tags: string[];
  years: string[];
  /** Puntuación de 1 a 5, o "0" para los que no tienen. */
  ratings: string[];
  /** "si" jugados, "no" pendientes. */
  played: string[];
}

export type FilterKey = keyof GameFilters;

export const NO_FILTERS: GameFilters = { platforms: [], genres: [], tags: [], years: [], ratings: [], played: [] };

const same = (a: string, b: string) => a.localeCompare(b, 'es', { sensitivity: 'base' }) === 0;
const includesAny = (values: string[], selected: string[]) =>
  selected.some((item) => values.some((value) => same(value, item)));

/** Dentro de una categoría basta con cumplir una opción; entre categorías hay que cumplirlas todas. */
export function matchesFilters(game: Game, filters: GameFilters): boolean {
  if (filters.platforms.length > 0 && !includesAny(splitList(game.platform), filters.platforms)) return false;
  if (filters.genres.length > 0 && !includesAny(splitList(game.genre), filters.genres)) return false;
  if (filters.tags.length > 0 && !includesAny(splitList(game.tags), filters.tags)) return false;
  if (filters.years.length > 0 && !filters.years.includes(String(game.year))) return false;
  if (filters.ratings.length > 0 && !filters.ratings.includes(String(game.rating))) return false;
  if (filters.played.length > 0 && !filters.played.includes(game.played ? 'si' : 'no')) return false;
  return true;
}

export function activeFilterCount(filters: GameFilters): number {
  return Object.values(filters).reduce((total, values) => total + values.length, 0);
}

const byTitle = (a: Game, b: Game) => a.title.localeCompare(b.title, 'es');

export function sortGames(games: Game[], sort: GameSort): Game[] {
  const sorted = [...games];
  switch (sort) {
    case 'plataforma':
      return sorted.sort((a, b) => a.platform.localeCompare(b.platform, 'es') || byTitle(a, b));
    case 'anio':
      return sorted.sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || byTitle(a, b));
    case 'recientes':
      return sorted.sort((a, b) => b.addedDate.localeCompare(a.addedDate));
    default:
      return sorted.sort(byTitle);
  }
}

export interface FilterOptions {
  platforms: string[];
  genres: string[];
  tags: string[];
  years: string[];
}

/** Solo lo que existe en la lista actual, para no ofrecer filtros que dejarían la lista vacía. */
export function filterOptions(games: Game[]): FilterOptions {
  const years = [...new Set(games.flatMap((game) => (game.year === null ? [] : [String(game.year)])))];
  return {
    platforms: distinctSorted(games.flatMap((game) => splitList(game.platform))),
    genres: distinctSorted(games.flatMap((game) => splitList(game.genre))),
    tags: distinctSorted(games.flatMap((game) => splitList(game.tags))),
    years: years.sort((a, b) => b.localeCompare(a)),
  };
}

// En la dirección, para no perderlos al entrar en una ficha y volver.
const PARAM_NAMES: Record<FilterKey, string> = {
  platforms: 'plataforma',
  genres: 'genero',
  tags: 'etiqueta',
  years: 'anio',
  ratings: 'estrellas',
  played: 'jugado',
};

export function readFilters(params: URLSearchParams): GameFilters {
  return {
    platforms: params.getAll(PARAM_NAMES.platforms),
    genres: params.getAll(PARAM_NAMES.genres),
    tags: params.getAll(PARAM_NAMES.tags),
    years: params.getAll(PARAM_NAMES.years),
    ratings: params.getAll(PARAM_NAMES.ratings),
    played: params.getAll(PARAM_NAMES.played),
  };
}

export function writeFilters(params: URLSearchParams, filters: GameFilters): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const key of Object.keys(PARAM_NAMES) as FilterKey[]) {
    next.delete(PARAM_NAMES[key]);
    for (const value of filters[key]) next.append(PARAM_NAMES[key], value);
  }
  return next;
}

export function readSort(params: URLSearchParams): GameSort {
  const sort = params.get('orden');
  return sort !== null && Object.hasOwn(SORT_LABELS, sort) ? (sort as GameSort) : 'titulo';
}

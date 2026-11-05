import { normalizeText, parseLocalDate, splitList, type Game } from './game';

export interface StatRow {
  label: string;
  count: number;
  /** Sobre el total de la colección. Un juego con dos géneros cuenta en los dos. */
  percent: number;
}

export interface GameStats {
  total: number;
  played: number;
  /** null si no hay juegos, para no mostrar un 0 % engañoso. */
  playedPercent: number | null;
  wishlist: number;
  byPlatform: StatRow[];
  byGenre: StatRow[];
  byTag: StatRow[];
  /** En orden cronológico: representan una evolución, no un ranking. */
  byYearAdded: StatRow[];
  byReleaseDecade: StatRow[];
}

/** Mismo redondeo que las estadísticas del escritorio, para que las cifras coincidan. */
const percentOf = (count: number, total: number) => (total > 0 ? Math.floor((count * 100) / total) : 0);

function rows(labels: string[], total: number): StatRow[] {
  const groups = new Map<string, { label: string; count: number }>();
  for (const label of labels) {
    const key = normalizeText(label);
    const group = groups.get(key);
    if (group) group.count += 1;
    else groups.set(key, { label, count: 1 });
  }
  return [...groups.values()].map((group) => ({ ...group, percent: percentOf(group.count, total) }));
}

function ranked(labels: string[], total: number): StatRow[] {
  return rows(labels, total).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'es'));
}

function chronological(labels: string[], total: number): StatRow[] {
  return rows(labels, total).sort((a, b) => a.label.localeCompare(b.label));
}

export function computeStats(games: Game[]): GameStats {
  // Como en el escritorio, lo que aún no tienes no cuenta para la colección.
  const owned = games.filter((game) => !game.isWishlist);
  const total = owned.length;
  const played = owned.filter((game) => game.played).length;

  return {
    total,
    played,
    playedPercent: total > 0 ? percentOf(played, total) : null,
    wishlist: games.length - total,
    byPlatform: ranked(owned.flatMap((game) => splitList(game.platform)), total),
    byGenre: ranked(owned.flatMap((game) => splitList(game.genre)), total),
    byTag: ranked(owned.flatMap((game) => splitList(game.tags)), total),
    byYearAdded: chronological(owned.map((game) => String(parseLocalDate(game.addedDate).getFullYear())), total),
    byReleaseDecade: chronological(
      owned.flatMap((game) => (game.year === null ? [] : [`${Math.floor(game.year / 10) * 10}s`])),
      total,
    ),
  };
}

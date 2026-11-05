export interface Game {
  id: number;
  barcode: string | null;
  title: string;
  platform: string;
  publisher: string;
  genre: string;
  tags: string;
  year: number | null;
  coverUrl: string;
  notes: string;
  rating: number;
  played: boolean;
  isWishlist: boolean;
  addedDate: string;
  /** Bytes de la portada guardada en la base de datos; 0 si no hay. */
  coverSize: number;
}

export interface TrashedGame extends Game {
  deletedDate: string;
}

/** Lo que se puede guardar de un juego; el resto lo pone el servidor. */
export type GameInput = Omit<Game, 'id' | 'addedDate' | 'coverSize'>;

/** Resultado de buscar un juego en las fuentes externas. */
export interface GameCandidate {
  barcode: string | null;
  title: string;
  platform: string;
  genre: string;
  year: number | null;
  coverUrl: string;
}

/** Sin distinguir mayúsculas ni acentos. */
export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export function matchesSearch(game: Game, search: string): boolean {
  const term = normalizeText(search.trim());
  if (!term) return true;
  return normalizeText(`${game.title} ${game.platform} ${game.genre}`).includes(term);
}

/** Un mismo juego puede tener el código como UPC (12 cifras) o EAN (13, con un 0 delante). */
export function sameBarcode(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const digits = (code: string) => code.replace(/\D/g, '').replace(/^0+/, '');
  return digits(a) !== '' && digits(a) === digits(b);
}

/** Mismo texto que al compartir desde Android. */
export function shareText(game: Game): string {
  const year = game.year ? ` (${game.year})` : '';
  const list = game.isWishlist ? 'en mi lista de deseos' : 'en mi colección';
  return `${game.title} - ${game.platform}${year}, ${list} de Mi Colección de Juegos`;
}

/** Mismo texto que al compartir varios juegos desde Android. */
export function shareListText(games: Game[]): string {
  const lines = games.map((game) => `• ${game.title} - ${game.platform}${game.year ? ` (${game.year})` : ''}`);
  return `Mi colección de juegos (${games.length}):\n${lines.join('\n')}`;
}

/** Las fechas vienen de Postgres en hora local y sin zona: "2026-11-05 08:10:00.123456". */
export function parseLocalDate(date: string): Date {
  return new Date(date.slice(0, 19).replace(' ', 'T'));
}

export const TRASH_RETENTION_DAYS = 7;

/** Mismo cálculo y textos que la papelera de Android. */
export function trashDaysLeftText(deletedDate: string, now = new Date()): string {
  const elapsedDays = Math.floor((now.getTime() - parseLocalDate(deletedDate).getTime()) / 86_400_000);
  const daysLeft = TRASH_RETENTION_DAYS - elapsedDays;
  if (daysLeft <= 0) return 'Se elimina hoy';
  return daysLeft === 1 ? 'Se elimina en 1 día' : `Se elimina en ${daysLeft} días`;
}

/** Géneros y etiquetas se guardan como un único texto separado por comas. */
export function splitList(text: string): string[] {
  return text
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Valores distintos sin repetir por mayúsculas, para sugerirlos al escribir. */
export function distinctSorted(values: string[]): string[] {
  const unique = new Map<string, string>();
  for (const value of values) {
    const key = normalizeText(value);
    if (key && !unique.has(key)) unique.set(key, value);
  }
  return [...unique.values()].sort((a, b) => a.localeCompare(b, 'es'));
}

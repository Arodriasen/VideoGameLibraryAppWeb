import { describe, expect, it } from 'vitest';
import { matchesSearch, parseLocalDate, sameBarcode, trashDaysLeftText, type Game } from './game';

const game = { title: 'Pokémon Rojo', platform: 'Game Boy', genre: 'RPG' } as Game;

describe('matchesSearch', () => {
  it('ignora mayúsculas y acentos', () => {
    expect(matchesSearch(game, 'POKEMON')).toBe(true);
  });

  it('busca también en plataforma y género', () => {
    expect(matchesSearch(game, 'game boy')).toBe(true);
    expect(matchesSearch(game, 'rpg')).toBe(true);
  });

  it('una búsqueda vacía encaja con todo', () => {
    expect(matchesSearch(game, '  ')).toBe(true);
  });

  it('descarta lo que no coincide', () => {
    expect(matchesSearch(game, 'zelda')).toBe(false);
  });
});

describe('parseLocalDate', () => {
  it('entiende el formato de Postgres con microsegundos', () => {
    const date = parseLocalDate('2026-11-05 08:10:00.123456');
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([2026, 10, 5, 8]);
  });
});

describe('trashDaysLeftText', () => {
  const now = new Date(2026, 10, 10, 12);

  it.each([
    ['2026-11-10 11:00:00', 'Se elimina en 7 días'],
    ['2026-11-04 12:00:00', 'Se elimina en 1 día'],
    ['2026-11-03 12:00:00', 'Se elimina hoy'],
    ['2026-10-01 12:00:00', 'Se elimina hoy'],
  ])('%s', (deletedDate, expected) => {
    expect(trashDaysLeftText(deletedDate, now)).toBe(expected);
  });
});

describe('sameBarcode', () => {
  it('considera iguales el UPC y su EAN con 0 delante', () => {
    expect(sameBarcode('045496590420', '0045496590420')).toBe(true);
  });

  it('distingue códigos diferentes', () => {
    expect(sameBarcode('045496590420', '045496590421')).toBe(false);
  });

  it('no da por iguales los vacíos', () => {
    expect(sameBarcode(null, null)).toBe(false);
    expect(sameBarcode('', '000')).toBe(false);
  });
});

// Acceso a la colección en Neon. El dueño del esquema es la app de escritorio: aquí no se aplican
// migraciones. Las columnas van entre comillas porque EF Core las creó en PascalCase.
import { neon } from '@neondatabase/serverless';
import { barcodeVariants } from '../src/domain/barcode';
import type { Game, TrashedGame } from '../src/domain/game';
import { toNeonUrl } from './connectionString';
import type { GameChanges, NewGame } from './gameInput';

interface GameRow {
  Id: number;
  Barcode: string | null;
  Title: string;
  Platform: string;
  Publisher: string;
  Genre: string;
  Tags: string;
  Year: number | null;
  CoverUrl: string;
  Notes: string;
  Rating: number;
  Played: boolean;
  IsWishlist: boolean;
  AddedDate: string;
  CoverSize: number;
}

export type QueryFn = (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;

export class DuplicateBarcodeError extends Error {}

/**
 * Sin "CoverData": las portadas se guardan aparte y leerlas todas con Neon recién despertado tarda
 * casi un minuto. octet_length() da el tamaño sin leerlas.
 */
const GAME_COLUMNS = `"Id", "Barcode", "Title", "Platform", "Publisher", "Genre", "Tags", "Year", "CoverUrl",
  "Notes", "Rating", "Played", "IsWishlist", "AddedDate"::text AS "AddedDate",
  COALESCE(octet_length("CoverData"), 0)::int AS "CoverSize"`;

/** Qué columna guarda cada campo que se puede cambiar. */
const CHANGE_COLUMNS: Record<keyof GameChanges, string> = {
  barcode: 'Barcode',
  title: 'Title',
  platform: 'Platform',
  genre: 'Genre',
  publisher: 'Publisher',
  tags: 'Tags',
  year: 'Year',
  coverUrl: 'CoverUrl',
  notes: 'Notes',
  rating: 'Rating',
  played: 'Played',
  isWishlist: 'IsWishlist',
};

export function createGameRepository(connectionString: string) {
  const sql = neon(toNeonUrl(connectionString));
  return gameRepository((text, params) => sql.query(text, params) as Promise<Record<string, unknown>[]>);
}

/** Tabla de una sola fila; las otras apps la crean igual, sin migraciones, si aún no existe. */
const ENSURE_COLLECTION_SETTINGS = `CREATE TABLE IF NOT EXISTS "CollectionSettings"
  ("Id" integer PRIMARY KEY CHECK ("Id" = 1), "Name" text NOT NULL DEFAULT '')`;

export function gameRepository(query: QueryFn) {
  return {
    /** Falla si no se puede conectar o si esa base de datos no tiene colección. */
    async assertCollectionExists(): Promise<void> {
      await query(`SELECT 1 FROM "Games" LIMIT 1`);
    },

    async getCollectionName(): Promise<string> {
      await query(ENSURE_COLLECTION_SETTINGS);
      const rows = await query(`SELECT "Name" FROM "CollectionSettings" WHERE "Id" = 1`);
      return (rows[0]?.Name as string | undefined) ?? '';
    },

    async setCollectionName(name: string): Promise<void> {
      await query(ENSURE_COLLECTION_SETTINGS);
      await query(
        `INSERT INTO "CollectionSettings" ("Id", "Name") VALUES (1, $1)
         ON CONFLICT ("Id") DO UPDATE SET "Name" = EXCLUDED."Name"`,
        [name],
      );
    },

    async getAll(): Promise<Game[]> {
      const rows = await query(`SELECT ${GAME_COLUMNS} FROM "Games" WHERE "DeletedDate" IS NULL ORDER BY "Title"`);
      return rows.map(toGame);
    },

    /** Portada guardada en la base de datos, o null si el juego no tiene. */
    async getCover(id: number): Promise<Uint8Array<ArrayBuffer> | null> {
      // En base64 para no depender de cómo entrega el driver los bytea por HTTP.
      const rows = await query(
        `SELECT encode("CoverData", 'base64') AS "Cover" FROM "Games" WHERE "Id" = $1 AND "CoverData" IS NOT NULL`,
        [id],
      );
      if (rows.length === 0) return null;

      // Postgres parte el base64 en líneas de 76 caracteres.
      const binary = atob((rows[0].Cover as string).replace(/\s/g, ''));
      return Uint8Array.from(binary, (char) => char.charCodeAt(0));
    },

    /** Las fechas van en hora local, como en las otras apps (columnas sin zona horaria). */
    async create(game: NewGame, cover: Uint8Array | null, timeZone: string): Promise<Game> {
      if (game.barcode) await assertBarcodeIsFree(query, game.barcode);

      const rows = await query(
        `INSERT INTO "Games" ("Barcode", "Title", "Platform", "Publisher", "Genre", "Tags", "Year", "CoverUrl",
                              "CoverData", "Notes", "Rating", "Played", "IsWishlist", "AddedDate")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, decode($9::text, 'base64'), $10, $11, $12, $13, timezone($14::text, now()))
         RETURNING ${GAME_COLUMNS}`,
        [
          game.barcode,
          game.title,
          game.platform,
          game.publisher,
          game.genre,
          game.tags,
          game.year,
          game.coverUrl,
          cover ? toBase64(cover) : null,
          game.notes,
          game.rating,
          game.played,
          game.isWishlist,
          timeZone,
        ],
      ).catch(rethrowDuplicate);
      return toGame(rows[0]);
    },

    /**
     * Cambia solo los campos recibidos: a diferencia de reescribir la fila entera, así no se pierde
     * la portada ni lo que otro dispositivo haya cambiado mientras tanto.
     * `cover` undefined deja la portada guardada como está; null la quita.
     */
    async update(id: number, changes: GameChanges, cover?: Uint8Array | null): Promise<Game | null> {
      const assignments: string[] = [];
      const params: unknown[] = [id];

      for (const [field, column] of Object.entries(CHANGE_COLUMNS)) {
        const value = changes[field as keyof GameChanges];
        if (value === undefined) continue;
        params.push(value);
        assignments.push(`"${column}" = $${params.length}`);
      }
      if (cover !== undefined) {
        params.push(cover ? toBase64(cover) : null);
        assignments.push(`"CoverData" = decode($${params.length}::text, 'base64')`);
      }

      // Sin cambios, una asignación neutra devuelve el juego igualmente.
      const set = assignments.length > 0 ? assignments.join(', ') : '"Id" = "Id"';
      const rows = await query(
        `UPDATE "Games" SET ${set} WHERE "Id" = $1 AND "DeletedDate" IS NULL RETURNING ${GAME_COLUMNS}`,
        params,
      ).catch(rethrowDuplicate);
      return rows.length > 0 ? toGame(rows[0]) : null;
    },

    /** Una sola sentencia: o se mueven todos, o ninguno. Devuelve los que estaban activos. */
    async moveManyToTrash(ids: number[], timeZone: string): Promise<number[]> {
      const placeholders = ids.map((_, index) => `$${index + 2}`).join(', ');
      const rows = await query(
        `UPDATE "Games" SET "DeletedDate" = timezone($1::text, now())
         WHERE "DeletedDate" IS NULL AND "Id" IN (${placeholders}) RETURNING "Id"`,
        [timeZone, ...ids],
      );
      return rows.map((row) => row.Id as number);
    },

    async getTrash(): Promise<TrashedGame[]> {
      const rows = await query(
        `SELECT ${GAME_COLUMNS}, "DeletedDate"::text AS "DeletedDate"
         FROM "Games" WHERE "DeletedDate" IS NOT NULL ORDER BY "Games"."DeletedDate" DESC`,
      );
      return rows.map((row) => ({ ...toGame(row), deletedDate: row.DeletedDate as string }));
    },

    async restore(id: number): Promise<Game | null> {
      const rows = await query(
        `UPDATE "Games" SET "DeletedDate" = NULL WHERE "Id" = $1 AND "DeletedDate" IS NOT NULL RETURNING ${GAME_COLUMNS}`,
        [id],
      ).catch(rethrowDuplicate);
      return rows.length > 0 ? toGame(rows[0]) : null;
    },

    /** Borrado real. Exige que esté en la papelera: un juego activo nunca se puede borrar de golpe. */
    async deleteForever(id: number): Promise<boolean> {
      const rows = await query(`DELETE FROM "Games" WHERE "Id" = $1 AND "DeletedDate" IS NOT NULL RETURNING "Id"`, [id]);
      return rows.length > 0;
    },

    /** Lo pasa a la papelera, de donde se puede recuperar durante 7 días. */
    async moveToTrash(id: number, timeZone: string): Promise<boolean> {
      const rows = await query(
        `UPDATE "Games" SET "DeletedDate" = timezone($2::text, now())
         WHERE "Id" = $1 AND "DeletedDate" IS NULL RETURNING "Id"`,
        [id, timeZone],
      );
      return rows.length > 0;
    },
  };
}

/** El índice único compara el texto exacto: aquí se detecta también el mismo código en la otra forma. */
async function assertBarcodeIsFree(query: QueryFn, barcode: string): Promise<void> {
  const variants = barcodeVariants(barcode);
  const placeholders = variants.map((_, index) => `$${index + 1}`).join(', ');
  const rows = await query(
    `SELECT 1 FROM "Games" WHERE "DeletedDate" IS NULL AND "Barcode" IN (${placeholders}) LIMIT 1`,
    variants,
  );
  if (rows.length > 0) throw new DuplicateBarcodeError('Ya tienes un juego con este código de barras.');
}

/** 23505: el índice único de "Barcode" ha rechazado el valor. */
function rethrowDuplicate(e: unknown): never {
  if ((e as { code?: string } | null)?.code === '23505') {
    throw new DuplicateBarcodeError('Ya tienes un juego con este código de barras.');
  }
  throw e;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function toGame(record: Record<string, unknown>): Game {
  const row = record as unknown as GameRow;
  return {
    id: row.Id,
    barcode: row.Barcode,
    title: row.Title,
    platform: row.Platform,
    publisher: row.Publisher,
    genre: row.Genre,
    tags: row.Tags,
    year: row.Year,
    coverUrl: row.CoverUrl,
    notes: row.Notes,
    rating: row.Rating,
    played: row.Played,
    isWishlist: row.IsWishlist,
    addedDate: row.AddedDate,
    coverSize: row.CoverSize,
  };
}

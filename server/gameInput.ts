// Valida lo que llega del navegador antes de que toque la base de datos.
import { z } from 'zod';
import { canonicalBarcode } from '../src/domain/barcode';

const text = (max: number) => z.string().trim().max(max);

const fields = {
  barcode: z
    .string()
    .max(32)
    .nullable()
    .transform((value) => (value ? canonicalBarcode(value) || null : null)),
  title: text(300).min(1, 'El título es obligatorio.'),
  platform: text(1000),
  genre: text(1000),
  publisher: text(300),
  tags: text(1000),
  year: z.number().int().min(1950).max(2100).nullable(),
  coverUrl: text(2000),
  notes: text(10_000),
  rating: z.number().int().min(0).max(5),
  played: z.boolean(),
  isWishlist: z.boolean(),
};

export const gameIdsSchema = z.object({ ids: z.array(z.number().int().positive()).min(1).max(1000) });

export const newGameSchema = z.object(fields);
export const gameChangesSchema = z.object(fields).partial();

export type NewGame = z.infer<typeof newGameSchema>;
export type GameChanges = z.infer<typeof gameChangesSchema>;

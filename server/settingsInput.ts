import { z } from 'zod';

const key = z.string().trim().max(500);

export const settingsSchema = z.object({
  connectionString: z.string().trim().min(1, 'Introduce la cadena de conexión.').max(1000),
  scanDexToken: key,
  igdbClientId: key,
  igdbClientSecret: key,
  rawgApiKey: key,
  theGamesDbApiKey: key,
});

export const collectionNameSchema = z.object({ name: z.string().trim().max(100) });

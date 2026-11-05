// GET /api/games → la colección y los deseados, sin portadas.
// POST /api/games → añade un juego y descarga su portada.
import { loadSettings } from '../../../server/account';
import { downloadCover } from '../../../server/coverDownload';
import { newGameSchema } from '../../../server/gameInput';
import { createGameRepository } from '../../../server/gameRepository';
import { databaseError, error, json, readJson, requestTimeZone, type Env } from '../../../server/http';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const settings = await loadSettings(request, env);
  if (settings instanceof Response) return settings;

  try {
    return json(await createGameRepository(settings.connectionString).getAll());
  } catch (e) {
    return databaseError(e, 'leer la colección');
  }
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const settings = await loadSettings(request, env);
  if (settings instanceof Response) return settings;

  const input = newGameSchema.safeParse(await readJson(request));
  if (!input.success) return error(input.error.issues[0]?.message ?? 'Datos no válidos.', 400);

  try {
    const cover = input.data.coverUrl ? await downloadCover(input.data.coverUrl) : null;
    const repository = createGameRepository(settings.connectionString);
    return json(await repository.create(input.data, cover, requestTimeZone(request)), 201);
  } catch (e) {
    return databaseError(e, 'guardar el juego');
  }
};

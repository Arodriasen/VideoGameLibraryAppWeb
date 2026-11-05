// POST /api/games/trash → pasa varios juegos a la papelera en una sola operación.
import { loadSettings } from '../../../server/account';
import { gameIdsSchema } from '../../../server/gameInput';
import { createGameRepository } from '../../../server/gameRepository';
import { databaseError, error, json, readJson, requestTimeZone, type Env } from '../../../server/http';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const settings = await loadSettings(request, env);
  if (settings instanceof Response) return settings;

  const input = gameIdsSchema.safeParse(await readJson(request));
  if (!input.success) return error('Selección no válida.', 400);

  try {
    const repository = createGameRepository(settings.connectionString);
    return json({ moved: await repository.moveManyToTrash(input.data.ids, requestTimeZone(request)) });
  } catch (e) {
    return databaseError(e, 'eliminar los juegos');
  }
};

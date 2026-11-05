// GET /api/trash → juegos eliminados, lo más reciente primero.
import { loadSettings } from '../../../server/account';
import { createGameRepository } from '../../../server/gameRepository';
import { databaseError, json, type Env } from '../../../server/http';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const settings = await loadSettings(request, env);
  if (settings instanceof Response) return settings;

  try {
    return json(await createGameRepository(settings.connectionString).getTrash());
  } catch (e) {
    return databaseError(e, 'leer la papelera');
  }
};

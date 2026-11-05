// POST /api/trash/:id/restore → devuelve el juego a la colección.
import { loadSettings } from '../../../../server/account';
import { createGameRepository } from '../../../../server/gameRepository';
import { databaseError, error, json, parseId, type Env } from '../../../../server/http';

export const onRequestPost: PagesFunction<Env, 'id'> = async ({ request, env, params }) => {
  const id = parseId(params.id);
  if (id === null) return error('Juego no válido.', 400);

  const settings = await loadSettings(request, env);
  if (settings instanceof Response) return settings;

  try {
    const game = await createGameRepository(settings.connectionString).restore(id);
    return game ? json(game) : error('Este juego ya no está en la papelera.', 404);
  } catch (e) {
    return databaseError(e, 'restaurar el juego');
  }
};

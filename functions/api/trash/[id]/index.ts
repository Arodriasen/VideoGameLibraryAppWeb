// DELETE /api/trash/:id → lo borra para siempre. Solo actúa sobre juegos que ya están en la papelera.
import { loadSettings } from '../../../../server/account';
import { createGameRepository } from '../../../../server/gameRepository';
import { databaseError, error, parseId, type Env } from '../../../../server/http';

export const onRequestDelete: PagesFunction<Env, 'id'> = async ({ request, env, params }) => {
  const id = parseId(params.id);
  if (id === null) return error('Juego no válido.', 400);

  const settings = await loadSettings(request, env);
  if (settings instanceof Response) return settings;

  try {
    const deleted = await createGameRepository(settings.connectionString).deleteForever(id);
    return deleted ? new Response(null, { status: 204 }) : error('Este juego ya no está en la papelera.', 404);
  } catch (e) {
    return databaseError(e, 'eliminar el juego');
  }
};

// PATCH /api/games/:id → cambia solo los campos recibidos.
// DELETE /api/games/:id → lo pasa a la papelera.
import { loadSettings } from '../../../../server/account';
import { downloadCover } from '../../../../server/coverDownload';
import { gameChangesSchema } from '../../../../server/gameInput';
import { createGameRepository } from '../../../../server/gameRepository';
import { databaseError, error, json, parseId, readJson, requestTimeZone, type Env } from '../../../../server/http';

export const onRequestPatch: PagesFunction<Env, 'id'> = async ({ request, env, params }) => {
  const id = parseId(params.id);
  if (id === null) return error('Juego no válido.', 400);

  const settings = await loadSettings(request, env);
  if (settings instanceof Response) return settings;

  const input = gameChangesSchema.safeParse(await readJson(request));
  if (!input.success) return error(input.error.issues[0]?.message ?? 'Datos no válidos.', 400);

  try {
    // Una URL nueva cambia también la portada guardada; sin URL, la guardada no se toca.
    const { coverUrl } = input.data;
    const cover = coverUrl === undefined ? undefined : coverUrl ? await downloadCover(coverUrl) : null;

    const game = await createGameRepository(settings.connectionString).update(id, input.data, cover);
    return game ? json(game) : error('Este juego ya no existe.', 404);
  } catch (e) {
    return databaseError(e, 'guardar el juego');
  }
};

export const onRequestDelete: PagesFunction<Env, 'id'> = async ({ request, env, params }) => {
  const id = parseId(params.id);
  if (id === null) return error('Juego no válido.', 400);

  const settings = await loadSettings(request, env);
  if (settings instanceof Response) return settings;

  try {
    const moved = await createGameRepository(settings.connectionString).moveToTrash(id, requestTimeZone(request));
    return moved ? new Response(null, { status: 204 }) : error('Este juego ya no existe.', 404);
  } catch (e) {
    return databaseError(e, 'eliminar el juego');
  }
};

// GET /api/games/:id/cover → portada guardada en la base de datos.
import { loadSettings } from '../../../../server/account';
import { createGameRepository } from '../../../../server/gameRepository';
import { databaseError, error, parseId, type Env } from '../../../../server/http';

export const onRequestGet: PagesFunction<Env, 'id'> = async ({ request, env, params }) => {
  const id = parseId(params.id);
  if (id === null) return error('Juego no válido.', 400);

  const settings = await loadSettings(request, env);
  if (settings instanceof Response) return settings;

  try {
    const cover = await createGameRepository(settings.connectionString).getCover(id);
    if (!cover) return error('Este juego no tiene portada.', 404);
    return new Response(cover, {
      headers: { 'Content-Type': imageType(cover), 'Cache-Control': 'private, max-age=86400' },
    });
  } catch (e) {
    return databaseError(e, 'leer la portada');
  }
};

function imageType(bytes: Uint8Array): string {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png';
  if (bytes[0] === 0x52 && bytes[1] === 0x49) return 'image/webp';
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return 'image/gif';
  return 'image/jpeg';
}

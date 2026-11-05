// GET /api/settings → cadena de conexión y claves de API de la cuenta.
// PUT /api/settings → los guarda, tras comprobar que la base de datos nueva funciona.
import { loadSettings, saveSettings } from '../../server/account';
import { ConnectionStringError } from '../../server/connectionString';
import { createGameRepository } from '../../server/gameRepository';
import { error, json, readJson, type Env } from '../../server/http';
import { settingsSchema } from '../../server/settingsInput';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const account = await loadSettings(request, env);
  if (account instanceof Response) return account;

  const { userId: _userId, ...settings } = account;
  return json(settings);
};

export const onRequestPut: PagesFunction<Env> = async ({ request, env }) => {
  const account = await loadSettings(request, env);
  if (account instanceof Response) return account;

  const input = settingsSchema.safeParse(await readJson(request));
  if (!input.success) return error(input.error.issues[0]?.message ?? 'Datos no válidos.', 400);

  // Una cadena equivocada dejaría sin colección a las tres apps: solo se guarda si funciona.
  try {
    await createGameRepository(input.data.connectionString).assertCollectionExists();
  } catch (e) {
    if (e instanceof ConnectionStringError) return error(e.message, 400);
    console.error('Probar la conexión', e instanceof Error ? e.name : 'error');
    return error('No se ha podido conectar con esa base de datos. Revisa la cadena de conexión.', 400);
  }

  const failure = await saveSettings(request, env, account.userId, input.data);
  return failure ?? new Response(null, { status: 204 });
};

// GET /api/collection → nombre visible de la colección.
// PUT /api/collection → lo cambia. Se guarda en la base de datos, no en la cuenta.
import { loadSettings } from '../../server/account';
import { createGameRepository } from '../../server/gameRepository';
import { databaseError, error, json, readJson, type Env } from '../../server/http';
import { collectionNameSchema } from '../../server/settingsInput';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const account = await loadSettings(request, env);
  if (account instanceof Response) return account;

  try {
    return json({ name: await createGameRepository(account.connectionString).getCollectionName() });
  } catch (e) {
    return databaseError(e, 'leer el nombre de la colección');
  }
};

export const onRequestPut: PagesFunction<Env> = async ({ request, env }) => {
  const account = await loadSettings(request, env);
  if (account instanceof Response) return account;

  const input = collectionNameSchema.safeParse(await readJson(request));
  if (!input.success) return error('El nombre no es válido.', 400);

  try {
    await createGameRepository(account.connectionString).setCollectionName(input.data.name);
    return json({ name: input.data.name });
  } catch (e) {
    return databaseError(e, 'guardar el nombre de la colección');
  }
};

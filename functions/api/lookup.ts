// GET /api/lookup?barcode=… o ?name=… → candidatos de las fuentes externas.
import { loadSettings } from '../../server/account';
import { searchByBarcode, searchByName } from '../../server/gameLookup';
import { error, json, type Env } from '../../server/http';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const settings = await loadSettings(request, env);
  if (settings instanceof Response) return settings;

  const params = new URL(request.url).searchParams;
  const barcode = params.get('barcode')?.trim();
  const name = params.get('name')?.trim();

  if (barcode) return json(await searchByBarcode(barcode.slice(0, 32), settings));
  if (name) return json(await searchByName(name.slice(0, 200), settings));
  return error('Indica un código de barras o un nombre.', 400);
};

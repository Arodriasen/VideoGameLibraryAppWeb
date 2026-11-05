// El escritorio y Android guardan la conexión en formato Npgsql
// (Host=...;Database=...;Username=...;Password=...), pero el driver HTTP de Neon necesita una URL.

export class ConnectionStringError extends Error {}

/** Convierte la cadena guardada en la cuenta en una URL postgresql:// de Neon. */
export function toNeonUrl(connectionString: string): string {
  const value = connectionString.trim();
  const url = /^postgres(ql)?:\/\//i.test(value) ? value : npgsqlToUrl(value);
  assertNeonHost(url);
  return url;
}

function npgsqlToUrl(value: string): string {
  const parts = parseKeyValues(value);
  const host = parts.get('host') ?? parts.get('server');
  const database = parts.get('database') ?? parts.get('db');
  const username = parts.get('username') ?? parts.get('user id') ?? parts.get('userid') ?? parts.get('user');
  const password = parts.get('password') ?? parts.get('pwd');
  if (!host || !database || !username || !password) {
    throw new ConnectionStringError('La cadena de conexión está incompleta.');
  }

  const port = parts.get('port');
  const authority = port ? `${host}:${port}` : host;
  return `postgresql://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${authority}/${encodeURIComponent(database)}?sslmode=require`;
}

/** Separa por ";" respetando los valores entre comillas, donde la contraseña puede llevar un ";". */
function parseKeyValues(value: string): Map<string, string> {
  const result = new Map<string, string>();
  const pattern = /\s*([^=;]+?)\s*=\s*(?:'((?:[^']|'')*)'|"((?:[^"]|"")*)"|([^;]*))\s*(?:;|$)/g;
  for (const match of value.matchAll(pattern)) {
    const [, key, single, double, plain] = match;
    const parsed = single?.replaceAll("''", "'") ?? double?.replaceAll('""', '"') ?? plain?.trim() ?? '';
    result.set(key.toLowerCase(), parsed);
  }
  return result;
}

/**
 * El driver HTTP solo funciona con Neon. Además, cualquiera con cuenta puede escribir lo que quiera
 * en su fila de ajustes: así este servidor nunca se conecta a un host arbitrario.
 */
function assertNeonHost(url: string): void {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    throw new ConnectionStringError('La cadena de conexión no es válida.');
  }
  if (!host.endsWith('.neon.tech')) {
    throw new ConnectionStringError('La versión web solo funciona con bases de datos de Neon.');
  }
}

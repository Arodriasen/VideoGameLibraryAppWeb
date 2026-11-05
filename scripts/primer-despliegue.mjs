// Solo hace falta una vez: crea el proyecto en Cloudflare, sube los dos valores de Supabase
// (los lee de .dev.vars) y publica la app. Después basta con `npm run deploy`.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PROJECT = 'videogamelibraryappweb';

function wrangler(args, input) {
  const result = spawnSync(`npx wrangler ${args}`, {
    shell: true,
    input,
    stdio: [input === undefined ? 'inherit' : 'pipe', 'inherit', 'inherit'],
  });
  return result.status === 0;
}

const vars = Object.fromEntries(
  readFileSync('.dev.vars', 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.includes('='))
    .map((line) => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim()]),
);

// Si el proyecto ya existe, wrangler da error y se sigue adelante.
wrangler(`pages project create ${PROJECT} --production-branch main`);

for (const name of ['SUPABASE_URL', 'SUPABASE_ANON_KEY']) {
  if (!vars[name]) throw new Error(`Falta ${name} en .dev.vars`);
  if (!wrangler(`pages secret put ${name} --project-name ${PROJECT}`, vars[name])) process.exit(1);
}

const deployed = spawnSync('npm run deploy', { shell: true, stdio: 'inherit' });
process.exit(deployed.status ?? 1);

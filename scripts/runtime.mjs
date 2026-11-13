import { Miniflare } from 'miniflare';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
export const root = fileURLToPath(new URL('../', import.meta.url));
export function runtime({ persist = true, port = 8788 } = {}) {
  return new Miniflare({
    modules: true, scriptPath: fileURLToPath(new URL('../dist/_worker.js', import.meta.url)),
    compatibilityDate: '2026-07-30', host: '127.0.0.1', port,
    d1Databases: { DB: 'zipone-local' }, d1Persist: typeof persist === 'string' ? persist : persist ? fileURLToPath(new URL('../.zipone/d1/', import.meta.url)) : false,
    assets: { directory: fileURLToPath(new URL('../dist/', import.meta.url)), binding: 'ASSETS', routerConfig: { has_user_worker: true, invoke_user_worker_ahead_of_assets: true }, assetConfig: { html_handling: 'drop-trailing-slash', not_found_handling: '404-page' } },
  });
}
export async function migrate(db) {
  const schema = await readFile(new URL('../migrations/0001_initial.sql', import.meta.url), 'utf8');
  await db.batch(schema.split(';').map(v => v.trim()).filter(Boolean).map(sql => db.prepare(sql)));
}

import { readFile } from 'node:fs/promises';
import { query } from './cloudflare.mjs';
import { runtime, migrate } from './runtime.mjs';
if (process.argv.includes('--remote')) {
  const sql = await readFile(new URL('../migrations/0001_initial.sql', import.meta.url), 'utf8');
  await query(sql); console.log('Production D1 schema initialized. Existing records preserved.');
} else {
  const mf = runtime({ port: 0 });
  try { await migrate(await mf.getD1Database('DB')); console.log('Local D1 schema initialized.'); }
  finally { await mf.dispose(); }
}

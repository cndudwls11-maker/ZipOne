import { query } from './cloudflare.mjs';
import { runtime, migrate } from './runtime.mjs';
import { migrationFiles } from './migrations.mjs';
if (process.argv.includes('--remote')) {
  const tracking = (await query("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'"))[0].results;
  if (!tracking.length && (await query("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('posts','admins','replies') LIMIT 1"))[0].results.length) throw new Error('Existing untracked database: inspect its schema before applying migrations.');
  const applied = new Set(tracking.length ? (await query('SELECT name FROM schema_migrations'))[0].results.map(row => row.name) : []);
  for (const file of await migrationFiles()) {
    if (applied.has(file.name)) continue;
    await query(file.sql);
    console.log(`Applied ${file.name}; existing records preserved.`);
  }
  console.log('Production D1 migrations are current.');
} else {
  const mf = runtime({ port: 0 });
  try { console.log({ applied: await migrate(await mf.getD1Database('DB')) }); }
  finally { await mf.dispose(); }
}

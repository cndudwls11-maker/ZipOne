import { readFile, readdir } from 'node:fs/promises';
export const statements = sql => sql.split(';').map(value => value.trim()).filter(Boolean);
export async function migrationFiles() {
  const directory = new URL('../migrations/', import.meta.url);
  const names = (await readdir(directory)).filter(name => /^\d{4}_[a-z0-9_]+\.sql$/.test(name)).sort();
  return Promise.all(names.map(async name => ({ name, sql: await readFile(new URL(name, directory), 'utf8') })));
}
export async function migrateDatabase(db) {
  const tracking = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'").first();
  if (!tracking && await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('posts','admins','replies') LIMIT 1").first()) {
    throw new Error('Existing untracked database: inspect its schema before applying migrations.');
  }
  const applied = new Set(tracking ? (await db.prepare('SELECT name FROM schema_migrations').all()).results.map(row => row.name) : []);
  const done = [];
  for (const file of await migrationFiles()) {
    if (applied.has(file.name)) continue;
    // D1 batch is atomic. Copy parent + child rows before replacing tables so
    // ON DELETE CASCADE cannot remove an existing reply during table rebuild.
    await db.batch(statements(file.sql).map(sql => db.prepare(sql)));
    done.push(file.name);
  }
  return done;
}

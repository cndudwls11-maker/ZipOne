import { stdin, stdout } from 'node:process';
import { hashPassword, now } from '../server/security.js';
import { runtime, migrate } from './runtime.mjs';
import { query } from './cloudflare.mjs';
const args = process.argv.slice(2); const remote = args.includes('--remote');
const username = args.includes('--username') ? args[args.indexOf('--username') + 1] : 'zipone-admin';
if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(username || '')) throw new Error('Username: use 3-40 letters, digits, _, . or -.');
if (!stdin.isTTY) throw new Error('Run this command in an interactive terminal. Never pass a password as an argument.');
async function secret(prompt) {
  stdout.write(prompt); stdin.setRawMode(true); stdin.resume(); stdin.setEncoding('utf8');
  let value = '';
  return new Promise((resolve, reject) => {
    const handler = chunk => {
      for (const c of chunk) {
        if (c === '\r' || c === '\n') { stdin.off('data', handler); stdin.setRawMode(false); stdin.pause(); stdout.write('\n'); resolve(value); return; }
        if (c === '\u0003') { stdin.off('data', handler); stdin.setRawMode(false); stdin.pause(); reject(new Error('Cancelled')); return; }
        if (c === '\u007f' || c === '\b') value = value.slice(0, -1);
        else if (c >= ' ') value += c;
      }
    };
    stdin.on('data', handler);
  });
}
const password = await secret(`New password for ${username} (${remote ? 'PRODUCTION' : 'local'}; hidden): `);
if (password.length < 14 || password.length > 128) throw new Error('Use a unique password of 14-128 characters.');
if (password !== await secret('Confirm password (hidden): ')) throw new Error('Passwords do not match.');
const hash = await hashPassword(password);
const sql = 'INSERT INTO admins (id,username,password_hash,created_at) VALUES (?,?,?,?) ON CONFLICT(username) DO UPDATE SET password_hash=excluded.password_hash';
const params = [crypto.randomUUID(), username, hash, now()];
if (remote) {
  await query(sql, params); await query('DELETE FROM sessions WHERE admin_id=(SELECT id FROM admins WHERE username=?)', [username]);
} else {
  const mf = runtime({ port: 0 });
  try { const db = await mf.getD1Database('DB'); await migrate(db); await db.prepare(sql).bind(...params).run(); await db.prepare('DELETE FROM sessions WHERE admin_id=(SELECT id FROM admins WHERE username=?)').bind(username).run(); }
  finally { await mf.dispose(); }
}
console.log(`Admin ${username} created/updated; previous sessions revoked. Password was not saved.`);

import { readFile } from 'node:fs/promises';
export const config = JSON.parse(await readFile(new URL('../site.config.json', import.meta.url), 'utf8'));
export async function query(sql, params = []) {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID || config.accountId;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) throw new Error('Set CLOUDFLARE_API_TOKEN in your shell with D1 Edit permission. Do not put it in source files.');
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${config.databaseId}/query`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ sql, params }) });
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(`Cloudflare database request failed (${res.status}). Check account, binding and token permissions.`);
  return body.result;
}

const encoder = new TextEncoder();
export const now = () => Math.floor(Date.now() / 1000);
const hex = bytes => Array.from(bytes, v => v.toString(16).padStart(2, '0')).join('');
export const randomToken = () => hex(crypto.getRandomValues(new Uint8Array(32)));
export async function digest(value) {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}
export function equal(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
// Workers' native Web Crypto supports at most 100,000 PBKDF2 iterations.
// Per-record random salts, long passwords and database-backed throttles complement it.
export async function hashPassword(password, salt = randomToken()) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations: 100000 }, key, 256);
  return `pbkdf2-sha256$100000$${salt}$${hex(new Uint8Array(bits))}`;
}
export async function verifyPassword(password, stored) {
  const parts = typeof stored === 'string' ? stored.split('$') : [];
  if (parts.length !== 4 || parts[0] !== 'pbkdf2-sha256' || parts[1] !== '100000') return false;
  return equal(await hashPassword(password, parts[2]), stored);
}
export class HttpError extends Error {
  constructor(status, message, field) { super(message); this.status = status; this.field = field; }
}
export function cookieNames(request) {
  return new URL(request.url).protocol === 'https:'
    ? { session: '__Host-zipone-session', csrf: '__Host-zipone-csrf' }
    : { session: 'zipone-session', csrf: 'zipone-csrf' };
}
export function cookies(request) {
  return Object.fromEntries((request.headers.get('cookie') || '').split(';').map(v => v.trim().split('=')).filter(v => v.length === 2));
}
export function cookie(request, name, value, maxAge, httpOnly = true) {
  return `${name}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Strict${httpOnly ? '; HttpOnly' : ''}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
}
export function checkCsrf(request) {
  const origin = new URL(request.url).origin;
  if (request.headers.get('origin') !== origin || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new HttpError(403, '요청한 페이지를 확인할 수 없습니다. 새로고침 후 다시 시도해 주세요.');
  }
  const token = request.headers.get('x-csrf-token');
  if (!token || !/^[a-f0-9]{64}$/.test(token) || !equal(token, cookies(request)[cookieNames(request).csrf])) {
    throw new HttpError(403, '안전한 요청 확인이 필요합니다. 새로고침 후 다시 시도해 주세요.');
  }
}
export async function readJson(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) throw new HttpError(415, '요청 형식이 올바르지 않습니다.');
  if (Number(request.headers.get('content-length')) > 32768) throw new HttpError(413, '입력한 내용이 너무 깁니다.');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, '입력한 내용을 확인해 주세요.');
  const chunks = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 32768) { await reader.cancel(); throw new HttpError(413, '입력한 내용이 너무 깁니다.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let data;
  try { data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { throw new HttpError(400, '입력한 내용을 확인해 주세요.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new HttpError(400, '입력한 내용을 확인해 주세요.');
  return data;
}
export function textField(data, field, min, max, label, trim = true) {
  const raw = data[field];
  const value = typeof raw === 'string' ? (trim ? raw.trim() : raw) : '';
  if (value.length < min || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) throw new HttpError(400, `${label}은(는) ${min}~${max}자로 입력해 주세요.`, field);
  return value;
}
export const passwordField = data => textField(data, 'password', 10, 128, '비밀번호', false);
export async function throttle(db, request, scope, limit, seconds) {
  const time = now();
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  const identity = await digest(`${scope}:${ip}:${Math.floor(time / seconds)}`);
  const row = await db.prepare('INSERT INTO rate_limits (bucket,hits,expires_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET hits=hits+1 RETURNING hits').bind(identity, time + seconds).first();
  if (row.hits > limit) throw new HttpError(429, '요청이 잠시 많아졌습니다. 잠시 후 다시 시도해 주세요.');
}
export const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=31536000',
};

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { runtime, migrate } from '../scripts/runtime.mjs';
import { hashPassword, now } from '../server/security.js';
import { mkdir, mkdtemp, rm, readFile } from 'node:fs/promises';
import { statements } from '../scripts/migrations.mjs';
import { join, resolve } from 'node:path';
import { root } from '../scripts/runtime.mjs';
let mf, db; let nextIp = 1;
const origin = 'https://zipone.test';
class Client {
  constructor() { this.jar = new Map(); this.csrf = ''; this.ip = `192.0.2.${nextIp++}`; }
  async call(path, { method = 'GET', body, headers = {}, noCsrf = false } = {}) {
    const res = await mf.dispatchFetch(`${origin}${path}`, { method, headers: { 'cf-connecting-ip': this.ip, cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join('; '), ...(method === 'GET' ? {} : { origin, 'content-type': 'application/json', ...(noCsrf ? {} : { 'x-csrf-token': this.csrf }) }), ...headers }, ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) });
    for (const raw of res.headers.getSetCookie()) { const [name, value] = raw.split(';')[0].split('='); if (value) this.jar.set(name, value); else this.jar.delete(name); }
    const raw = await res.text(); let data;
    try { data = JSON.parse(raw); } catch { throw new Error(`Non-JSON ${res.status} response for ${path}: ${raw.slice(0, 1600)}`); }
    if (data.csrf) this.csrf = data.csrf;
    return { status: res.status, data, headers: res.headers };
  }
  async init() { return this.call('/api/session'); }
}
const postData = { nickname: '테스트사용자', title: '높이 조절이 궁금해요', content: '사용하기 편한 높이로 어떻게 조절하는지 궁금합니다.', category: 'purchase', password: crypto.randomUUID() };
before(async () => {
  mf = runtime({ persist: false, port: 0 }); db = await mf.getD1Database('DB'); await migrate(db);
  await db.prepare('INSERT INTO admins VALUES (?,?,?,?)').bind('admin-test', 'test-admin', await hashPassword(postData.password), now()).run();
});
after(async () => { await mf?.dispose(); });
test('public CRUD, hashed passwords, wrong-password rejection, independent sessions and cascaded reply deletion', async () => {
  const author = new Client(); await author.init();
  const made = await author.call('/api/posts', { method: 'POST', body: postData }); assert.equal(made.status, 201);
  const id = made.data.id; const path = `/api/posts/${id}`;
  const row = await db.prepare('SELECT password_hash FROM posts WHERE id=?').bind(id).first(); assert.ok(row.password_hash.startsWith('pbkdf2-sha256$100000$')); assert.ok(!row.password_hash.includes(postData.password));
  const other = new Client(); await other.init(); const detail = await other.call(path); assert.equal(detail.data.post.title, postData.title); assert.ok(!('password_hash' in detail.data.post));
  for (const method of ['PUT', 'DELETE']) assert.equal((await other.call(path, { method, body: { ...postData, password: 'wrong-password-long' } })).status, 403);
  assert.equal((await author.call(`${path}/verify`, { method: 'POST', body: { password: postData.password } })).status, 200);
  assert.equal((await author.call(path, { method: 'PUT', body: { ...postData, title: '수정된 질문입니다' } })).status, 200);
  assert.equal((await other.call(path)).data.post.title, '수정된 질문입니다');
  const duplicateHash = await hashPassword(postData.password); assert.notEqual(duplicateHash, row.password_hash);
  assert.equal((await author.call(path, { method: 'DELETE', body: { password: postData.password } })).status, 200);
  assert.equal((await other.call(path)).status, 404);
});
test('admin authentication, session rotation and revocation, server authorization, answer status and moderation', async () => {
  const customer = new Client(); await customer.init(); const created = await customer.call('/api/posts', { method: 'POST', body: postData }); const id = created.data.id;
  const replyPath = `/api/admin/posts/${id}/reply`;
  assert.equal((await customer.call(replyPath, { method: 'PUT', body: { content: '무단 답변' } })).status, 401);
  assert.equal((await customer.call(`/api/admin/posts/${id}`, { method: 'DELETE', body: {} })).status, 401);
  const admin = new Client(); await admin.init();
  assert.equal((await admin.call('/api/admin/login', { method: 'POST', body: { username: 'test-admin', password: 'wrong-password-long' } })).status, 401);
  const logged = await admin.call('/api/admin/login', { method: 'POST', body: { username: 'test-admin', password: postData.password } }); assert.equal(logged.status, 200);
  const sessionCookie = logged.headers.getSetCookie().find(v => v.startsWith('__Host-zipone-session=')); assert.match(sessionCookie, /HttpOnly/); assert.match(sessionCookie, /Secure/); assert.match(sessionCookie, /SameSite=Strict/);
  const old = admin.jar.get('__Host-zipone-session'); const stored = await db.prepare('SELECT token_hash FROM sessions LIMIT 1').first(); assert.notEqual(stored.token_hash, old);
  await admin.call('/api/admin/login', { method: 'POST', body: { username: 'test-admin', password: postData.password } }); assert.notEqual(admin.jar.get('__Host-zipone-session'), old);
  assert.equal((await admin.call(replyPath, { method: 'PUT', body: { content: '다이얼을 돌려 높이를 조절해 주세요.' } })).status, 200);
  assert.equal((await customer.call(`/api/posts/${id}`)).data.post.answered, 1);
  await admin.call(replyPath, { method: 'PUT', body: { content: '답변 내용을 수정했습니다.' } }); assert.equal((await customer.call(`/api/posts/${id}`)).data.post.reply_content, '답변 내용을 수정했습니다.');
  await admin.call(replyPath, { method: 'DELETE', body: {} }); assert.equal((await customer.call(`/api/posts/${id}`)).data.post.answered, 0);
  await admin.call(replyPath, { method: 'PUT', body: { content: '다시 등록한 답변입니다.' } });
  const sessionData = new Map(admin.jar); const oldCsrf = admin.csrf;
  await admin.call('/api/admin/logout', { method: 'POST', body: {} }); admin.jar = sessionData; admin.csrf = oldCsrf;
  assert.equal((await admin.call(replyPath, { method: 'PUT', body: { content: '재사용 시도' } })).status, 401);
  const moderator = new Client(); await moderator.init(); await moderator.call('/api/admin/login', { method: 'POST', body: { username: 'test-admin', password: postData.password } });
  assert.equal((await moderator.call(`/api/admin/posts/${id}`, { method: 'DELETE', body: {} })).status, 200); assert.equal(await db.prepare('SELECT post_id FROM replies WHERE post_id=?').bind(id).first(), null);
});
test('search, category filter, pagination, SQL injection and literal wildcard handling', async () => {
  const time = now(); const ids = [];
  for (let i = 0; i < 18; i++) { const id = crypto.randomUUID(); ids.push(id); await db.prepare('INSERT INTO posts VALUES (?,?,?,?,?,?,?,?)').bind(id, '검증닉네임', `페이지 질문 ${i}`, '검색과 페이지 동작을 검증하는 내용입니다.', i < 9 ? 'product' : 'idea', 'unused-test-hash', time + i, time + i).run(); }
  const client = new Client(); const first = await client.call('/api/posts?page=1'); const second = await client.call('/api/posts?page=2'); assert.equal(first.data.posts.length, 8); assert.equal(second.data.posts.length, 8); assert.equal(first.data.total, 18); assert.ok(!first.data.posts.some(p => second.data.posts.some(q => p.id === q.id)));
  const filtered = await client.call('/api/posts?category=idea&q=페이지'); assert.equal(filtered.data.total, 9); assert.ok(filtered.data.posts.every(p => p.category === 'idea'));
  for (const q of ["' OR 1=1 --", '%', '_']) assert.equal((await client.call(`/api/posts?q=${encodeURIComponent(q)}`)).data.total, 0);
  assert.equal((await client.call('/api/posts?page=-1')).status, 400); assert.equal((await client.call('/api/posts?category=invalid')).status, 400);
  await db.batch(ids.map(id => db.prepare('DELETE FROM posts WHERE id=?').bind(id)));
});
test('CSRF, content type, input validation, size limits and stored XSS stays inert data', async () => {
  const client = new Client(); await client.init();
  assert.equal((await client.call('/api/posts', { method: 'POST', body: postData, noCsrf: true })).status, 403);
  assert.equal((await client.call('/api/posts', { method: 'POST', body: postData, headers: { origin: 'https://evil.example' } })).status, 403);
  assert.equal((await client.call('/api/posts', { method: 'POST', body: postData, headers: { 'content-type': 'text/plain' } })).status, 415);
  const inputClient = new Client(); await inputClient.init();
  assert.equal((await inputClient.call('/api/posts', { method: 'POST', body: { ...postData, password: 'short' } })).status, 400);
  assert.equal((await inputClient.call('/api/posts', { method: 'POST', body: { ...postData, content: 'a'.repeat(40000) } })).status, 413);
  const hostile = { ...postData, title: '<img src=x onerror=alert(1)>', content: '<script>document.body.remove()</script>' };
  const made = await inputClient.call('/api/posts', { method: 'POST', body: hostile }); assert.equal(made.status, 201);
  const seen = await inputClient.call(`/api/posts/${made.data.id}`); assert.equal(seen.data.post.content, hostile.content); assert.ok(seen.headers.get('content-security-policy').includes("script-src 'self'")); assert.equal(seen.headers.get('cache-control'), 'no-store');
  await inputClient.call(`/api/posts/${made.data.id}`, { method: 'DELETE', body: { password: postData.password } });
});
test('repeated requests are throttled and idle or expired admin sessions are rejected', async () => {
  const client = new Client(); await client.init();
  for (let i = 0; i < 5; i++) assert.equal((await client.call('/api/admin/login', { method: 'POST', body: { username: 'no-admin', password: postData.password } })).status, 401);
  assert.equal((await client.call('/api/admin/login', { method: 'POST', body: { username: 'no-admin', password: postData.password } })).status, 429);
  const admin = new Client(); await admin.init(); await admin.call('/api/admin/login', { method: 'POST', body: { username: 'test-admin', password: postData.password } });
  await db.prepare('UPDATE sessions SET last_seen=?').bind(now() - 1801).run(); assert.equal((await admin.call('/api/session')).data.admin, null);
});
test('database failures return an actionable error without success acknowledgement', async () => {
  const { handleApi } = await import('../server/api.js');
  const res = await handleApi(new Request(`${origin}/api/posts`), {}); assert.equal(res.status, 503); assert.match((await res.json()).error, /잠시/);
  const failed = await handleApi(new Request(`${origin}/api/posts`), { DB: { prepare() { throw new Error('Simulated database outage'); } } }); assert.equal(failed.status, 503); assert.match((await failed.json()).error, /실패/);
});
test('D1 records persist across a complete runtime restart', async () => {
  const parent = resolve(root, '.zipone'); await mkdir(parent, { recursive: true });
  const dir = await mkdtemp(join(parent, 'persistence-')); let first, second;
  try {
    first = runtime({ persist: dir, port: 0 }); const database = await first.getD1Database('DB'); await migrate(database);
    const id = crypto.randomUUID(); await database.prepare('INSERT INTO posts VALUES (?,?,?,?,?,?,?,?)').bind(id, '재시작검증', '서버 재시작 검증', '서버를 다시 실행해도 남아 있어야 하는 게시글입니다.', 'product', 'unused-test-hash', now(), now()).run();
    await first.dispose(); first = null;
    second = runtime({ persist: dir, port: 0 });
    const result = await second.dispatchFetch(`${origin}/api/posts/${id}`); assert.equal(result.status, 200); assert.equal((await result.json()).post.title, '서버 재시작 검증');
  } finally {
    await first?.dispose(); await second?.dispose();
    if (!resolve(dir).startsWith(parent + (process.platform === 'win32' ? '\\' : '/'))) throw new Error('Invalid test cleanup path');
    await rm(dir, { recursive: true, force: true });
  }
});

test('purchase inquiries work and legacy usage posts keep their meaning when read or edited', async () => {
  const author = new Client(); await author.init();
  assert.equal((await author.call('/api/posts', { method: 'POST', body: { ...postData, category: 'usage' } })).status, 400);
  const made = await author.call('/api/posts', { method: 'POST', body: postData }); assert.equal(made.status, 201);
  const path = `/api/posts/${made.data.id}`;
  assert.equal((await author.call(path)).data.post.category, 'purchase');
  assert.ok((await author.call('/api/posts?category=purchase')).data.posts.some(p => p.id === made.data.id));
  assert.equal((await author.call(path, { method: 'PUT', body: { ...postData, title: '수정한 구매 문의' } })).status, 200);
  assert.equal((await author.call(path, { method: 'PUT', body: { ...postData, category: 'usage' } })).status, 400);
  const legacyId = crypto.randomUUID(); const time = now() - 100;
  await db.prepare('INSERT INTO posts VALUES (?,?,?,?,?,?,?,?)').bind(legacyId, '기존사용자', '기존 사용 방법 질문', '기존 사용 방법 분류와 답변이 보존되어야 하는 글입니다.', 'usage', await hashPassword(postData.password), time, time).run();
  await db.prepare('INSERT INTO replies VALUES (?,?,?,?,?)').bind(legacyId, '기존에 작성한 답변을 그대로 보존합니다.', 'admin-test', time, time).run();
  const legacy = await author.call(`/api/posts/${legacyId}`);
  assert.equal(legacy.data.post.category, 'usage'); assert.equal(legacy.data.post.answered, 1);
  const filtered = await author.call('/api/posts?category=usage'); assert.equal(filtered.data.legacyUsage, 1); assert.ok(filtered.data.posts.some(p => p.id === legacyId));
  const edit = await author.call(`/api/posts/${legacyId}`, { method: 'PUT', body: { ...postData, category: 'usage', title: '내용을 수정한 기존 사용 방법 질문' } }); assert.equal(edit.status, 200);
  const after = (await author.call(`/api/posts/${legacyId}`)).data.post;
  assert.equal(after.category, 'usage'); assert.equal(after.reply_content, legacy.data.post.reply_content);
  const { categories } = await import('../public/js/api.js'); assert.equal(categories.purchase, '구매 문의'); assert.equal(categories.usage, '사용 방법');
  for (const file of ['write', 'board', 'admin']) {
    const html = await readFile(new URL(`../public/${file}.html`, import.meta.url), 'utf8');
    assert.ok(html.includes('<option value="purchase">구매 문의</option>')); assert.ok(!html.includes('<option value="usage">'));
  }
  await author.call(path, { method: 'DELETE', body: { password: postData.password } });
  await author.call(`/api/posts/${legacyId}`, { method: 'DELETE', body: { password: postData.password } });
});

test('category migration atomically preserves old posts, replies, password hashes and administrator accounts', async () => {
  const instance = runtime({ persist: false, port: 0 });
  try {
    const oldDb = await instance.getD1Database('DB');
    const initial = await readFile(new URL('../migrations/0001_initial.sql', import.meta.url), 'utf8');
    await oldDb.batch(statements(initial).map(sql => oldDb.prepare(sql)));
    const hash = await hashPassword(postData.password); const time = now() - 500; const id = crypto.randomUUID();
    await oldDb.prepare('INSERT INTO admins VALUES (?,?,?,?)').bind('legacy-admin', 'legacy-admin', hash, time).run();
    await oldDb.prepare('INSERT INTO posts VALUES (?,?,?,?,?,?,?,?)').bind(id, '기존고객', '보존할 사용 방법 문의', '분류와 비밀번호 및 기존 답변이 보존되어야 합니다.', 'usage', hash, time, time).run();
    await oldDb.prepare('INSERT INTO replies VALUES (?,?,?,?,?)').bind(id, '보존할 기존 관리자 답변입니다.', 'legacy-admin', time, time).run();
    const snapshot = async () => ({ posts: (await oldDb.prepare('SELECT * FROM posts ORDER BY id').all()).results, replies: (await oldDb.prepare('SELECT * FROM replies ORDER BY post_id').all()).results, admins: (await oldDb.prepare('SELECT * FROM admins ORDER BY id').all()).results });
    const before = await snapshot(); const second = await readFile(new URL('../migrations/0002_purchase_category.sql', import.meta.url), 'utf8');
    await assert.rejects(oldDb.batch([...statements(second).map(sql => oldDb.prepare(sql)), oldDb.prepare('INSERT INTO deliberately_missing_table VALUES (1)')]));
    assert.deepEqual(await snapshot(), before, 'failed migration must roll back parent and child table replacements');
    assert.deepEqual(await migrate(oldDb), ['0002_purchase_category.sql']);
    assert.deepEqual(await snapshot(), before, 'successful migration must not alter existing records');
    assert.deepEqual(await migrate(oldDb), [], 'migration is applied only once');
    assert.equal((await oldDb.prepare('PRAGMA foreign_key_check').all()).results.length, 0);
    const foreignKeys = (await oldDb.prepare('PRAGMA foreign_key_list(replies)').all()).results; assert.ok(foreignKeys.some(row => row.table === 'posts'));
    await oldDb.prepare('INSERT INTO posts VALUES (?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), '구매고객', '새 구매 문의', '새 구매 문의 분류를 저장할 수 있습니다.', 'purchase', hash, time, time).run();
    await oldDb.prepare('DELETE FROM posts WHERE id=?').bind(id).run();
    assert.equal(await oldDb.prepare('SELECT post_id FROM replies WHERE post_id=?').bind(id).first(), null, 'normal cascade deletion still works after migration');
  } finally { await instance.dispose(); }
});

import { now, randomToken, digest, hashPassword, verifyPassword, HttpError, cookies, cookieNames, cookie, checkCsrf, readJson, textField, passwordField, throttle, securityHeaders } from './security.js';

const categories = ['product', 'usage', 'idea', 'other'];
const idPattern = /^[a-f0-9-]{36}$/;
const publicColumns = 'p.id,p.nickname,p.title,p.category,p.created_at,p.updated_at,CASE WHEN r.post_id IS NULL THEN 0 ELSE 1 END AS answered';
const response = (body, status = 200, extra = {}) => Response.json(body, { status, headers: { ...securityHeaders, 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', ...extra } });

function fields(data) {
  const nickname = textField(data, 'nickname', 2, 20, '닉네임');
  const title = textField(data, 'title', 2, 100, '제목');
  const content = textField(data, 'content', 10, 5000, '내용');
  if (!categories.includes(data.category)) throw new HttpError(400, '분류를 선택해 주세요.', 'category');
  return { nickname, title, content, category: data.category };
}
async function adminSession(request, db, required = true) {
  const token = cookies(request)[cookieNames(request).session];
  let session = null;
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    session = await db.prepare('SELECT s.admin_id,a.username FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token_hash=? AND s.expires_at>? AND s.last_seen>?').bind(await digest(token), now(), now() - 1800).first();
    if (session) await db.prepare('UPDATE sessions SET last_seen=? WHERE token_hash=?').bind(now(), await digest(token)).run();
  }
  if (!session && required) throw new HttpError(401, '관리자 로그인이 필요합니다.');
  return session;
}
async function postById(db, id) {
  const post = await db.prepare(`SELECT ${publicColumns},p.content,r.content AS reply_content,r.created_at AS reply_created_at,r.updated_at AS reply_updated_at FROM posts p LEFT JOIN replies r ON r.post_id=p.id WHERE p.id=?`).bind(id).first();
  if (!post) throw new HttpError(404, '게시글을 찾을 수 없습니다. 삭제되었을 수 있습니다.');
  return post;
}
async function ownsPost(db, request, id, data) {
  await throttle(db, request, 'post-password', 10, 600);
  const password = passwordField(data);
  const post = await db.prepare('SELECT password_hash FROM posts WHERE id=?').bind(id).first();
  if (!post) throw new HttpError(404, '게시글을 찾을 수 없습니다.');
  if (!(await verifyPassword(password, post.password_hash))) throw new HttpError(403, '게시글 비밀번호가 올바르지 않습니다.', 'password');
}

export async function handleApi(request, env) {
  try {
    const db = env.DB;
    if (!db) throw new HttpError(503, '게시판을 잠시 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.');
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '');
    const method = request.method;
    if (!['GET', 'POST', 'PUT', 'DELETE'].includes(method)) throw new HttpError(405, '지원하지 않는 요청입니다.');
    await throttle(db, request, 'requests', 180, 60);
    if (method !== 'GET') checkCsrf(request);
    if (method === 'GET' && path === '/api/session') {
      const names = cookieNames(request);
      const existing = cookies(request)[names.csrf];
      const csrf = /^[a-f0-9]{64}$/.test(existing || '') ? existing : randomToken();
      const admin = await adminSession(request, db, false);
      await db.batch([
        db.prepare('DELETE FROM sessions WHERE expires_at<? OR last_seen<?').bind(now(), now() - 1800),
        db.prepare('DELETE FROM rate_limits WHERE expires_at<?').bind(now()),
      ]);
      return response({ csrf, admin: admin ? { username: admin.username } : null }, 200, { 'Set-Cookie': cookie(request, names.csrf, csrf, 28800) });
    }
    if (method === 'POST' && path === '/api/admin/login') {
      await throttle(db, request, 'login', 5, 900);
      const data = await readJson(request);
      const username = textField(data, 'username', 3, 40, '아이디');
      const password = passwordField(data);
      const admin = await db.prepare('SELECT id,password_hash FROM admins WHERE username=?').bind(username).first();
      // Perform the same native password derivation for unknown accounts.
      const valid = admin ? await verifyPassword(password, admin.password_hash) : (await hashPassword(password), false);
      if (!valid) throw new HttpError(401, '아이디 또는 비밀번호를 확인해 주세요.');
      const names = cookieNames(request);
      const old = cookies(request)[names.session];
      const token = randomToken(); const csrf = randomToken();
      const statements = [db.prepare('INSERT INTO sessions (token_hash,admin_id,expires_at,last_seen) VALUES (?,?,?,?)').bind(await digest(token), admin.id, now() + 28800, now())];
      if (old) statements.push(db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(old)));
      await db.batch(statements);
      const res = response({ admin: { username }, csrf });
      res.headers.append('Set-Cookie', cookie(request, names.session, token, 28800));
      res.headers.append('Set-Cookie', cookie(request, names.csrf, csrf, 28800));
      return res;
    }
    if (method === 'POST' && path === '/api/admin/logout') {
      const names = cookieNames(request);
      const token = cookies(request)[names.session];
      if (token) await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(token)).run();
      const res = response({ ok: true });
      res.headers.append('Set-Cookie', cookie(request, names.session, '', 0));
      res.headers.append('Set-Cookie', cookie(request, names.csrf, '', 0));
      return res;
    }
    if (path === '/api/posts' && method === 'GET') {
      const search = (url.searchParams.get('q') || '').trim();
      const category = url.searchParams.get('category') || '';
      if (search.length > 100 || (category && !categories.includes(category))) throw new HttpError(400, '검색 조건을 확인해 주세요.');
      const pageRaw = url.searchParams.get('page') || '1';
      if (!/^[1-9]\d{0,5}$/.test(pageRaw)) throw new HttpError(400, '페이지 번호가 올바르지 않습니다.');
      const page = Number(pageRaw); const pageSize = 8;
      const clauses = []; const params = [];
      if (category) { clauses.push('p.category=?'); params.push(category); }
      if (search) {
        clauses.push("(p.title LIKE ? ESCAPE '\\' OR p.content LIKE ? ESCAPE '\\')");
        const term = `%${search.replace(/[\\%_]/g, '\\$&')}%`; params.push(term, term);
      }
      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      const batch = await db.batch([
        db.prepare(`SELECT COUNT(*) AS total FROM posts p ${where}`).bind(...params),
        db.prepare(`SELECT ${publicColumns} FROM posts p LEFT JOIN replies r ON r.post_id=p.id ${where} ORDER BY p.created_at DESC,p.id DESC LIMIT ? OFFSET ?`).bind(...params, pageSize, (page - 1) * pageSize),
      ]);
      return response({ posts: batch[1].results, total: batch[0].results[0].total, page, pageSize });
    }
    if (path === '/api/posts' && method === 'POST') {
      await throttle(db, request, 'create-post', 5, 600);
      const data = await readJson(request); const post = fields(data);
      const password = passwordField(data);
      const id = crypto.randomUUID(); const time = now();
      await db.prepare('INSERT INTO posts (id,nickname,title,content,category,password_hash,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').bind(id, post.nickname, post.title, post.content, post.category, await hashPassword(password), time, time).run();
      return response({ id }, 201);
    }
    const match = path.match(/^\/api\/(admin\/)?posts\/([^/]+)(?:\/(verify|reply))?$/);
    if (match) {
      const [, isAdmin, id, action] = match;
      if (!idPattern.test(id)) throw new HttpError(404, '게시글을 찾을 수 없습니다.');
      if (isAdmin) {
        const admin = await adminSession(request, db);
        await throttle(db, request, 'admin-write', 60, 600);
        if (!action && method === 'DELETE') {
          const result = await db.prepare('DELETE FROM posts WHERE id=?').bind(id).run();
          if (!result.meta.changes) throw new HttpError(404, '게시글을 찾을 수 없습니다.');
          return response({ ok: true });
        }
        await postById(db, id);
        if (action === 'reply' && method === 'PUT') {
          const data = await readJson(request); const content = textField(data, 'content', 2, 5000, '답변'); const time = now();
          await db.prepare('INSERT INTO replies (post_id,content,admin_id,created_at,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(post_id) DO UPDATE SET content=excluded.content,admin_id=excluded.admin_id,updated_at=excluded.updated_at').bind(id, content, admin.admin_id, time, time).run();
          return response({ ok: true });
        }
        if (action === 'reply' && method === 'DELETE') {
          await db.prepare('DELETE FROM replies WHERE post_id=?').bind(id).run();
          return response({ ok: true });
        }
      } else {
        if (!action && method === 'GET') return response({ post: await postById(db, id) });
        if ((!action && ['PUT', 'DELETE'].includes(method)) || (action === 'verify' && method === 'POST')) {
          const data = await readJson(request);
          await ownsPost(db, request, id, data);
          if (action === 'verify') return response({ ok: true });
          if (method === 'PUT') {
            const post = fields(data);
            const result = await db.prepare('UPDATE posts SET nickname=?,title=?,content=?,category=?,updated_at=? WHERE id=?').bind(post.nickname, post.title, post.content, post.category, now(), id).run();
            if (!result.meta.changes) throw new HttpError(404, '게시글을 찾을 수 없습니다.');
          } else await db.prepare('DELETE FROM posts WHERE id=?').bind(id).run();
          return response({ ok: true });
        }
      }
    }
    throw new HttpError(404, '요청한 페이지를 찾을 수 없습니다.');
  } catch (error) {
    if (error instanceof HttpError) return response({ error: error.message, field: error.field }, error.status, error.status === 429 ? { 'Retry-After': '900' } : {});
    // Never log request bodies, passwords, SQL parameters or authentication cookies.
    console.error('ZipOne API unavailable', error?.name || 'Error');
    return response({ error: '저장 또는 조회에 실패했습니다. 입력한 내용을 유지한 채 잠시 후 다시 시도해 주세요.' }, 503);
  }
}

export const categories = { product: '제품 질문', purchase: '구매 문의', usage: '사용 방법', idea: '개선 제안', other: '기타 요청' };
let csrf = ''; let sessionPromise;
export async function session(refresh = false) {
  if (!sessionPromise || refresh) {
    sessionPromise = request('/api/session').then(value => { csrf = value.csrf; return value; }).catch(error => { sessionPromise = null; throw error; });
  }
  return sessionPromise;
}
export async function request(path, options = {}) {
  const method = options.method || 'GET';
  if (method !== 'GET' && !csrf) await session();
  let res;
  try {
    res = await fetch(path, { method, credentials: 'same-origin', signal: AbortSignal.timeout(15000), headers: { ...(method === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }) }, ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }) });
  } catch {
    throw new Error(method === 'GET' ? '서버에 연결하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.' : '서버 응답을 확인하지 못했습니다. 입력한 내용은 유지됩니다. 목록에서 등록 여부를 확인한 후 다시 시도해 주세요.');
  }
  let data;
  try { data = await res.json(); } catch { throw new Error('서버 응답을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.'); }
  if (!res.ok) { const error = new Error(data.error || '요청을 처리하지 못했습니다.'); error.status = res.status; error.field = data.field; throw error; }
  if (data.csrf) csrf = data.csrf;
  return data;
}
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null) continue;
    if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  return node;
}
export function showError(target, error) {
  target.className = 'error-message'; target.textContent = error.message || error; target.hidden = false;
  const field = error.field && document.querySelector(`[name="${CSS.escape(error.field)}"]`);
  field?.setAttribute('aria-invalid', 'true'); field?.focus();
}
export function clearError(target, form) { target.hidden = true; target.textContent = ''; form?.querySelectorAll('[aria-invalid]').forEach(field => field.removeAttribute('aria-invalid')); }
export async function busy(button, action, label = '처리 중…') {
  const old = button.textContent; button.disabled = true; button.textContent = label;
  try { return await action(); } finally { button.disabled = false; button.textContent = old; }
}
export function stateBox(title, description, retry) {
  const box = el('div', { class: 'state-box' }, [el('h2', { text: title }), el('p', { text: description })]);
  if (retry) { const button = el('button', { type: 'button', class: 'button secondary', text: '다시 시도' }); button.addEventListener('click', retry); box.append(button); }
  return box;
}
export const dateLabel = value => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value * 1000));
export const statusBadge = answered => el('span', { class: `status${answered ? ' answered' : ''}`, text: answered ? '답변 완료' : '답변 대기' });

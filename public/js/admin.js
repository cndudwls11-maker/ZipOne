import { request, session, showError, clearError, busy } from './api.js';
import { mountBoard } from './board.js';
const form = document.querySelector('#login-form'); const panel = document.querySelector('#admin-content');
const loading = document.querySelector('#admin-loading'); let mounted = false;
function render(admin) {
  loading.hidden = true; form.hidden = !!admin; panel.hidden = !admin;
  if (admin) { document.querySelector('#admin-name').textContent = admin.username; if (!mounted) { mountBoard(); mounted = true; } }
}
async function load() {
  try { render((await session(true)).admin); }
  catch (error) { loading.hidden = true; form.hidden = false; showError(document.querySelector('#login-error'), error); }
}
form.addEventListener('submit', event => {
  event.preventDefault(); const errorBox = document.querySelector('#login-error'); clearError(errorBox, form);
  busy(form.querySelector('button[type=submit]'), async () => {
    try { const data = Object.fromEntries(new FormData(form)); await request('/api/admin/login', { method: 'POST', body: data }); form.elements.password.value = ''; render((await session(true)).admin); }
    catch (error) { showError(errorBox, error); }
  }, '로그인 중…');
});
document.querySelector('#logout-button').addEventListener('click', event => {
  busy(event.currentTarget, async () => {
    try { await request('/api/admin/logout', { method: 'POST', body: {} }); await session(true); render(null); form.elements.username.focus(); }
    catch (error) { showError(document.querySelector('#admin-error'), error); }
  });
});
load();

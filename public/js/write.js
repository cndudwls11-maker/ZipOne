import { request, session, showError, clearError, busy } from './api.js';
const params = new URLSearchParams(location.search); const id = params.get('id');
const form = document.querySelector('#write-form'); const verifyForm = document.querySelector('#verify-form');
const errorBox = document.querySelector('#write-error'); let editPassword = ''; let dirty = false; let submitted = false;
const count = () => { document.querySelector('#content-count').textContent = form.elements.content.value.length.toLocaleString('ko-KR'); };
form.addEventListener('input', () => { dirty = true; count(); });
window.addEventListener('beforeunload', event => { if (dirty && !submitted) { event.preventDefault(); event.returnValue = ''; } });
session().catch(error => showError(errorBox, error));
if (id) {
  document.title = '글 수정 | ZipOne'; document.querySelector('#write-title').textContent = '이야기를 수정하세요.';
  form.hidden = true; verifyForm.hidden = false;
  document.querySelector('#write-submit').textContent = '수정 내용 저장';
  verifyForm.addEventListener('submit', event => {
    event.preventDefault(); const verifyError = document.querySelector('#verify-error'); clearError(verifyError, verifyForm);
    busy(verifyForm.querySelector('button[type=submit]'), async () => {
      try {
        editPassword = verifyForm.elements.password.value;
        await request(`/api/posts/${encodeURIComponent(id)}/verify`, { method: 'POST', body: { password: editPassword } });
        const { post } = await request(`/api/posts/${encodeURIComponent(id)}`);
        for (const key of ['nickname', 'title', 'content', 'category']) form.elements[key].value = post[key];
        form.elements.password.required = false; form.elements.password.disabled = true;
        document.querySelector('#write-password-field').hidden = true;
        verifyForm.elements.password.value = ''; verifyForm.hidden = true; form.hidden = false; count(); form.elements.title.focus();
      } catch (error) { editPassword = ''; showError(verifyError, error); }
    });
  });
}
form.addEventListener('submit', event => {
  event.preventDefault(); clearError(errorBox, form);
  busy(document.querySelector('#write-submit'), async () => {
    try {
      const data = Object.fromEntries(new FormData(form)); data.password = id ? editPassword : data.password;
      const result = await request(id ? `/api/posts/${encodeURIComponent(id)}` : '/api/posts', { method: id ? 'PUT' : 'POST', body: data });
      submitted = true; editPassword = ''; form.elements.password.value = '';
      location.assign(`/post?id=${encodeURIComponent(id || result.id)}&saved=1`);
    } catch (error) { showError(errorBox, error); }
  }, id ? '저장 중…' : '등록 중…');
});

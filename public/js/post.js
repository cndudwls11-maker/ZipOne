import { request, session, el, categories, dateLabel, statusBadge, stateBox, showError, clearError, busy } from './api.js';
const params = new URLSearchParams(location.search); const id = params.get('id');
const target = document.querySelector('#post-container'); const dialog = document.querySelector('#delete-dialog');
let admin = null; let deleteMode = 'author'; let returnFocus;
const endpoint = () => `/api/posts/${encodeURIComponent(id || '')}`;
function openDelete(mode, button) {
  deleteMode = mode; returnFocus = button;
  document.querySelector('#delete-form').reset(); clearError(document.querySelector('#delete-error'));
  document.querySelector('#delete-password-field').hidden = mode === 'admin'; document.querySelector('#delete-password').required = mode !== 'admin';
  document.querySelector('#delete-description').textContent = mode === 'admin' ? '관리자 권한으로 글과 답변을 삭제합니다. 삭제 후에는 복구할 수 없습니다.' : '작성할 때 설정한 비밀번호를 입력해 주세요. 삭제한 글과 답변은 복구할 수 없습니다.';
  dialog.showModal();
}
document.querySelector('#cancel-delete').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => { document.querySelector('#delete-password').value = ''; returnFocus?.focus(); });
document.querySelector('#delete-form').addEventListener('submit', event => {
  event.preventDefault(); const errorBox = document.querySelector('#delete-error'); clearError(errorBox, event.currentTarget);
  busy(event.currentTarget.querySelector('button[type=submit]'), async () => {
    try {
      await request(deleteMode === 'admin' ? `/api/admin/posts/${encodeURIComponent(id)}` : endpoint(), { method: 'DELETE', body: deleteMode === 'admin' ? {} : { password: document.querySelector('#delete-password').value } });
      dialog.close(); location.assign('/board');
    } catch (error) { showError(errorBox, error); }
  }, '삭제 중…');
});
async function load() {
  target.setAttribute('aria-busy', 'true');
  try {
    const [{ post }, current] = await Promise.all([request(endpoint()), session(true)]); admin = current.admin;
    document.title = `${post.title} | ZipOne`;
    const article = el('article');
    if (params.get('saved') === '1') article.append(el('p', { class: 'success-message', role: 'status', text: '게시글이 저장되었습니다.' }));
    article.append(el('header', { class: 'post-header' }, [el('div', { class: 'post-topline' }, [el('span', { class: 'category-text', text: categories[post.category] }), statusBadge(post.answered)]), el('h1', { text: post.title }), el('div', { class: 'post-metadata' }, [el('span', { text: post.nickname }), el('time', { datetime: new Date(post.created_at * 1000).toISOString(), text: dateLabel(post.created_at) }), ...(post.updated_at > post.created_at ? [el('span', { text: `${dateLabel(post.updated_at)} 수정` })] : [])])]), el('div', { class: 'post-body', text: post.content }));
    const reply = el('section', { class: 'reply-panel', 'aria-label': '관리자 답변' });
    if (post.reply_content !== null) reply.append(el('h2', { text: 'ZipOne의 답변' }), el('time', { datetime: new Date(post.reply_updated_at * 1000).toISOString(), text: dateLabel(post.reply_updated_at) }), el('div', { class: 'reply-content', text: post.reply_content }));
    else reply.append(el('h2', { text: '답변을 기다리고 있습니다.' }), el('p', { class: 'muted', text: '남겨주신 이야기를 확인한 후 답변을 남기겠습니다.' }));
    article.append(reply);
    const authorDelete = el('button', { class: 'button secondary', type: 'button', text: '글 삭제' }); authorDelete.addEventListener('click', () => openDelete('author', authorDelete));
    article.append(el('div', { class: 'post-actions' }, [el('a', { class: 'button secondary', href: '/board', text: '목록으로' }), el('div', {}, [el('a', { class: 'button secondary', href: `/write?id=${encodeURIComponent(id)}`, text: '글 수정' }), authorDelete])]));
    if (admin) {
      const panel = el('section', { class: 'admin-reply', 'aria-label': '관리자 답변 관리' });
      const input = el('textarea', { id: 'reply-content', name: 'content', required: '', minlength: '2', maxlength: '5000', rows: '5' }); input.value = post.reply_content || '';
      const errorBox = el('div', { role: 'alert', hidden: '' });
      const submit = el('button', { class: 'button primary', type: 'submit', text: post.answered ? '답변 수정' : '답변 등록' });
      const deleteReply = el('button', { class: 'button secondary', type: 'button', text: '답변 삭제' }); deleteReply.hidden = !post.answered;
      const deletePost = el('button', { class: 'text-button', type: 'button', text: '관리자 권한으로 글 삭제' }); deletePost.addEventListener('click', () => openDelete('admin', deletePost));
      const replyForm = el('form', {}, [el('h2', { text: '관리자 답변 관리' }), el('div', { class: 'field' }, [el('label', { for: 'reply-content', text: '답변 내용' }), input]), errorBox, el('div', { class: 'button-row' }, [submit, deleteReply]), deletePost]);
      replyForm.addEventListener('submit', event => { event.preventDefault(); clearError(errorBox); busy(submit, async () => { try { await request(`/api/admin/posts/${encodeURIComponent(id)}/reply`, { method: 'PUT', body: { content: input.value } }); await load(); } catch (error) { showError(errorBox, error); } }); });
      deleteReply.addEventListener('click', () => { clearError(errorBox); busy(deleteReply, async () => { try { await request(`/api/admin/posts/${encodeURIComponent(id)}/reply`, { method: 'DELETE', body: {} }); await load(); } catch (error) { showError(errorBox, error); } }); });
      panel.append(replyForm); article.append(panel);
    }
    target.replaceChildren(article);
  } catch (error) { target.replaceChildren(stateBox('게시글을 불러오지 못했습니다.', error.message, load)); }
  finally { target.setAttribute('aria-busy', 'false'); }
}
load();

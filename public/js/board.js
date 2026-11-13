import { request, el, categories, stateBox, dateLabel, statusBadge } from './api.js';

export function mountBoard() {
  const form = document.querySelector('#search-form'); const target = document.querySelector('#board-results');
  const params = new URLSearchParams(location.search);
  form.elements.q.value = params.get('q') || '';
  form.elements.category.value = params.get('category') || '';
  form.addEventListener('submit', event => {
    event.preventDefault(); const query = new URLSearchParams();
    if (form.elements.q.value.trim()) query.set('q', form.elements.q.value.trim());
    if (form.elements.category.value) query.set('category', form.elements.category.value);
    location.search = query.toString();
  });
  const load = async () => {
    target.setAttribute('aria-busy', 'true'); target.replaceChildren(el('p', { class: 'state-loading', text: '게시글을 불러오고 있습니다.' }));
    try {
      const query = new URLSearchParams();
      for (const key of ['q', 'category', 'page']) if (params.has(key)) query.set(key, params.get(key));
      const data = await request(`/api/posts?${query}`);
      const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
      const count = el('div', { class: 'board-meta' }, [el('span', { text: `총 ${data.total.toLocaleString('ko-KR')}개의 이야기` }), el('span', { text: `${data.page} / ${totalPages} 페이지` })]);
      target.replaceChildren(count);
      if (!data.posts.length) {
        const box = stateBox(data.total ? '이 페이지에는 게시글이 없습니다.' : (query.has('q') || query.has('category') ? '검색 결과가 없습니다.' : '첫 이야기를 기다리고 있어요.'), data.total ? '다른 페이지에서 게시글을 확인해 주세요.' : '제품 질문이나 개선 의견을 편하게 남겨주세요.');
        box.append(el('a', { href: '/write', class: 'button primary', text: '글 작성하기' })); target.append(box);
      } else {
        const list = el('ul', { class: 'post-list', 'aria-label': '게시글 목록' });
        for (const post of data.posts) {
          list.append(el('li', { class: 'post-item' }, [el('a', { href: `/post?id=${encodeURIComponent(post.id)}` }, [el('span', { class: 'category-text', text: categories[post.category] }), el('div', {}, [el('h2', { text: post.title }), el('p', { text: `${post.nickname} · ${dateLabel(post.created_at)}` })]), statusBadge(post.answered)])]));
        }
        target.append(list);
      }
      if (totalPages > 1) {
        const nav = el('nav', { class: 'pagination', 'aria-label': '게시글 페이지' });
        const addPage = (page, label) => {
          const p = new URLSearchParams(query); p.set('page', page);
          nav.append(el('a', { href: `${location.pathname}?${p}`, text: label || String(page), 'aria-label': label ? label : `${page}페이지`, 'aria-current': page === data.page ? 'page' : undefined }));
        };
        if (data.page > 1) addPage(data.page - 1, '이전');
        const start = Math.max(1, Math.min(data.page - 2, totalPages - 4));
        for (let p = start; p <= Math.min(totalPages, start + 4); p++) addPage(p);
        if (data.page < totalPages) addPage(data.page + 1, '다음');
        target.append(nav);
      }
    } catch (error) { target.replaceChildren(stateBox('게시글을 불러오지 못했습니다.', error.message, load)); }
    finally { target.setAttribute('aria-busy', 'false'); }
  };
  load();
}
if (location.pathname.replace(/\.html$/, '').replace(/\/$/, '') === '/board') mountBoard();

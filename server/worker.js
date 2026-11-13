import { handleApi } from './api.js';
import { securityHeaders } from './security.js';
export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path.startsWith('/api/')) return handleApi(request, env);
    const result = await env.ASSETS.fetch(request);
    const headers = new Headers(result.headers);
    for (const [name, value] of Object.entries(securityHeaders)) headers.set(name, value);
    if (/^\/(admin|write)(?:\.html)?\/?$/.test(path)) headers.set('X-Robots-Tag', 'noindex, nofollow');
    return new Response(result.body, { status: result.status, headers });
  },
};

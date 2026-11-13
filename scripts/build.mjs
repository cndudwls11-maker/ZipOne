import { cp, mkdir, readFile, readdir, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'esbuild';
const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'dist');
if (output !== resolve(root, 'dist') || !output.startsWith(root)) throw new Error('Invalid build output');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(resolve(root, 'public'), output, { recursive: true });
const config = JSON.parse(await readFile(resolve(root, 'site.config.json'), 'utf8'));
const raw = process.env.SITE_URL || config.siteUrl;
const url = raw ? new URL(raw) : null;
if (url && (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash)) throw new Error('SITE_URL must be an HTTPS origin');
if (url) {
  for (const file of await readdir(output)) {
    if (file.endsWith('.html')) {
      const path = resolve(output, file); const html = await readFile(path, 'utf8');
      await writeFile(path, html.replaceAll('https://zipone.pages.dev', url.origin));
    }
  }
  await writeFile(resolve(output, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${url.origin}/</loc></url><url><loc>${url.origin}/board</loc></url></urlset>\n`);
}
await writeFile(resolve(output, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /write\nDisallow: /post\nDisallow: /api/\n${url ? `Sitemap: ${url.origin}/sitemap.xml\n` : ''}`);
await writeFile(resolve(output, '_routes.json'), JSON.stringify({ version: 1, include: ['/api/*', '/admin', '/admin.html', '/write', '/write.html'], exclude: [] }, null, 2));
await build({ entryPoints: [resolve(root, 'server/worker.js')], outfile: resolve(output, '_worker.js'), bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true, legalComments: 'none' });
console.log(`Built plain HTML/CSS/JavaScript + Pages Functions in ${output}`);

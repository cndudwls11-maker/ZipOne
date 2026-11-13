import { runtime, migrate } from './runtime.mjs';
const mf = runtime({ port: Number(process.env.PORT || 8788) });
await migrate(await mf.getD1Database('DB'));
console.log(`ZipOne local preview: ${await mf.ready}`);
console.log('D1 data persists in .zipone/d1. Use npm run admin:create for a local admin account.');
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await mf.dispose(); process.exit(0); });

// docs/ 페이지를 아이폰 크기로 렌더링해 스크린샷 (확인용)
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './config.mjs';
const out = process.argv[2] || path.join(ROOT, 'preview.png');
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices['iPhone 13'], colorScheme: process.env.DARK ? 'dark' : 'light' });
await ctx.route('http://pwa.local/**', r => {
  let p = new URL(r.request().url()).pathname; if (p === '/') p = '/index.html';
  const f = path.join(ROOT, 'docs', p);
  if (p.endsWith('sw.js') || !fs.existsSync(f)) return r.fulfill({ status: 404 });
  r.fulfill({ body: fs.readFileSync(f), contentType: { '.html': 'text/html', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' }[path.extname(f)] });
});
const p = await ctx.newPage();
await p.goto('http://pwa.local/');
await p.waitForSelector('section.court');
await p.screenshot({ path: out, fullPage: process.env.FULL === '1' });
await b.close();
console.log(out);

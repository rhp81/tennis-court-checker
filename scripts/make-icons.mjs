import { chromium } from 'playwright';
import fs from 'node:fs';
const svg = fs.readFileSync(new URL('../docs/icon.svg', import.meta.url), 'utf8');
const b = await chromium.launch();
for (const s of [180, 512]) {
  const p = await b.newPage({ viewport: { width: s, height: s } });
  // iOS가 모서리를 자동으로 둥글게 하므로 PNG는 꽉 찬 사각형으로
  await p.setContent(`<style>body{margin:0;background:#2f7d32}</style>${svg.replace('rx="112"', 'rx="0"').replace('<svg ', `<svg width="${s}" height="${s}" `)}`);
  await p.screenshot({ path: new URL(`../docs/icon-${s}.png`, import.meta.url).pathname });
}
await b.close();

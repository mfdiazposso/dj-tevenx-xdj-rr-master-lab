// Descarga las fuentes self-hosted (subset latin) desde Google Fonts.
import { writeFileSync, mkdirSync } from 'fs';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
mkdirSync('public/fonts', { recursive: true });
async function grab(urlCss, pick) {
  const css = await (await fetch(urlCss, { headers: { 'User-Agent': UA } })).text();
  const res = [];
  for (const b of css.split('@font-face').slice(1)) {
    const ur = /unicode-range:\s*([^;]+);/.exec(b)?.[1] || '';
    if (!ur.includes('U+0000-00FF')) continue;
    const u = /url\((https:[^)]+\.woff2)\)/.exec(b)?.[1];
    const w = /font-weight:\s*([^;]+);/.exec(b)?.[1].trim();
    if (u && pick(w)) res.push({ url: u, weight: w });
  }
  return res;
}
const targets = [];
for (const g of await grab('https://fonts.googleapis.com/css2?family=Geist:wght@100..900&display=swap', () => true)) {
  targets.push({ name: 'Geist-var-latin.woff2', url: g.url }); break;
}
for (const g of await grab('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&display=swap', (w) => w === '700')) {
  targets.push({ name: 'ChakraPetch-700-latin.woff2', url: g.url });
}
let total = 0;
for (const t of targets) {
  const buf = Buffer.from(await (await fetch(t.url)).arrayBuffer());
  writeFileSync(`public/fonts/${t.name}`, buf);
  total += buf.length;
  console.log(`  ${t.name.padEnd(32)} ${(buf.length / 1024).toFixed(1)} KB`);
}
console.log(`TOTAL ${(total / 1024).toFixed(1)} KB`);

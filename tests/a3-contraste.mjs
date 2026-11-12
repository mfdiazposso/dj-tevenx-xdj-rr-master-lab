// AUDITORÍA A3c · Contraste WCAG real de TODO el texto (compone alpha de los fondos)
import { chromium } from 'playwright-core';
const exe = `${process.env.LOCALAPPDATA}\\ms-playwright\\chromium-1169\\chrome-win\\chrome.exe`;
const browser = await chromium.launch({ executablePath: exe, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });

const FN = `(() => {
  // Normaliza cualquier color CSS (oklch/lab/hex/rgb) a rgba pintando 1px y
  // leyendo el pixel: leer fillStyle NO sirve (Chrome devuelve el oklch tal cual).
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const parse = (c) => {
    if (!c) return null;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    try { ctx.fillStyle = c; } catch { return null; }
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    if (d[3] === 0 && c !== 'transparent' && !/rgba\\(\\s*0[,\\s]/.test(c)) return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
    return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
  };
  const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  const effBg = (el) => {
    let stack = [];
    let p = el;
    while (p && p !== document.documentElement) {
      const cs = getComputedStyle(p);
      const bg = parse(cs.backgroundColor);
      const bi = cs.backgroundImage;
      if (bg && bg.a > 0) { stack.push(bg); if (bg.a === 1) break; }
      else if (bi && bi !== 'none') { stack.push({ r: 10, g: 10, b: 12, a: 0.92 }); break; }
      p = p.parentElement;
    }
    let base = { r: 7, g: 7, b: 7, a: 1 };
    for (let i = stack.length - 1; i >= 0; i--) base = over(stack[i], base);
    return base;
  };
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    // solo nodos con texto propio
    const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(' ');
    if (!own) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    // texto con degradado (kinetic): el color real viene del background-clip, no del color
    if (cs.webkitBackgroundClip === 'text' || cs.backgroundClip === 'text') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const fg = parse(cs.color); if (!fg) continue;
    if (fg.a === 0) continue;
    const bg = effBg(el);
    const f = fg.a < 1 ? over(fg, bg) : fg;
    const cr = ratio(f, bg);
    const fs = parseFloat(cs.fontSize);
    const w = parseInt(cs.fontWeight) || 400;
    const large = fs >= 24 || (fs >= 18.66 && w >= 700);
    const need = large ? 3 : 4.5;
    if (cr < need) {
      out.push({ txt: own.slice(0, 40), cr: +cr.toFixed(2), need, fs: Math.round(fs), w, color: cs.color, bg: 'rgb(' + Math.round(bg.r) + ',' + Math.round(bg.g) + ',' + Math.round(bg.b) + ')', tag: el.tagName, cls: (el.className || '').toString().slice(0, 54) });
    }
  }
  return out;
})()`;

const all = {};
for (const tab of ['dashboard', 'mapa', 'lecciones', 'simulador', 'ejercicios', 'tests', 'glosario']) {
  await page.evaluate((t) => { [...document.querySelectorAll('.tabs button')].find((b) => b.getAttribute('aria-label') === 'Ir a ' + t)?.click(); }, tab);
  await page.waitForTimeout(1100);
  const r1 = await page.evaluate(FN);
  await page.waitForTimeout(350);
  const r2 = await page.evaluate(FN);
  // solo cuenta lo que PERSISTE (evita capturar transiciones de 120ms)
  const key = (f) => `${f.color}|${f.bg}|${f.need}|${f.txt}`;
  const s2 = new Set(r2.map(key));
  all[tab] = r1.filter((f) => s2.has(key(f)));
}
await browser.close();

const { writeFileSync } = await import('fs');

import { ROOT } from './lib/paths.mjs';
process.chdir(ROOT);
writeFileSync('audit-contrast-detalle.json', JSON.stringify(all, null, 1));

console.log('\n=== A3c · CONTRASTE WCAG — fallos por pantalla ===\n');
let total = 0;
const byPair = {};
for (const [tab, list] of Object.entries(all)) {
  if (!list.length) { console.log(`✔ ${tab}: 0 fallos`); continue; }
  console.log(`✖ ${tab}: ${list.length}`);
  total += list.length;
  for (const f of list) {
    const k = `${f.color}|${f.bg}|${f.need}`;
    (byPair[k] ||= { n: 0, tabs: {}, ejemplos: [] });
    byPair[k].n++;
    byPair[k].tabs[tab] = (byPair[k].tabs[tab] || 0) + 1;
    if (byPair[k].ejemplos.length < 4) byPair[k].ejemplos.push(`${tab}:"${f.txt}" <${f.cls.slice(0, 46)}>`);
  }
}
console.log(`\nTOTAL fallos de contraste: ${total}`);
console.log(total ? `\n✗ ${total} fallos de contraste` : '\n✓ contraste AA en todo el texto');
process.exit(total > 0 ? 1 : 0);
console.log('\n=== PARES ÚNICOS (para corregir de una vez) ===');
for (const [k, v] of Object.entries(byPair)) {
  const [c, b, n] = k.split('|');
  console.log(`\n  ${c} sobre ${b} (min ${n}) × ${v.n}`);
  console.log(`    pestañas: ${JSON.stringify(v.tabs)}`);
  v.ejemplos.forEach((e) => console.log(`    · ${e}`));
}

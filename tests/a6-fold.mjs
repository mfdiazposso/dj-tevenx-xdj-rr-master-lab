// AUDITORÍA A3b/A6 — alturas, fold, foco visible, zoom 200%
import { chromium } from 'playwright-core';

import { ROOT } from './lib/paths.mjs';
process.chdir(ROOT);
const exe = `${process.env.LOCALAPPDATA}\\ms-playwright\\chromium-1169\\chrome-win\\chrome.exe`;
const browser = await chromium.launch({ executablePath: exe, headless: true });

const VPS = [[320, 568], [390, 844], [430, 932], [768, 1024], [820, 1180], [1280, 800]];
console.log('=== A6 · ALTURA DEL HEADER vs VIEWPORT (móvil) ===');
for (const [w, h] of VPS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 900, hasTouch: w < 900 });
  const page = await ctx.newPage();
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const m = await page.evaluate(() => {
    const hd = document.querySelector('.app-header');
    const r = hd?.getBoundingClientRect();
    const main = document.querySelector('main')?.getBoundingClientRect();
    return { header: Math.round(r?.height || 0), vh: window.innerHeight, pct: Math.round(((r?.height || 0) / window.innerHeight) * 100), mainTop: Math.round(main?.top || 0) };
  });
  console.log(`  ${w}x${h}: header ${m.header}px = ${m.pct}% del viewport · contenido empieza en y=${m.mainTop}`);
  await ctx.close();
}

console.log('\n=== A6 · ¿EL MIXER ESTÁ EN EL FOLD? (simulador, portrait) ===');
for (const [w, h] of [[320, 568], [390, 844], [430, 932], [768, 1024], [820, 1180]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 900, hasTouch: w < 900 });
  const page = await ctx.newPage();
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await page.evaluate(() => { [...document.querySelectorAll('.tabs button')].find((b) => b.getAttribute('aria-label') === 'Ir a simulador')?.click(); });
  await page.waitForTimeout(1200);
  const m = await page.evaluate(() => {
    const mixer = document.querySelector('.mixer');
    const r = mixer?.getBoundingClientRect();
    const hint = document.querySelector('.rotate-hint.show');
    const hr = document.querySelector('.app-header')?.getBoundingClientRect();
    // scroll necesario para ver el mixer
    const scrollNeeded = r ? Math.max(0, Math.round(r.top - (hr?.bottom || 0))) : 0;
    return { mixerTop: Math.round(r?.top || -1), mixerH: Math.round(r?.height || 0), scrollNeeded, vh: window.innerHeight, hintVisible: !!hint };
  });
  console.log(`  ${w}x${h}: mixer empieza en y=${m.mixerTop} (alt ${m.mixerH}) · scroll para verlo: ${m.scrollNeeded}px · hint visible: ${m.hintVisible}`);
  await ctx.close();
}

console.log('\n=== A3 · FOCO VISIBLE (navegación real con TAB) ===');
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await page.evaluate(() => { [...document.querySelectorAll('.tabs button')].find((b) => b.getAttribute('aria-label') === 'Ir a simulador')?.click(); });
  await page.waitForTimeout(1200);
  let conFoco = 0; const sinFoco = [];
  for (let i = 0; i < 50; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const outlineOk = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
      const ringOk = cs.boxShadow !== 'none' && /rgb/.test(cs.boxShadow);
      return { label: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 30), ok: outlineOk || ringOk, w: Math.round(r.width), h: Math.round(r.height) };
    });
    if (!info || (info.w === 0 && info.h === 0)) continue;
    if (info.ok) conFoco++; else sinFoco.push(info.label);
  }
  console.log(`  controles tabulados con foco visible: ${conFoco}`);
  console.log(`  SIN indicador de foco: ${sinFoco.length}`, sinFoco.slice(0, 12));
  await ctx.close();
}

console.log('\n=== A3 · ZOOM DE TEXTO 200% (root font-size 32px) ===');
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
  await page.waitForTimeout(700);
  const z = await page.evaluate(() => {
    const de = document.documentElement;
    const over = [];
    for (const el of document.querySelectorAll('main *, header *')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > window.innerWidth + 2) over.push((el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 34));
    }
    return { overflowX: de.scrollWidth - de.clientWidth, over: [...new Set(over)].slice(0, 10), n: over.length };
  });
  console.log(`  overflowX=${z.overflowX}px · ${z.n} elementos desbordados`);
  z.over.forEach((o) => console.log(`    ✗ "${o}"`));
  await ctx.close();
}

console.log('\n=== A2 · MULTITOUCH: ¿se mueven 2 faders a la vez? ===');
{
  // viewport alto para que los knobs del mixer estén dentro del viewport
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1600 }, hasTouch: true });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await page.evaluate(() => { [...document.querySelectorAll('.tabs button')].find((b) => b.getAttribute('aria-label') === 'Ir a simulador')?.click(); });
  await page.waitForTimeout(1500);
  // 2 knobs con X distinta (canales en paralelo) y visibles
  const two = await page.evaluate(() => {
    const ks = [...document.querySelectorAll('[role="slider"][aria-label]')].filter((x) => {
      const r = x.getBoundingClientRect();
      return r.width > 4 && x.getAttribute('aria-valuenow') && !x.classList.contains('jog') && r.top > 60 && r.bottom < window.innerHeight - 10;
    });
    const a = ks[0];
    const b = ks.find((k) => Math.abs(k.getBoundingClientRect().left - a.getBoundingClientRect().left) > 40);
    return [a, b].filter(Boolean).map((k) => {
      const r = k.getBoundingClientRect();
      return { label: k.getAttribute('aria-label'), x: r.left + r.width / 2, y: r.top + r.height / 2, v: k.getAttribute('aria-valuenow') };
    });
  });
  if (two.length < 2) {
    console.log('  (no hay 2 knobs visibles simultáneos: se omite)');
  } else {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: two.map((k, i) => ({ x: k.x, y: k.y, id: i + 1 })) });
    await page.waitForTimeout(60);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: two.map((k, i) => ({ x: k.x, y: k.y - 35, id: i + 1 })) });
    await page.waitForTimeout(250);
    const after = await page.evaluate((labels) => labels.map((lb) => [...document.querySelectorAll('[role="slider"][aria-label]')].find((x) => x.getAttribute('aria-label') === lb)?.getAttribute('aria-valuenow')), two.map((k) => k.label));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const changed = after.filter((v, i) => v !== two[i].v).length;
    console.log(`  ${two.map((k) => k.label + ' ' + k.v).join(' | ')} → ${after.join(' | ')}`);
    console.log(`  → ${changed}/2 cambiaron ${changed === 2 ? 'MULTITÁCTIL OK ✓' : 'FALLO ✗'}`);
    if (changed !== 2) process.exitCode = 1;
  }
  await ctx.close();
}

await browser.close();

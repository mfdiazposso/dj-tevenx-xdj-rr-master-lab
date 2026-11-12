import { chromium } from 'playwright-core';

import { ROOT } from './lib/paths.mjs';
process.chdir(ROOT);

const url = process.argv[2] || 'http://localhost:4173/';
const exe = `${process.env.LOCALAPPDATA}\\ms-playwright\\chromium-1169\\chrome-win\\chrome.exe`;
const browser = await chromium.launch({ executablePath: exe, headless: true });

// Detecta intersección real entre controles interactivos (hermanos, no ancestros)
// v14 FASE B: recorta el rect por los ancestros con overflow. getBoundingClientRect
// NO recorta: un botón dentro de un scroller (max-h-56 overflow-auto) devuelve su caja
// "virtual" fuera de la ventana visible → falsos overlaps con elementos de otras
// tarjetas (los "Ver" de misiones invisibles chocaban con los botones de lección).
const OVERLAP_FN = `(() => {
  const sel = 'button, input, [role="slider"], select, a[href]';
  const clipRect = (el) => {
    const r = el.getBoundingClientRect();
    let box = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    let p = el.parentElement;
    while (p && p !== document.documentElement) {
      const cs = getComputedStyle(p);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
        const pr = p.getBoundingClientRect();
        box.left = Math.max(box.left, pr.left); box.top = Math.max(box.top, pr.top);
        box.right = Math.min(box.right, pr.right); box.bottom = Math.min(box.bottom, pr.bottom);
      }
      p = p.parentElement;
    }
    return { left: box.left, top: box.top, right: box.right, bottom: box.bottom,
             width: Math.max(0, box.right - box.left), height: Math.max(0, box.bottom - box.top) };
  };
  const vis = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return null;
    if (cs.pointerEvents === 'none') return null;
    const b = clipRect(el);
    if (b.width < 2 || b.height < 2) return null;
    return b;
  };
  const els = [...document.querySelectorAll(sel)].filter((el) => vis(el));
  const hits = [];
  for (let i = 0; i < els.length; i++) {
    for (let j = i + 1; j < els.length; j++) {
      const a = els[i], b = els[j];
      if (a.contains(b) || b.contains(a)) continue;
      const ra = vis(a), rb = vis(b);
      if (!ra || !rb) continue;
      const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (ox > 2 && oy > 2) {
        hits.push({
          a: (a.getAttribute('aria-label') || a.textContent || a.tagName).trim().slice(0, 40),
          b: (b.getAttribute('aria-label') || b.textContent || b.tagName).trim().slice(0, 40),
          ox: Math.round(ox), oy: Math.round(oy),
        });
      }
    }
  }
  const de = document.documentElement;
  return {
    overlaps: hits.slice(0, 20),
    overlapCount: hits.length,
    overflowX: de.scrollWidth - de.clientWidth,
    scrollW: de.scrollWidth, clientW: de.clientWidth,
    count: els.length,
  };
})()`;

// ===== TAREA 1: checks de orientación FUERA del simulador =====
// La app normal no debe: (a) tener ningún elemento rotado con CSS transform
// en el root/wrapper, (b) bloquear scroll, (c) quedar fija position:fixed.
const ORIENT_FN = `(() => {
  const de = document.documentElement;
  const body = cs(document.body);
  const root = document.getElementById('root');
  const first = root && root.firstElementChild;
  const rotated = [];
  for (const el of document.querySelectorAll('body *')) {
    const t = getComputedStyle(el).transform;
    if (t && t !== 'none' && /matrix\\(/.test(t)) {
      const m = t.match(/matrix\\(([^)]+)\\)/);
      if (m) {
        const [a, b] = m[1].split(',').map(Number);
        // rotación real (no translate puro): |b| > 0.01 con a cerca de 0
        if (Math.abs(b) > 0.01 && Math.abs(a) < 0.5) {
          rotated.push((el.className || el.tagName).toString().slice(0, 60));
        }
      }
    }
  }
  function cs(el) { return el ? getComputedStyle(el) : null; }
  return {
    rotated: rotated.slice(0, 5),
    bodyOverflow: body ? body.overflow : '?',
    bodyPosition: body ? body.position : '?',
    rootPosition: first ? getComputedStyle(first).position : '?',
    scrollableY: de.scrollHeight > de.clientHeight,
    orientation: screen.orientation ? screen.orientation.type : window.matchMedia('(orientation: portrait)').matches ? 'portrait' : 'landscape',
  };
})()`;

async function run(w, h, name, isMobile, clickSim) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile, hasTouch: isMobile, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(url, { waitUntil: 'networkidle' });
  if (clickSim) {
    await page.evaluate(() => { [...document.querySelectorAll('.tabs button')].find((b) => b.textContent?.includes('SIMULADOR'))?.click(); });
    await page.waitForTimeout(800);
  }
  await page.waitForTimeout(600);

  const results = {};
  if (isMobile && w < 500 && !clickSim) {
    // portrait: probar cada tab táctil del simulador si está montado
    for (const t of ['d1', 'mix', 'd2']) {
      await page.evaluate((tab) => { [...document.querySelectorAll('.sim-tabs button')].find((b) => b.getAttribute('aria-label') === 'Ver ' + tab)?.click(); }, t);
      await page.waitForTimeout(400);
      results['tab-' + t] = await page.evaluate(OVERLAP_FN);
    }
    await page.evaluate(() => { [...document.querySelectorAll('.sim-tabs button')].find((b) => b.getAttribute('aria-label') === 'Ver mix')?.click(); });
  } else {
    results.main = await page.evaluate(OVERLAP_FN);
  }
  await page.screenshot({ path: `ov-${name}.png` });
  console.log(`\n== ${name} (${w}x${h}) ==`);
  for (const [k, v] of Object.entries(results)) {
    console.log(` [${k}] overlaps=${v.overlapCount} overflowX=${v.overflowX} (${v.scrollW}/${v.clientW}) controles=${v.count}`);
    for (const h2 of v.overlaps.slice(0, 8)) console.log(`    ✗ "${h2.a}" ∩ "${h2.b}" = ${h2.ox}x${h2.oy}px`);
  }
  if (errs.length) console.log(' PAGEERRORS:', errs.join(' | '));
  await ctx.close();
}

// ===== TAREA 1: orientación de páginas FUERA del simulador =====
async function runOrientation(w, h, name, expectType) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 500, hasTouch: w < 500, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const info = await page.evaluate(ORIENT_FN);
  const realType = w > h ? 'landscape' : 'portrait';
  const ok = info.rotated.length === 0 && info.bodyOverflow !== 'hidden' && info.rootPosition !== 'fixed';
  console.log(`\n== orientación ${name} (${w}x${h}, esperado ${realType}) ==`);
  console.log(` rotados=${JSON.stringify(info.rotated)} bodyOverflow=${info.bodyOverflow} rootPos=${info.rootPosition} scrollY=${info.scrollableY} → ${ok ? 'OK' : 'FALLO'}`);
  await page.screenshot({ path: `ov-orient-${name}.png` });
  await ctx.close();
  return ok;
}

await run(390, 844, 'portrait-390', true, false);
await run(390, 844, 'portrait-sim-390', true, true);
await run(844, 390, 'landscape-844', true, true);
await run(1280, 800, 'desktop-1280', false, true);
await run(320, 568, 'small-320', true, false);
await run(320, 568, 'small-320-sim', true, true);
await run(3840, 2160, '4k-3840', false, true);

let orientOk = true;
orientOk = await runOrientation(390, 844, 'web-portrait', 'portrait') && orientOk;
orientOk = await runOrientation(844, 390, 'web-landscape', 'landscape') && orientOk;
orientOk = await runOrientation(1280, 800, 'web-desktop', 'landscape') && orientOk;

console.log(`\nORIENTACIÓN WEB: ${orientOk ? 'OK (sin rotación CSS, sin scroll bloqueado, sin fixed)' : 'FALLO'}`);
await browser.close();

// AUDITORÍA A1 — Matriz de dispositivos (Fase A, solo lectura: no toca la app)
// Mide: overlaps · overflowX · texto cortado · targets táctiles <44px (48 PLAY/CUE)
//        · contenido bajo notch/barra inferior (safe-area real vía CDP)
import { chromium } from 'playwright-core';
import { mkdirSync } from 'fs';

import { ROOT } from './lib/paths.mjs';
process.chdir(ROOT);

const url = 'http://localhost:4173/';
const exe = `${process.env.LOCALAPPDATA}\\ms-playwright\\chromium-1169\\chrome-win\\chrome.exe`;
mkdirSync('audit-shots', { recursive: true });

const DEVICES = [
  { name: '320x568-SE', w: 320, h: 568, mobile: true, notch: 0 },
  { name: '390x844-i14', w: 390, h: 844, mobile: true, notch: 47 },
  { name: '360x800-android', w: 360, h: 800, mobile: true, notch: 24 },
  { name: '430x932-promax', w: 430, h: 932, mobile: true, notch: 47 },
  { name: '768x1024-tablet', w: 768, h: 1024, mobile: true, notch: 0 },
  { name: '1024x768-tabletL', w: 1024, h: 768, mobile: false, notch: 0 },
  { name: '820x1180-ipad', w: 820, h: 1180, mobile: true, notch: 0 },
  { name: '1280x800-laptop', w: 1280, h: 800, mobile: false, notch: 0 },
  { name: '1440x900-laptop', w: 1440, h: 900, mobile: false, notch: 0 },
  { name: '1920x1080-desktop', w: 1920, h: 1080, mobile: false, notch: 0 },
  { name: '3840x2160-4k', w: 3840, h: 2160, mobile: false, notch: 0 },
  { name: '280x653-fold-cerrado', w: 280, h: 653, mobile: true, notch: 0 },
  { name: '717x512-fold-abierto', w: 717, h: 512, mobile: true, notch: 0 },
  { name: '2560x1080-ultrawide', w: 2560, h: 1080, mobile: false, notch: 0 },
];

const TABS = ['dashboard', 'mapa', 'lecciones', 'simulador', 'ejercicios', 'tests', 'glosario'];

// ===== Medición in-page =====
const MEASURE = `(() => {
  const INTER = 'button, input:not([type=hidden]), select, textarea, a[href], [role="slider"], [role="button"], [role="tab"]';
  // v14 FASE B: recorta el rect por los ancestros con overflow (getBoundingClientRect
  // NO recorta: un boton dentro de un scroller devuelve su caja "virtual", fuera de la
  // ventana visible, y produce falsos overlaps con elementos de otras tarjetas).
  const clipRect = (el) => {
    let r = el.getBoundingClientRect();
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
    if (b.width < 1 || b.height < 1) return null;   // recortado por scroller
    return b;
  };
  const label = (el) => (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || el.tagName).trim().replace(/\\s+/g,' ').slice(0, 44);

  // 1) OVERLAPS entre interactivos hermanos (con rect recortado)
  const els = [...document.querySelectorAll(INTER)].filter((el) => vis(el));
  const hits = [];
  for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
    const a = els[i], b = els[j];
    if (a.contains(b) || b.contains(a)) continue;
    const ra = vis(a), rb = vis(b);
    if (!ra || !rb) continue;
    const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
    const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
    if (ox > 2 && oy > 2) hits.push({ a: label(a), b: label(b), ox: Math.round(ox), oy: Math.round(oy) });
  }

  // 2) TEXTO CORTADO: overflow oculto sin ellipsis (contenido inaccesible)
  const cut = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.children.length > 0 && !['BUTTON','A','LABEL','SPAN','P','H1','H2','H3','LI','TD'].includes(el.tagName)) continue;
    const cs = getComputedStyle(el);
    // los sr-only (regiones live para lector de pantalla) son 1px por diseño
    if (cs.clip === 'rect(0px, 0px, 0px, 0px)' || cs.clipPath === 'inset(50%)') continue;
    if (cs.overflow === 'visible' && cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
    const hasText = (el.textContent || '').trim().length > 0;
    if (!hasText) continue;
    const ellipsis = cs.textOverflow === 'ellipsis';
    const hClip = el.scrollWidth > el.clientWidth + 1 && cs.overflowX !== 'visible';
    const vClip = el.scrollHeight > el.clientHeight + 1 && cs.overflowY !== 'visible' && cs.overflowY !== 'auto' && cs.overflowY !== 'scroll';
    if (hClip && !ellipsis) cut.push({ el: label(el), dir: 'h', need: el.scrollWidth, have: el.clientWidth, why: cs.overflowX });
    else if (vClip) cut.push({ el: label(el), dir: 'v', need: el.scrollHeight, have: el.clientHeight, why: cs.overflowY });
  }

  // 3) TARGETS TÁCTILES < 44px (o <48 en PLAY/CUE)
  const small = [];
  for (const el of els) {
    const r = vis(el); if (!r) continue;
    const w = Math.round(r.width), h = Math.round(r.height);
    const l = label(el).toLowerCase();
    const isPlayCue = /play|pause|cue|reproduc|pausa/.test(l) && !/canal|hot/.test(l);
    const min = isPlayCue ? 48 : 44;
    if (w < min || h < min) small.push({ el: label(el), w, h, min, playCue: isPlayCue });
  }
  // 4) CONTENIDO BAJO NOTCH / BARRA INFERIOR (safe-area ya aplicado por el motor)
  const vh = window.innerHeight, vw = window.innerWidth;
  const underTop = [], underBottom = [];
  for (const el of els) {
    const r = vis(el); if (!r) continue;
    // notch: primeros 44px de la zona superior
    if (r.top < 44 && r.bottom > 0 && r.height > 6) underTop.push({ el: label(el), top: Math.round(r.top), h: Math.round(r.height) });
    // barra inferior: últimos 34px
    if (r.bottom > vh - 34 && r.top < vh) underBottom.push({ el: label(el), bottom: Math.round(r.bottom), vh });
  }
  const de = document.documentElement;
  const body = getComputedStyle(document.body);
  return {
    overlaps: hits.slice(0, 12), overlapCount: hits.length,
    cut: cut.slice(0, 12), cutCount: cut.length,
    small: small.slice(0, 14), smallCount: small.length,
    underTop: underTop.slice(0, 10), underTopCount: underTop.length,
    underBottom: underBottom.slice(0, 10), underBottomCount: underBottom.length,
    overflowX: de.scrollWidth - de.clientWidth, scrollW: de.scrollWidth, clientW: de.clientWidth,
    docH: de.scrollHeight,
    safeTop: body.paddingTop, safeBottom: body.paddingBottom,
    count: els.length,
  };
})()`;

const browser = await chromium.launch({ executablePath: exe, headless: true });
const report = [];
let cdpOk = true;

for (const d of DEVICES) {
  const ctx = await browser.newContext({
    viewport: { width: d.w, height: d.h }, isMobile: d.mobile, hasTouch: d.mobile, deviceScaleFactor: 1,
    userAgent: d.mobile ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' : undefined,
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message.slice(0, 120)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('C:' + m.text().slice(0, 120)); });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);

  // Safe-area real vía CDP (si existe el comando)
  if (cdpOk && d.notch) {
    try {
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: d.notch, left: 0, bottom: 34, right: 0 } });
    } catch { cdpOk = false; }
  }

  for (const tab of TABS) {
    if (tab !== 'dashboard') {
      await page.evaluate((t) => { [...document.querySelectorAll('.tabs button')].find((b) => b.getAttribute('aria-label') === 'Ir a ' + t)?.click(); }, tab);
      await page.waitForTimeout(tab === 'simulador' ? 1200 : 650);
    }
    const m = await page.evaluate(MEASURE);
    report.push({ dev: d.name, w: d.w, h: d.h, tab, ...m, errs: errs.slice() });
    if (tab === 'dashboard' || tab === 'simulador') {
      await page.screenshot({ path: `audit-shots/${d.name}-${tab}.png` });
    }
  }
  await ctx.close();
}

await browser.close();

// ===== INFORME =====
const bad = report.filter((r) => r.overlapCount || r.overflowX > 0 || r.cutCount || r.smallCount || r.underTopCount || r.underBottomCount || r.errs.length);
console.log(`\n=== MATRIZ A1: ${report.length} combinaciones (${DEVICES.length} dispositivos × ${TABS.length} rutas) ===`);
console.log(`safe-area vía CDP: ${cdpOk ? 'ACTIVO' : 'no disponible (se reporta por análisis de código)'}\n`);
console.log('DISPOSITIVO'.padEnd(22) + 'RUTA'.padEnd(13) + 'OVL  OVF  CORT  TGT<44  NOTCH  BARRA  ERR');
for (const r of report) {
  const flag = (n, lim = 0) => (r[n] > lim ? String(r[n]).padEnd(4) : '·'.padEnd(4));
  console.log(
    r.dev.padEnd(22) + r.tab.padEnd(13) +
    flag('overlapCount') + flag('overflowX') + flag('cutCount') + flag('smallCount') +
    flag('underTopCount') + flag('underBottomCount') + (r.errs.length ? '⚠ ' + r.errs.length : '·')
  );
}
console.log(`\n--- DETALLE DE HALLAZGOS ---`);
for (const r of bad) {
  console.log(`\n### ${r.dev} / ${r.tab} (${r.w}x${r.h})`);
  if (r.overlapCount) { console.log('  OVERLAPS:'); r.overlaps.forEach((o) => console.log(`    ✗ "${o.a}" ∩ "${o.b}" = ${o.ox}x${o.oy}px`)); }
  if (r.overflowX > 0) console.log(`  OVERFLOW-X: ${r.overflowX}px (scroll ${r.scrollW} > client ${r.clientW})`);
  if (r.cutCount) { console.log('  TEXTO CORTADO:'); r.cut.slice(0, 6).forEach((c) => console.log(`    ✗ [${c.dir}] "${c.el}" necesita ${c.need}px tiene ${c.have}px (${c.why})`)); }
  if (r.smallCount) { console.log('  TARGETS PEQUEÑOS:'); r.small.slice(0, 8).forEach((s) => console.log(`    ✗ "${s.el}" ${s.w}x${s.h} (min ${s.min})${s.playCue ? ' [PLAY/CUE]' : ''}`)); }
  if (r.underTopCount) { console.log('  BAJO NOTCH (<44px):'); r.underTop.slice(0, 5).forEach((u) => console.log(`    ! "${u.el}" top=${u.top} h=${u.h}`)); }
  if (r.underBottomCount) { console.log('  BAJO BARRA INFERIOR (>vh-34):'); r.underBottom.slice(0, 5).forEach((u) => console.log(`    ! "${u.el}" bottom=${u.bottom}/${u.vh}`)); }
  if (r.errs.length) console.log('  ERRORES:', r.errs.join(' | '));
}
console.log(`\nRESUMEN: ${bad.length}/${report.length} combinaciones con hallazgos.`);
const MUST = report.filter((r) => r.overlapCount > 0 || r.overflowX > 0 || r.errs.length);
console.log(MUST.length ? `\n✗ ${MUST.length} combinaciones con overlaps/overflowX/errores` : '\n✓ 0 overlaps · 0 overflowX en todas las combinaciones');
process.exit(MUST.length ? 1 : 0);
const tot = (k) => report.reduce((s, r) => s + r[k], 0);
const totErr = report.reduce((s, r) => s + r.errs.length, 0);
console.log(`TOTALES → overlaps:${tot('overlapCount')} overflowX:${report.filter(r=>r.overflowX>0).length} cortados:${tot('cutCount')} targets:${tot('smallCount')} notch:${tot('underTopCount')} barra:${tot('underBottomCount')} errores:${totErr}`);

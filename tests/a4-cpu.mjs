// AUDITORÍA A4b — CPU real: coste del jog y del waveform con CPU throttling 4x
import { chromium } from 'playwright-core';

import { ROOT } from './lib/paths.mjs';
process.chdir(ROOT);
const exe = `${process.env.LOCALAPPDATA}\\ms-playwright\\chromium-1169\\chrome-win\\chrome.exe`;
const browser = await chromium.launch({ executablePath: exe, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await page.evaluate(() => { [...document.querySelectorAll('.tabs button')].find((b) => b.getAttribute('aria-label') === 'Ir a simulador')?.click(); });
await page.waitForTimeout(1500);

// Baseline: coste de un frame en reposo
const measure = async (label, action, ms = 2500) => {
  await page.evaluate(() => { window.__frames = 0; window.__t0 = performance.now(); const l = () => { window.__frames++; requestAnimationFrame(l); }; requestAnimationFrame(l); });
  await action();
  await page.waitForTimeout(ms);
  return await page.evaluate((l) => {
    const dt = performance.now() - window.__t0;
    return { label: l, fps: +(window.__frames / (dt / 1000)).toFixed(1), frames: window.__frames, ms: Math.round(dt) };
  }, label);
};

// 1) Reposo (idle) con el simulador montado
const idle = await measure('idle (simulador montado)', async () => {});
// 2) Con el deck reproduciendo (giro de jog + waveform + vúmetro)
await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Play pause deck 1')?.click(); });
await page.waitForTimeout(600);
const playing = await measure('deck reproduciendo (jog+waveform+vúmetro)', async () => {});
// 3) Arrastrando el jog (scratch) 60 eventos
const jogDrag = await measure('arrastrando el JOG (scratch)', async () => {
  await page.evaluate(async () => {
    const el = document.querySelector('.jog');
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7, clientX: cx, clientY: cy, buttons: 1 }));
    for (let i = 0; i < 60; i++) {
      el.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 7, clientX: cx + i * 2, clientY: cy, buttons: 1 }));
      await new Promise((res) => setTimeout(res, 16));
    }
    el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7, clientX: cx + 120, clientY: cy }));
  });
});
// 4) Tamaño real del DOM del simulador (peso para render)
const dom = await page.evaluate(() => ({
  nodos: document.querySelectorAll('*').length,
  nodosSim: document.querySelectorAll('.simulator-wrapper *').length,
  nodosMain: document.querySelectorAll('main *').length,
}));
// 5) Long tasks durante la reproducción (con throttling)
const lt = await page.evaluate(() => new Promise((res) => {
  const tasks = [];
  try {
    const po = new PerformanceObserver((l) => l.getEntries().forEach((e) => tasks.push(Math.round(e.duration))));
    po.observe({ entryTypes: ['longtask'] });
  } catch { /* noop */ }
  setTimeout(() => res(tasks), 2000);
}));

console.log('\n=== A4b · CPU con throttling 4x (simulador montado) ===');
for (const m of [idle, playing, jogDrag]) console.log(`  ${m.label.padEnd(40)} ${String(m.fps).padStart(6)} fps  (${m.frames} frames / ${m.ms} ms)`);
console.log('\n  DOM:', JSON.stringify(dom));
console.log('  Long tasks (>50ms) durante reproducción:', lt.length ? lt.join(', ') + ' ms' : 'ninguna');
const target = 60;
console.log(`\n  Objetivo 60 fps → idle ${idle.fps >= 55 ? 'OK' : 'DEGRADADO'}, playing ${playing.fps >= 55 ? 'OK' : 'DEGRADADO'}, jog ${jogDrag.fps >= 45 ? 'OK' : 'DEGRADADO'}`);
await browser.close();

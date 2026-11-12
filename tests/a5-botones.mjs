// AUDITORÍA A5 — Barrido de TODOS los botones (simulador + web): ¿hacen algo?
// Detecta no-ops comparando el estado del DOM antes/después del click.
import { chromium } from 'playwright-core';

import { ROOT } from './lib/paths.mjs';
process.chdir(ROOT);

const url = 'http://localhost:4173/';
const exe = `${process.env.LOCALAPPDATA}\\ms-playwright\\chromium-1169\\chrome-win\\chrome.exe`;
const browser = await chromium.launch({ executablePath: exe, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message.slice(0, 140)));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 140)); });

// firma del estado visible (hash del HTML completo del main: detecta CUALQUIER cambio)
const SIG = `(() => {
  const main = document.querySelector('main') || document.body;
  const html = main.innerHTML;
  let h = 5381;
  for (let i = 0; i < html.length; i++) { h = ((h * 33) ^ html.charCodeAt(i)) >>> 0; }
  const txt = (main.innerText || '').replace(/\\s+/g, ' ');
  let h2 = 5381;
  for (let i = 0; i < txt.length; i++) { h2 = ((h2 * 33) ^ txt.charCodeAt(i)) >>> 0; }
  return h + ':' + h2 + ':' + html.length;
})()`;

const results = [];
async function sweep(scopeSel, scopeName, tab) {
  const buttons = await page.evaluate((scope) => {
    const root = document.querySelector(scope) || document.body;
    return [...root.querySelectorAll('button, a[href]')].map((b, i) => ({
      i, aria: b.getAttribute('aria-label') || '', text: (b.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 34),
      disabled: b.disabled === true, tag: b.tagName,
    }));
  }, scopeSel);
  for (const b of buttons) {
    if (b.disabled) { results.push({ tab, scope: scopeName, name: b.aria || b.text, status: 'disabled' }); continue; }
    const before = await page.evaluate(SIG);
    const clicked = await page.evaluate(([scope, idx]) => {
      const root = document.querySelector(scope) || document.body;
      const els = [...root.querySelectorAll('button, a[href]')];
      const el = els[idx];
      if (!el) return false;
      el.scrollIntoView({ block: 'center' });
      el.click();
      return true;
    }, [scopeSel, b.i]);
    if (!clicked) { results.push({ tab, scope: scopeName, name: b.aria || b.text, status: 'NO-ENCONTRADO' }); continue; }
    await page.waitForTimeout(190);
    const after = await page.evaluate(SIG);
    results.push({ tab, scope: scopeName, name: b.aria || b.text, status: before === after ? 'NO-OP' : 'ok' });
  }
}

// ---------- WEB: 7 rutas ----------
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
for (const tab of ['dashboard', 'mapa', 'lecciones', 'simulador', 'ejercicios', 'tests', 'glosario']) {
  await page.evaluate((t) => { [...document.querySelectorAll('.tabs button')].find((b) => b.getAttribute('aria-label') === 'Ir a ' + t)?.click(); }, tab);
  await page.waitForTimeout(tab === 'simulador' ? 1200 : 700);
  // el scope del simulador se audita aparte (más detalle)
  if (tab !== 'simulador') await sweep('main', 'web', tab);
}
// ---------- SIMULADOR: por deck ----------
await page.evaluate(() => { [...document.querySelectorAll('.tabs button')].find((b) => b.getAttribute('aria-label') === 'Ir a simulador')?.click(); });
await page.waitForTimeout(1400);
await sweep('.simulator-wrapper', 'sim', 'simulador');
// mixer por separado
await sweep('.mixer', 'mixer', 'simulador');

await browser.close();

// ---------- INFORME ----------
const byStatus = {};
for (const r of results) (byStatus[r.status] ||= []).push(r);
console.log(`\n=== A5 · BARRIDO DE BOTONES: ${results.length} controles ===\n`);
for (const [st, list] of Object.entries(byStatus)) {
  console.log(`--- ${st}: ${list.length} ---`);
  if (st !== 'ok' && st !== 'disabled') list.forEach((r) => console.log(`   ✗ [${r.tab}/${r.scope}] "${r.name}"`));
}
console.log('\n--- NO-OP (click sin cambio visible) ---');
(byStatus['NO-OP'] || []).forEach((r) => console.log(`   ⚠ [${r.tab}/${r.scope}] "${r.name}"`));
console.log('\n--- DISABLED ---');
(byStatus['disabled'] || []).forEach((r) => console.log(`   ○ [${r.tab}/${r.scope}] "${r.name}"`));
if (errs.length) { console.log('\n--- ERRORES DE CONSOLA ---'); [...new Set(errs)].forEach((e) => console.log('   ' + e)); }
else console.log('\nSin errores de consola ✓');
console.log(`\nRESUMEN: ok=${(byStatus['ok'] || []).length} no-op=${(byStatus['NO-OP'] || []).length} disabled=${(byStatus['disabled'] || []).length} no-encontrado=${(byStatus['NO-ENCONTRADO'] || []).length}`);

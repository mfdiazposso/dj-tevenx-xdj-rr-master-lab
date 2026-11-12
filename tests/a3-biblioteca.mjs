import { chromium } from 'playwright-core';
import path from 'path';
import { FIXTURES } from './lib/paths.mjs';

import { ROOT } from './lib/paths.mjs';
process.chdir(ROOT);
const exe = `${process.env.LOCALAPPDATA}\\ms-playwright\\chromium-1169\\chrome-win\\chrome.exe`;
const browser = await chromium.launch({ executablePath: exe, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 200)); });
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await page.evaluate(() => { [...document.querySelectorAll('.tabs button')].find((b) => b.textContent?.includes('SIMULADOR'))?.click(); });
await page.waitForTimeout(600);

// 1) Abrir MIS TRACKS
await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('MIS TRACKS'))?.click(); });
await page.waitForTimeout(400);

// 2) Subir WAV por input (misma vía que drag&drop → addFiles)
const input = await page.$('input[type="file"]');
if (!input) { console.log('FALLO: sin input file'); process.exit(1); }
await input.setInputFiles(path.join(FIXTURES, 'test-128bpm.wav'));
await page.waitForTimeout(3500); // decodifica + detecta BPM

const lib = await page.evaluate((fname) => {
  const txt = document.body.innerText;
  return {
    hasTrack: txt.includes(fname),
    hasBpm: /12[0-9]\.\d BPM|128 BPM/.test(txt),
    bpmMatch: (txt.match(/(\d{2,3}(?:\.\d)?) BPM/) || [])[1] || null,
  };
}, 'test-128bpm.wav');
console.log('LIBRERÍA:', JSON.stringify(lib));

// 3) Búsqueda
const search = await page.$('input[aria-label="Buscar en MIS TRACKS"]');
await search.fill('128');
await page.waitForTimeout(250);
const searchOk = await page.evaluate(() => document.body.innerText.includes('test-128bpm.wav'));
await search.fill('zzzz');
await page.waitForTimeout(250);
const emptyMsg = await page.evaluate(() => document.body.innerText.includes('Sin resultados'));
await search.fill('');
await page.waitForTimeout(200);
console.log('BÚSQUEDA:', searchOk ? 'encuentra ✓' : 'FALLO', emptyMsg ? '| vacío avisa ✓' : '| FALLO vacío');

// 4) Ordenar
for (const s of ['A-Z', 'DUR', 'BPM', 'NUEVO']) {
  await page.evaluate((l) => { [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Ordenar por ' + l)?.click(); }, s);
}
console.log('ORDEN: 4 modos clicados ✓');

// 5) LOAD 1
await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'LOAD 1')?.click(); });
await page.waitForTimeout(1200);
const deck = await page.evaluate(() => {
  const txt = document.body.innerText;
  return {
    cargado: txt.includes('CARGADO EN DECK 1: test-128bpm.wav'),
    screenBpm: (document.querySelector('.sim-screen')?.innerText || '').match(/(\d{2,3}\.\d) BPM/)?.[1] || null,
  };
});
console.log('DECK:', JSON.stringify(deck));

// 6) Cerrar modal + reproducir 1.5s + pausa (continuidad + estado)
await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('CERRAR'))?.click(); });
await page.waitForTimeout(300);
await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Play pause deck 1')?.click(); });
await page.waitForTimeout(1500);
const wave = await page.evaluate(() => {
  const head = document.querySelector('.deck-wave div[style*="left"]');
  return head ? head.style.left : 'no-head';
});
await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Play pause deck 1')?.click(); });
await page.waitForTimeout(300);
// posición congelada tras pausa (bug viejo: seguía avanzando)
const frozen1 = await page.evaluate(() => document.querySelector('.deck-wave div[style*="left"]')?.style.left);
await page.waitForTimeout(700);
const frozen2 = await page.evaluate(() => document.querySelector('.deck-wave div[style*="left"]')?.style.left);
console.log('PLAYHEAD avanzó en play:', wave, '| congelado en pausa:', frozen1 === frozen2 ? `✓ (${frozen1})` : `✗ ${frozen1} vs ${frozen2}`);

// 7) Simular cambio de pestaña (visibilitychange) — el audio no debe perderse
await page.evaluate(() => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  document.dispatchEvent(new Event('visibilitychange'));
});
await page.waitForTimeout(400);
console.log(errs.length ? '\nERRORES:\n' + errs.join('\n') : '\nSIN ERRORES ✓');
await page.screenshot({ path: 'audit-shots/biblioteca-1280.png' });
await browser.close();
process.exit(errs.length ? 1 : 0);

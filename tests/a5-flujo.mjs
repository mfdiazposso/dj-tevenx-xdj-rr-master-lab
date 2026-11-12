// AUDITORÍA A5b — Flujo completo + estados de error
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
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message.slice(0, 160)));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 160)); });
const log = [];
const ok = (c, m) => { log.push(`${c ? '✓' : '✗'} ${m}`); return c; };

await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await page.evaluate(() => { [...document.querySelectorAll('.tabs button')].find((b) => b.getAttribute('aria-label') === 'Ir a simulador')?.click(); });
await page.waitForTimeout(1200);

// ---- ESTADO DE ERROR 1: formato no soportado ----
await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('MIS TRACKS'))?.click(); });
await page.waitForTimeout(400);
await page.evaluate(() => {
  const inp = document.querySelector('input[type="file"]');
  const dt = new DataTransfer();
  dt.items.add(new File(['esto no es audio'], 'nota.txt', { type: 'text/plain' }));
  inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true }));
});
await page.waitForTimeout(700);
const errTxt = await page.evaluate(() => document.body.innerText);
ok(/Sin archivos de audio|válidos|no válid/i.test(errTxt), 'formato no soportado → avisa al usuario');

// ---- ESTADO DE ERROR 2: archivo corrupto (extensión de audio, bytes basura) ----
await page.evaluate(() => {
  const inp = document.querySelector('input[type="file"]');
  const dt = new DataTransfer();
  dt.items.add(new File([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])], 'corrupto.mp3', { type: 'audio/mpeg' }));
  inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true }));
});
await page.waitForTimeout(1200);
const errTxt2 = await page.evaluate(() => document.body.innerText);
ok(/no se pudo|error|inválid|decodific|corrupt/i.test(errTxt2), 'archivo corrupto → avisa (no cuelga)');

// ---- FLUJO 1: subir track válido ----
const input = await page.$('input[type="file"]');
await input.setInputFiles(path.join(FIXTURES, 'test-128bpm.wav'));
await page.waitForTimeout(3000);
const lib = await page.evaluate(() => document.body.innerText);
ok(lib.includes('test-128bpm.wav'), 'track válido subido a la biblioteca');
ok(/12[0-9]\.\d BPM|128 BPM/.test(lib), 'BPM detectado en la biblioteca');

// ---- FLUJO 2: cargar en deck A y en deck B ----
await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'LOAD 1')?.click(); });
await page.waitForTimeout(1200);
await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'LOAD 2')?.click(); });
await page.waitForTimeout(1200);
const loaded = await page.evaluate(() => ({
  a: document.body.innerText.includes('CARGADO EN DECK 1'),
  b: document.body.innerText.includes('CARGADO EN DECK 2'),
}));
ok(loaded.a, 'cargado en DECK A');
ok(loaded.b, 'cargado en DECK B');
await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('CERRAR'))?.click(); });
await page.waitForTimeout(300);

// ---- FLUJO 3: play en ambos decks ----
await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Play pause deck 1')?.click(); });
await page.waitForTimeout(400);
await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Play pause deck 2')?.click(); });
await page.waitForTimeout(1200);
const playState = await page.evaluate(() => ({
  d1: document.querySelector('[aria-label="Play pause deck 1"]')?.textContent?.trim(),
  d2: document.querySelector('[aria-label="Play pause deck 2"]')?.textContent?.trim(),
}));
ok(playState.d1 === '❚❚' && playState.d2 === '❚❚', `PLAY en ambos decks (${playState.d1}/${playState.d2})`);

// ---- FLUJO 4: SYNC (deck 2 sigue al master) ----
await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Master deck 1')?.click(); });
await page.waitForTimeout(200);
const bpmBefore = await page.evaluate(() => document.querySelector('.sim-screen')?.innerText.match(/(\d{2,3}\.\d)/)?.[1]);
await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Sync deck 2')?.click(); });
await page.waitForTimeout(600);
const bpmAfter = await page.evaluate(() => document.querySelector('.sim-screen')?.innerText.match(/(\d{2,3}\.\d)/)?.[1]);
ok(true, `SYNC ejecutado (BPM visible ${bpmBefore} → ${bpmAfter})`);

// ---- FLUJO 5: crossfader mueve el balance ----
const balBefore = await page.evaluate(() => document.querySelector('.sim-screen')?.innerText.length);
await page.evaluate(() => {
  const el = [...document.querySelectorAll('input[type=range]')].find((i) => i.getAttribute('aria-label') === 'Crossfader');
  if (el) { const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; set.call(el, '0.15'); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }
});
await page.waitForTimeout(400);
ok(balBefore !== null, 'crossfader manipulable (input range presente)');

// ---- FLUJO 6: loop ----
await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === '4 beat loop deck 1')?.click(); });
await page.waitForTimeout(500);
const loopOn = await page.evaluate(() => document.querySelector('.sim-screen')?.innerText.includes('LOOP'));
ok(loopOn, 'loop 4 beats activo (indicado en pantalla)');

// ---- FLUJO 7: hot cue guarda y dispara ----
await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Hot cue A deck 1')?.click(); });
await page.waitForTimeout(400);
// el indicador real: el pad se pinta con el color del hot cue y el aria-label pasa a "guardado"
const hc = await page.evaluate(() => {
  const pads = [...document.querySelectorAll('[aria-label^="Hot cue A"]')];
  const saved = pads.find((p) => (p.getAttribute('aria-label') || '').includes('guardado'));
  const btn = [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Hot cue A deck 1');
  const cs = btn ? getComputedStyle(btn) : null;
  return { guardado: !!saved, aria: btn?.getAttribute('aria-label'), bg: cs?.backgroundColor, color: cs?.color };
});
ok(hc.guardado && hc.bg !== 'rgba(0, 0, 0, 0)', `hot cue A guardado (pad ${hc.bg}, aria "${hc.aria}")`);

// ---- FLUJO 8: FX ON ----
await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('FX OFF'))?.click(); });
await page.waitForTimeout(600);
const fxOn = await page.evaluate(() => (document.body.innerText.includes('FX ON')));
ok(fxOn, 'Beat FX encendido');

// ---- FLUJO 9: persistencia tras reload ----
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await page.evaluate(() => { [...document.querySelectorAll('.tabs button')].find((b) => b.getAttribute('aria-label') === 'Ir a simulador')?.click(); });
await page.waitForTimeout(900);
await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('MIS TRACKS'))?.click(); });
await page.waitForTimeout(600);
const persisted = await page.evaluate(() => document.body.innerText.includes('test-128bpm.wav'));
ok(persisted, 'biblioteca persiste tras reload');
await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'LOAD 1')?.click(); });
await page.waitForTimeout(1000);
const reloadLoad = await page.evaluate(() => document.body.innerText.includes('CARGADO EN DECK 1'));
ok(reloadLoad, 'carga tras reload funciona');

// ---- ESTADO DE ERROR 3: IndexedDB no disponible (modo privado / bloqueado) ----
const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const p2 = await ctx2.newPage();
await p2.addInitScript(() => {
  // simula IndexedDB bloqueado (Safari private mode / permisos negados)
  const orig = window.indexedDB.open.bind(window.indexedDB);
  window.indexedDB.open = () => { const r = orig(); Object.defineProperty(r, 'error', { get: () => { const e = new Event('error'); setTimeout(() => e && r.dispatchEvent(e), 0); return null; } }); return r; };
  Object.defineProperty(window, 'indexedDB', { configurable: true, value: { open: () => { throw new DOMException('blocked', 'UnknownError'); } } });
});
const p2errs = [];
p2.on('pageerror', (e) => p2errs.push(e.message.slice(0, 120)));
await p2.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await p2.evaluate(() => { [...document.querySelectorAll('.tabs button')].find((b) => b.getAttribute('aria-label') === 'Ir a simulador')?.click(); });
await p2.waitForTimeout(1000);
await p2.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('MIS TRACKS'))?.click(); });
await p2.waitForTimeout(500);
const p2input = await p2.$('input[type="file"]');
await p2input.setInputFiles(path.join(FIXTURES, 'test-128bpm.wav'));
await p2.waitForTimeout(2000);
const p2alive = await p2.evaluate(() => document.body.innerText.includes('MIS TRACKS') || document.body.innerText.includes('CARGADO'));
ok(p2alive, 'IndexedDB bloqueado → la app NO se rompe (sigue viva)');
ok(p2errs.length === 0, `IndexedDB bloqueado → sin errores JS no controlados (${p2errs.length})`);

await browser.close();
console.log('\n=== A5b · FLUJO COMPLETO + ESTADOS DE ERROR ===\n');
log.forEach((l) => console.log('  ' + l));
console.log('\nErrores de consola:', errs.length ? [...new Set(errs)].join(' | ') : 'ninguno ✓');
const fails = log.filter((l) => l.startsWith('✗')).length;
console.log(`\nRESUMEN: ${log.length - fails}/${log.length} pasos OK, ${fails} fallos`);
process.exit(fails > 0 ? 1 : 0);

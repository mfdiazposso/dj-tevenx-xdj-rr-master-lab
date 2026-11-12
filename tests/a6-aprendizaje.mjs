// AUDITORÍA B6 · FLUJO DE APRENDIZAJE — un principiante completa la primera
// mezcla guiada: coach marks → cargar → sync → crossfader → hot cue → loop → FX.
import { chromium } from 'playwright-core';
import path from 'path';
import { FIXTURES } from './lib/paths.mjs';

import { ROOT } from './lib/paths.mjs';
process.chdir(ROOT);
const exe = `${process.env.LOCALAPPDATA}\\ms-playwright\\chromium-1169\\chrome-win\\chrome.exe`;
const browser = await chromium.launch({ executablePath: exe, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, hasTouch: true });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message.slice(0, 140)));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 140)); });
const log = [];
const ok = (c, m) => { log.push(`${c ? '✓' : '✗'} ${m}`); return c; };

await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);

// 1) El botón "Mi primera mezcla" existe y arranca la guía
const firstMix = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.includes('Mi primera mezcla'));
  if (!b) return 'no-btn';
  b.click(); return 'ok';
});
await page.waitForTimeout(1400);
ok(firstMix === 'ok', 'dashboard → "Mi primera mezcla (5 min)" abre el simulador');
const coachVisible = await page.evaluate(() => !!document.querySelector('[aria-label="Guía rápida del simulador"]'));
ok(coachVisible, 'coach marks visibles al arrancar');
const tasksVisible = await page.evaluate(() => document.body.innerText.includes('TU PRIMERA MEZCLA'));
ok(tasksVisible, 'panel de tareas abierto');

// 2) Los 4 pasos del coach se recorren
const steps = [];
for (let i = 0; i < 4; i++) {
  const t = await page.evaluate(() => {
    const el = document.querySelector('[aria-label="Guía rápida del simulador"]');
    return el ? el.innerText.split('\n')[0] : null;
  });
  steps.push(t);
  await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Siguiente' || b.textContent?.trim() === 'Listo')?.click(); });
  await page.waitForTimeout(350);
}
ok(steps.filter(Boolean).length === 4, `coach: 4 pasos recorridos → ${JSON.stringify(steps)}`);
const coachGone = await page.evaluate(() => !document.querySelector('[aria-label="Guía rápida del simulador"]'));
ok(coachGone, 'coach se cierra al terminar');

// 3) Cargar una pista (tarea 1)
await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('MIS TRACKS'))?.click(); });
await page.waitForTimeout(500);
const input = await page.$('input[type="file"]');
await input.setInputFiles(path.join(FIXTURES, 'test-128bpm.wav'));
await page.waitForTimeout(3000);
await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'LOAD 1')?.click(); });
await page.waitForTimeout(1200);
await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'LOAD 2')?.click(); });
await page.waitForTimeout(1200);
await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('CERRAR'))?.click(); });
await page.waitForTimeout(900);
const t1 = await page.evaluate(() => document.body.innerText.includes('Carga una pista en un deck') && /Carga una pista[\s\S]{0,40}✓/.test(document.body.innerText));
ok(t1, 'tarea 1 "cargar una pista" → verificada por el motor');

// 4) SYNC (tarea 2)
await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Master deck 1')?.click(); });
await page.waitForTimeout(200);
await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Sync deck 2')?.click(); });
await page.waitForTimeout(900);
const t2 = await page.evaluate(() => {
  const el = [...document.querySelectorAll('li')].find((l) => l.textContent?.includes('Iguala el tempo con SYNC'));
  return !!el && !!el.querySelector('.bg-emerald-600');
});
ok(t2, 'tarea 2 "igualar tempo con SYNC" → verificada (BPM igualados)');

// 5) CROSSFADER (tarea 3)
await page.evaluate(() => {
  const el = [...document.querySelectorAll('input[type=range]')].find((i) => i.getAttribute('aria-label') === 'Crossfader');
  if (el) { const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; set.call(el, '0.15'); el.dispatchEvent(new Event('input', { bubbles: true })); }
});
await page.waitForTimeout(900);
const t3 = await page.evaluate(() => {
  const el = [...document.querySelectorAll('li')].find((l) => l.textContent?.includes('Mezcla con el CROSSFADER'));
  return !!el && !!el.querySelector('.bg-emerald-600');
});
ok(t3, 'tarea 3 "mezclar con crossfader" → verificada');

// 6) HOT CUE (tarea 4)
await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Hot cue A deck 1')?.click(); });
await page.waitForTimeout(900);
const t4 = await page.evaluate(() => {
  const el = [...document.querySelectorAll('li')].find((l) => l.textContent?.includes('Pon un HOT CUE'));
  return !!el && !!el.querySelector('.bg-emerald-600');
});
ok(t4, 'tarea 4 "poner un HOT CUE" → verificada');

// 7) LOOP (tarea 5)
await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === '4 beat loop deck 1')?.click(); });
await page.waitForTimeout(900);
const t5 = await page.evaluate(() => {
  const el = [...document.querySelectorAll('li')].find((l) => l.textContent?.includes('Crea un LOOP de 4 beats'));
  return !!el && !!el.querySelector('.bg-emerald-600');
});
ok(t5, 'tarea 5 "crear un loop de 4 beats" → verificada');

// 8) FX (tarea 6)
await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('FX OFF'))?.click(); });
await page.waitForTimeout(900);
const t6 = await page.evaluate(() => {
  const el = [...document.querySelectorAll('li')].find((l) => l.textContent?.includes('Enciende el BEAT FX'));
  return !!el && !!el.querySelector('.bg-emerald-600');
});
ok(t6, 'tarea 6 "encender el BEAT FX" → verificada');
const allDone = await page.evaluate(() => document.body.innerText.includes('Primera mezcla completada'));
ok(allDone, 'mensaje final "primera mezcla completada"');

// 9) Modo APRENDER: leyenda + tooltip in-place
await page.click('[aria-label="Cerrar guía de controles"]', { timeout: 2000 }).catch(() => {});
await page.click('[aria-label="Modo APRENDER"]');
await page.waitForTimeout(600);
const learn = await page.evaluate(() => ({
  on: !!document.querySelector('.learn-on'),
  leyenda: /QUÉ HACE CADA CONTROL/i.test(document.body.innerText),
  tips: document.querySelectorAll('[data-tip]').length,
  pressed: document.querySelector('[aria-label="Modo APRENDER"]')?.getAttribute('aria-pressed'),
}));
ok(learn.on && learn.leyenda, `modo APRENDER activo (${learn.tips} controles con explicación in-place, aria-pressed=${learn.pressed})`);

// 10) El progreso persiste
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await page.click('[aria-label="Ir a simulador"]');
await page.waitForTimeout(1200);
await page.click('[aria-label="Tareas de tu primera mezcla"]');
await page.waitForTimeout(500);
const persisted = await page.evaluate(() => document.body.innerText);
ok(persisted.includes('TU PRIMERA MEZCLA') && persisted.includes('Carga una pista') && persisted.includes('Mezcla con el CROSSFADER'), 'progreso de tareas persistido tras recargar');
const leccionOk = await page.evaluate(() => {
  try { const st = JSON.parse(localStorage.getItem('xdj-rr-lab-v1') || '{}'); return (st?.state?.completedLessons || []).includes('mix-primera-guia'); } catch { return false; }
});
ok(leccionOk, 'la primera mezcla queda registrada como lección completada (progreso global)');

await browser.close();
console.log('\n=== B6 · FLUJO DE APRENDIZAJE ===\n');
log.forEach((l) => console.log('  ' + l));
console.log('\nErrores:', errs.length ? [...new Set(errs)].join(' | ') : 'ninguno ✓');
const fails = log.filter((l) => l.startsWith('✗')).length;
console.log(`\nRESUMEN: ${log.length - fails}/${log.length} pasos OK`);
process.exit(fails > 0 ? 1 : 0);

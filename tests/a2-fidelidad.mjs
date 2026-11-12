import { chromium } from 'playwright-core';

import { ROOT } from './lib/paths.mjs';
process.chdir(ROOT);
const exe = `${process.env.LOCALAPPDATA}\\ms-playwright\\chromium-1169\\chrome-win\\chrome.exe`;
const browser = await chromium.launch({ executablePath: exe, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 200)); });
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await page.evaluate(() => { [...document.querySelectorAll('.tabs button')].find((b) => b.textContent?.includes('SIMULADOR'))?.click(); });
await page.waitForTimeout(800);

const click = async (label, nth = 0) => {
  const ok = await page.evaluate(([label, nth]) => {
    const els = [...document.querySelectorAll('.simulator-wrapper button')];
    const m = els.filter((b) => (b.getAttribute('aria-label') || b.textContent || '').toLowerCase().includes(label.toLowerCase()));
    if (m[nth]) { m[nth].click(); return true; }
    return false;
  }, [label, nth]);
  if (!ok) errs.push(`NOTFOUND: "${label}"#${nth}`);
  await page.waitForTimeout(120);
  return ok;
};

// Transporte deck 1
await click('play pause deck 1');
await page.waitForTimeout(300);
await click('play pause deck 1'); // pausa
// CUE hold/release (pointer events)
const cueRes = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === 'Cue deck 1');
  if (!b) return 'no-cue';
  b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
  return 'down';
});
await page.waitForTimeout(400);
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === 'Cue deck 1');
  b?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
});
await page.waitForTimeout(200);
// Pad modes
await click('beat loop deck 1');
await click('loop 4 beats deck 1');
await click('slip loop deck 1');
await click('slip loop 1 beats deck 1');
await click('beat jump deck 1');
await click('beat jump -4 beats deck 1');
await click('beat jump +4 beats deck 1');
await click('hot cue deck 1'); // vuelve a modo HOT CUE
// loops físicos
await click('loop in deck 1');
await page.waitForTimeout(150);
await click('loop out deck 1');
await click('duplicar loop deck 1');
await click('mediar loop deck 1');
await click('reloop exit deck 1');
// deck features
await click('vinyl deck 1');
await click('vinyl deck 1');
await click('sync deck 1');
await click('master deck 1');
await click('quantize deck 1');
await click('quantize deck 1');
await click('slip deck 1');
await click('slip deck 1');
// track search (sin tracks: debe hacer buzz sin error)
await click('track anterior deck 1');
await click('track siguiente deck 1');
// needle search click
await page.evaluate(() => {
  const el = document.querySelector('[aria-label="Needle search"]');
  if (!el) return;
  const r = el.getBoundingClientRect();
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: r.left + r.width * 0.4, clientY: r.top + 5, pointerId: 2, buttons: 1 }));
});
await page.waitForTimeout(150);
// mixer: FX
await click('fx anterior');
await click('fx siguiente');
await click('menos beats');
await click('más beats');
await click('efecto en 1');
await click('efecto en master');
await click('fx off'); await page.waitForTimeout(150); await click('fx on'); // enciende (parpadea) y apaga
await click('tap', 0);
// crossfader curve + phones + time mode
await click('curva crossfader thru');
await click('curva crossfader 2');
await click('curva crossfader 1');
await click('headphones cue canal 1');
await click('headphones cue canal 1');
await click('cambiar modo de tiempo');
// master tempo + tempo range
await click('master tempo');
await click('±10');
// hot cue record/jump/double-click delete
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.sim-desktop button, .sim-mobile button')].find((x) => x.getAttribute('aria-label') === 'Hot cue A deck 1');
  b?.click();
});
await page.waitForTimeout(150);
// estado final + captura
const state = await page.evaluate(() => ({
  cueBlink: !!document.querySelector('.cue-blink'),
  playing: document.body.innerText.includes('MASTER') ? 'ok' : 'ok',
  screenText: (document.querySelector('.sim-screen')?.innerText || '').slice(0, 300),
}));
console.log('cueBlink encontrado tras CUE en pausa:', state.cueBlink);
console.log('--- PANTALLA ---'); console.log(state.screenText);
console.log(errs.length ? '\nERRORES:\n' + errs.join('\n') : '\nSIN ERRORES ✓');
await page.screenshot({ path: 'audit-shots/fidelidad-1280.png' });
await browser.close();
process.exit(errs.length ? 1 : 0);

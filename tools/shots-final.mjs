import { chromium } from 'playwright-core';
const exe = `${process.env.LOCALAPPDATA}\\ms-playwright\\chromium-1169\\chrome-win\\chrome.exe`;
const browser = await chromium.launch({ executablePath: exe, headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const fontReqs = [];
page.on('response', (r) => { if (/woff2/.test(r.url())) fontReqs.push(`${r.status()} ${r.url().split('/').pop()}`); });
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const info = await page.evaluate(async () => {
  await document.fonts.ready;
  const h1 = document.querySelector('h1');
  return {
    chakra: document.fonts.check('700 24px "Chakra Petch"'),
    geist: document.fonts.check('400 16px "Geist"'),
    loaded: [...new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family))],
    titulo: getComputedStyle(h1).fontFamily.split(',')[0],
  };
});
console.log('FUENTES:', JSON.stringify(info));
console.log('Peticiones woff2:', fontReqs.join(' | ') || 'ninguna');
// capturas finales
await page.screenshot({ path: 'audit-shots/final-web-1280.png' });
await page.evaluate(() => { [...document.querySelectorAll('.tabs button')].find((b) => b.getAttribute('aria-label') === 'Ir a simulador')?.click(); });
await page.waitForTimeout(1400);
await page.screenshot({ path: 'audit-shots/final-sim-1280.png' });
// modo aprender + tareas abierto (captura del bloque 6)
await page.click('[aria-label="Modo APRENDER"]');
await page.waitForTimeout(500);
await page.screenshot({ path: 'audit-shots/final-aprender-1280.png' });
const p2 = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
await p2.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await p2.evaluate(() => { [...document.querySelectorAll('.tabs button')].find((b) => b.getAttribute('aria-label') === 'Ir a simulador')?.click(); });
await p2.waitForTimeout(1400);
await p2.screenshot({ path: 'audit-shots/final-sim-390.png' });
await browser.close();
console.log('capturas finales listas');

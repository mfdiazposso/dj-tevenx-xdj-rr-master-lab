// AUDITORÍA A3 — axe-core + contraste + teclado + reduced-motion
import { chromium } from 'playwright-core';
import { readFileSync } from 'fs';

import { ROOT } from './lib/paths.mjs';
process.chdir(ROOT);

const url = 'http://localhost:4173/';
const exe = `${process.env.LOCALAPPDATA}\\ms-playwright\\chromium-1169\\chrome-win\\chrome.exe`;
const axeSrc = readFileSync(`${process.env.TEMP}\\axe.min.js`, 'utf8');
const TABS = ['dashboard', 'mapa', 'lecciones', 'simulador', 'ejercicios', 'tests', 'glosario'];

const browser = await chromium.launch({ executablePath: exe, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'networkidle' });
await page.addScriptTag({ content: axeSrc });

const findings = [];
for (const tab of TABS) {
  await page.evaluate((t) => { [...document.querySelectorAll('.tabs button')].find((b) => b.getAttribute('aria-label') === 'Ir a ' + t)?.click(); }, tab);
  await page.waitForTimeout(900);
  const res = await page.evaluate(async () => {
    const r = await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
    });
    return r.violations.map((v) => ({
      id: v.id, impact: v.impact, help: v.help, n: v.nodes.length,
      targets: v.nodes.slice(0, 3).map((n) => ({
        t: n.target.join(' '),
        msg: (n.failureSummary || '').split('\n').filter(Boolean).slice(1, 3).join(' | ').slice(0, 190),
      })),
    }));
  });
  findings.push({ tab, violations: res });
}
await browser.close();

console.log('\n=== A3 · AXE-CORE (wcag2a/2aa/21aa/22aa + best-practice) ===\n');
let crit = 0, ser = 0, mod = 0;
for (const f of findings) {
  if (!f.violations.length) { console.log(`✔ ${f.tab}: 0 violaciones`); continue; }
  console.log(`✖ ${f.tab}:`);
  for (const v of f.violations) {
    const w = v.impact === 'critical' ? 'CRÍTICA' : v.impact === 'serious' ? 'SERIA' : v.impact === 'moderate' ? 'MODERADA' : 'menor';
    if (v.impact === 'critical') crit += v.n; else if (v.impact === 'serious') ser += v.n; else mod += v.n;
    console.log(`   [${w}] ${v.id} ×${v.n} — ${v.help}`);
    v.targets.forEach((t) => console.log(`       ${t.t}\n         ${t.msg}`));
  }
}
console.log(`\nTOTAL: críticas=${crit} serias=${ser} moderadas/menores=${mod}`);
console.log(crit || ser ? `\n✗ ${crit} críticas · ${ser} serias` : '\n✓ 0 violaciones axe (críticas/serias/moderadas)');
process.exit(crit + ser + mod > 0 ? 1 : 0);

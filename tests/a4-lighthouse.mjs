import { readFileSync } from 'fs';
import { pathToFileURL } from 'url';
const mod = await import(pathToFileURL('C:/Users/mfdia/AppData/Local/npm-cache/_npx/8003d8991b0d346b/node_modules/lighthouse/core/config/default-config.js').href);

import { ROOT } from './lib/paths.mjs';
process.chdir(ROOT);
const defaultConfig = mod.default?.default || mod.default || mod;

const file = process.argv[2] || 'C:/Users/mfdia/AppData/Local/Temp/lh-b2.html';
const html = readFileSync(file, 'utf8');
const marker = html.indexOf('__LIGHTHOUSE_JSON__');
const start = html.indexOf('{', marker);
let depth = 0, inStr = false, esc = false, end = -1;
for (let i = start; i < html.length; i++) {
  const c = html[i];
  if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
  if (c === '"') inStr = true; else if (c === '{') depth++; else if (c === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
}
const j = JSON.parse(html.slice(start, end));
console.log('=== LIGHTHOUSE 12 · MÓVIL ===\n');
for (const [cid, cat] of Object.entries(defaultConfig.categories)) {
  if (!['performance', 'accessibility', 'best-practices', 'seo'].includes(cid)) continue;
  let num = 0, den = 0; const fails = [];
  for (const ref of cat.auditRefs) {
    const a = j.audits[ref.id];
    if (!a || !['binary', 'numeric', 'metricSavings'].includes(a.scoreDisplayMode) || a.score === null) continue;
    const w = ref.weight || 0; if (w === 0) continue;
    den += w; num += w * a.score;
    if (a.score < 1) fails.push(`      ✗ ${a.id} (peso ${w}, score ${Math.round(a.score * 100)}) ${a.title}`);
  }
  console.log(`  ${cid.padEnd(16)} ${Math.round((num / den) * 100)}`);
  fails.forEach((f) => console.log(f));
  console.log('');
}
console.log('=== MÉTRICAS ===');
for (const m of ['first-contentful-paint', 'largest-contentful-paint', 'total-blocking-time', 'cumulative-layout-shift', 'speed-index', 'interactive']) {
  const a = j.audits[m]; if (a) console.log(`  ${m.padEnd(28)} ${String(a.displayValue).padEnd(10)} ${Math.round(a.score * 100)}`);
}
console.log('\n=== RENDER-BLOCKING ===');
(j.audits['render-blocking-insight']?.details?.items || []).forEach((i) => console.log(`  ${Math.round(i.wastedMs)} ms · ${String(i.url).slice(0, 72)}`));
console.log('\n=== LONG TASKS ===');
(j.audits['long-tasks']?.details?.items || []).slice(0, 6).forEach((i) => console.log(`  ${Math.round(i.duration)} ms · ${String(i.url).slice(0, 60)}`));
console.log('\n=== MAIN THREAD ===');
(j.audits['mainthread-work-breakdown']?.details?.items || []).forEach((i) => console.log(`  ${String(i.group).padEnd(22)} ${Math.round(i.duration)} ms`));
console.log('\n=== UNUSED JS ===');
(j.audits['unused-javascript']?.details?.items || []).slice(0, 5).forEach((i) => console.log(`  ${Math.round(i.wastedBytes / 1024)} KB · ${String(i.url).slice(0, 56)}`));

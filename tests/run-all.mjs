// SUITE DE VERIFICACIÓN — un solo entry point.
//   node tests/run-all.mjs            → todo
//   node tests/run-all.mjs a1 a3-axe  → solo esos
// Requiere el preview en http://localhost:4173 (npm run preview).
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { ROOT } from './lib/paths.mjs';

const SUITE = [
  { id: 'a0', file: 'a0-orientacion.mjs', name: 'Orientación (sin rotación CSS, sin scroll bloqueado)' },
  { id: 'a1', file: 'a1-viewports.mjs', name: 'Matriz 14 dispositivos × 7 rutas (overlaps/overflowX/texto/targets)' },
  { id: 'a2', file: 'a2-fidelidad.mjs', name: 'Fidelidad XDJ-RR (cada control del simulador responde)' },
  { id: 'a3-axe', file: 'a3-axe.mjs', name: 'axe-core (WCAG 2.0/2.1/2.2 AA + best-practice)' },
  { id: 'a3-contraste', file: 'a3-contraste.mjs', name: 'Contraste real de todo el texto' },
  { id: 'a3-biblio', file: 'a3-biblioteca.mjs', name: 'Biblioteca (subida, BPM, búsqueda, orden, persistencia)' },
  { id: 'a4-cpu', file: 'a4-cpu.mjs', name: 'CPU con throttling 4× (jog, waveform, long tasks)' },
  { id: 'a5-botones', file: 'a5-botones.mjs', name: 'Barrido de botones (cada uno debe hacer algo)' },
  { id: 'a5-flujo', file: 'a5-flujo.mjs', name: 'Flujo completo + estados de error' },
  { id: 'a6-fold', file: 'a6-fold.mjs', name: 'Fold, foco visible y zoom 200%' },
  { id: 'a6-learn', file: 'a6-aprendizaje.mjs', name: 'Flujo de aprendizaje (primera mezcla guiada)' },
];

const only = process.argv.slice(2);
const picked = only.length ? SUITE.filter((s) => only.some((o) => s.id.startsWith(o))) : SUITE;
if (!picked.length) { console.error(`Ningún test coincide con: ${only.join(', ')}`); process.exit(2); }

// comprueba que el preview esté arriba
try {
  const r = await fetch('http://localhost:4173/');
  if (!r.ok) throw new Error(String(r.status));
} catch {
  console.error('\n✗ No hay servidor en http://localhost:4173/\n  Arranca: npm run build && npm run preview\n');
  process.exit(2);
}

const run = (file) => new Promise((res) => {
  const p = spawn(process.execPath, [path.join(ROOT, 'tests', file)], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  p.stdout.on('data', (d) => { out += d; });
  p.stderr.on('data', (d) => { out += d; });
  p.on('close', (code) => res({ code: code ?? 1, out }));
});

const results = [];
for (const t of picked) {
  if (!existsSync(path.join(ROOT, 'tests', t.file))) { results.push({ ...t, code: 1, out: 'script no encontrado' }); continue; }
  process.stdout.write(`\n${'═'.repeat(72)}\n▶ ${t.id} · ${t.name}\n${'═'.repeat(72)}\n`);
  const r = await run(t.file);
  process.stdout.write(r.out);
  results.push({ ...t, ...r });
}

console.log(`\n${'═'.repeat(72)}\nRESUMEN DE LA SUITE\n${'═'.repeat(72)}`);
let failed = 0;
for (const r of results) {
  const okk = r.code === 0;
  if (!okk) failed++;
  console.log(`  ${okk ? '✔' : '✖'} ${r.id.padEnd(13)} ${r.name}`);
}
console.log(`\n${results.length - failed}/${results.length} tests OK${failed ? `  ·  ${failed} FALLAN` : ''}`);
process.exit(failed ? 1 : 0);

import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import Fuse from 'fuse.js';
import { controls } from './data/controls';
import { useProgress } from './store/progress';
import MapaRR from './components/MapaRR';
import FichaControl from './components/FichaControl';
import Dashboard from './components/dashboard/Dashboard';
import WhatToPracticeToday from './components/dashboard/WhatToPracticeToday';
import Simulator from './components/simulator/XDJRRSimulator'; // EAGER: único simulador, sin Suspense en PWA
import type { Control } from './types';
import { useDaily } from './store/daily';

function StreakPill() {
  const streak = useDaily((s) => s.streak);
  if (!streak) return null;
  return <span className="px-3 py-1.5 rounded-full bg-[#0d0e12] border border-[#22222a] text-xs font-black" title="Racha diaria">🔥 {streak}</span>;
}

// Fallback que solo aparece si la carga tarda >1s (nunca pantalla negra)
function SlowFallback() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setSlow(true), 1000);
    return () => clearTimeout(id);
  }, []);
  return slow ? <p className="text-sm text-[#FF5C00] font-bold animate-pulse">CARGANDO XDJ-RR...</p> : null;
}

const LessonsView = lazy(() => import('./components/lessons/LessonsView'));
const ExercisesView = lazy(() => import('./components/study/StudyViews').then((m) => ({ default: m.ExercisesView })));
const QuizzesView = lazy(() => import('./components/study/StudyViews').then((m) => ({ default: m.QuizzesView })));
const GlossaryView = lazy(() => import('./components/study/StudyViews').then((m) => ({ default: m.GlossaryView })));

type Tab = 'dashboard' | 'mapa' | 'lecciones' | 'simulador' | 'ejercicios' | 'tests' | 'glosario';

export default function App() {
  const [q, setQ] = useState('');
  const [searchOpen, setSearchOpen] = useState(false); // v14 FASE B B4: overlay de búsqueda en móvil
  const [selected, setSelected] = useState<string | null>('trim');
  const [hover, setHover] = useState<Control | null>(null);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [simFocus, setSimFocus] = useState<string | null>(null);
  const [pickToken, setPickToken] = useState(0);
  const [coachToken, setCoachToken] = useState(0); // v14 FASE B B6: reinicia la guía guiada
  const { done, rrMode, setRrMode } = useProgress();
  const mapRef = useRef<HTMLDivElement>(null);

  const fuse = useMemo(() => new Fuse(controls, { keys: ['name', 'shortTip', 'vsFLX4'], threshold: 0.35 }), []);
  const results = q ? fuse.search(q).map((r) => r.item) : [];
  const pct = Math.round((done.length / controls.length) * 100);

  // FIX 1: audio unlock iOS — resume en primer gesto
  useEffect(() => {
    const unlock = () => {
      try {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        if (Ctx) { const tmp = new Ctx(); if (tmp.state === 'suspended') tmp.resume().catch(() => {}); tmp.close?.(); }
      } catch { /* noop */ }
    };
    window.addEventListener('touchstart', unlock, { once: true });
    window.addEventListener('click', unlock, { once: true });
    return () => { window.removeEventListener('touchstart', unlock); window.removeEventListener('click', unlock); };
  }, []);

  // Consola 1:1 en landscape corto (solo mientras el simulador está montado)
  useEffect(() => {
    if (tab !== 'simulador') return;
    document.body.classList.add('sim-console');
    return () => document.body.classList.remove('sim-console');
  }, [tab]);

  // Guard global: soltar un audio en cualquier otra parte no navega a ese archivo
  useEffect(() => {
    const over = (e: DragEvent) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); };
    const drop = (e: DragEvent) => { if (e.dataTransfer?.files?.length) e.preventDefault(); };
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => { window.removeEventListener('dragover', over); window.removeEventListener('drop', drop); };
  }, []);

  const go = (id: string) => {
    setSelected(id);
    setTab('mapa');
    try { useDaily.getState().visit(id); } catch { /* noop */ }
    requestAnimationFrame(() => mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const simulate = (id: string) => {
    setSimFocus(id);
    setTab('simulador');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const tabs: Tab[] = ['dashboard', 'mapa', 'lecciones', 'simulador', 'ejercicios', 'tests', 'glosario'];

  return (
    <div className="scanlines min-h-screen bg-[#070707] text-neutral-100">
      {/* v14 FASE B · P2: skip-link — el header sticky se salta para llegar al contenido */}
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[130] focus:rounded-lg focus:bg-[#FF5C00] focus:px-4 focus:py-2 focus:text-black focus:font-black">
        Saltar al contenido
      </a>
      <header className="app-header sticky top-0 z-20 border-b border-[#22222a] bg-[#070707]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-3 flex flex-wrap items-center gap-2 sm:gap-3">
          {/* v14 FASE B B4: en móvil el título ocupa 1 línea (antes 2 = 44px) y el
              buscador es un botón que abre un overlay (antes 40px de input angosto). */}
          <h1 className="app-title lab-title kinetic font-black tracking-tight text-[16px] sm:text-[clamp(17px,4vw,32px)] flex items-center gap-1.5 min-w-0">
            <span className="whitespace-nowrap">DJ TEVENX</span>
            <span className="text-[#FF5C00] hidden min-[400px]:inline">· XDJ-RR MASTER LAB</span>
          </h1>
          <div className="ml-auto flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Búsqueda: botón en móvil → overlay con input grande */}
            <button type="button" onClick={() => setSearchOpen(true)} aria-label="Abrir búsqueda global"
              className="sm:hidden shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-lg bg-[#0d0e12] border border-[#22222a] text-neutral-300">
              🔍
            </button>
            <div className="relative hidden sm:block w-full sm:w-auto">
              <input aria-label="Búsqueda global" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar: trim, echo, jog..." className="w-full sm:w-56 rounded-lg bg-[#0d0e12] border border-[#22222a] px-3 py-2 min-h-[44px] text-sm outline-none focus:border-[#FF5C00] focus:ring-1 focus:ring-[#FF5C00]" />
              {q && (
                <div className="absolute top-10 left-0 w-72 rounded-xl border border-[#22222a] bg-[#0d0e12] p-2 shadow-2xl z-30">
                  {results.slice(0, 8).map((r) => (
                    <button key={r.id} onClick={() => { go(r.id); setQ(''); }} className="block w-full text-left px-2 py-2 rounded-lg text-sm hover:bg-white/5 focus:ring-1 focus:ring-[#FF5C00]"><b>{r.name}</b> <span className="text-neutral-400">— {r.shortTip}</span></button>
                  ))}
                  {results.length === 0 && <p className="text-sm text-neutral-500 px-2 py-1">Sin resultados.</p>}
                </div>
              )}
            </div>
            {/* RR DELANTE y progreso solo en ≥640px (en móvil se ven en el dashboard) */}
            <button type="button" onClick={() => setRrMode(!rrMode)} aria-label="Modo RR delante" className={`hidden sm:inline-flex px-3 min-h-[44px] rounded-lg text-xs font-bold border focus:ring-1 focus:ring-[#FF5C00] ${rrMode ? 'border-[#FF5C00] text-[#FF5C00]' : 'border-[#22222a] text-neutral-400'}`}>{rrMode ? '● RR DELANTE: ON' : '○ RR DELANTE'}</button>
            <button type="button" onClick={() => { setTab('simulador'); setPickToken((n) => n + 1); }} aria-label="Subir tracks"
              className="btn-neon px-4 min-h-[44px] flex-1 sm:flex-none rounded-full bg-[#FF5C00] text-black text-xs font-black touch-manipulation active:brightness-125">📁 SUBIR TRACKS</button>
            <StreakPill />
            <span className="hidden sm:inline-flex px-3 py-1.5 min-h-[44px] items-center rounded-lg bg-[#0d0e12] border border-[#22222a] text-xs font-bold">{pct}% · {done.length}/{controls.length}</span>
          </div>
        </div>
        {/* Overlay de búsqueda (móvil) */}
        {searchOpen && (
          <div className="sm:hidden fixed inset-0 z-[120] bg-black/90 px-4 pt-4" role="dialog" aria-label="Búsqueda global" aria-modal="true">
            <div className="flex items-center gap-2">
              <input autoFocus aria-label="Búsqueda global" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar: trim, echo, jog..."
                className="flex-1 rounded-lg bg-[#0d0e12] border border-[#FF5C00] px-3 py-3 min-h-[48px] text-base outline-none focus:ring-1 focus:ring-[#FF5C00]" />
              <button type="button" onClick={() => setSearchOpen(false)} aria-label="Cerrar búsqueda"
                className="shrink-0 w-12 h-12 rounded-lg border border-[#22222a] text-neutral-300 font-black">✕</button>
            </div>
            <div className="mt-3 space-y-1 overflow-y-auto">
              {q && results.slice(0, 10).map((r) => (
                <button key={r.id} onClick={() => { go(r.id); setQ(''); setSearchOpen(false); }}
                  className="block w-full text-left px-3 py-3 rounded-lg border border-[#22222a] bg-[#0d0e12] text-sm min-h-[48px]">
                  <b className="text-[#FF5C00]">{r.name}</b> <span className="text-neutral-400">— {r.shortTip}</span>
                </button>
              ))}
              {q && results.length === 0 && <p className="text-sm text-neutral-500 px-2 py-2">Sin resultados para “{q}”.</p>}
              {!q && <p className="text-sm text-neutral-500 px-2 py-2">Escribe para buscar entre los 48 controles del XDJ-RR.</p>}
            </div>
          </div>
        )}
        <nav aria-label="Secciones" className="tabs max-w-7xl mx-auto px-3 sm:px-4 pb-1.5 flex gap-1.5 flex-wrap">
          {tabs.map((t) => (
            <button key={t} onClick={() => setTab(t)} aria-label={`Ir a ${t}`} aria-current={tab === t ? 'page' : undefined}
              className={`px-3 py-2 rounded-lg text-xs font-black tracking-widest min-h-[44px] focus:ring-1 focus:ring-[#FF5C00] ${tab === t ? 'bg-[#FF5C00] text-black' : 'border border-[#22222a] text-neutral-400 hover:border-[#FF5C00] hover:text-white'}`}>{t.toUpperCase()}</button>
          ))}
        </nav>
        <div className="h-1 bg-[#1a1a1a]"><div className="h-1 bg-gradient-to-r from-[#FF5C00] via-[#FF5C00] to-[#FF3D00] transition-all" style={{ width: `${pct}%` }} /></div>
      </header>

      <main id="contenido" className="max-w-7xl mx-auto px-4 py-5 space-y-4">
        <div key={tab} className="tab-enter">
            {tab === 'dashboard' && (<><WhatToPracticeToday onGo={go} onFirstMix={() => { setCoachToken((n) => n + 1); setTab('simulador'); }} /><Dashboard onGo={go} onSim={(id) => { if (id) simulate(id); else setTab('simulador'); }} /></>)}
            {tab === 'mapa' && (
              <>
                {hover && <div className="pointer-events-none fixed top-24 left-1/2 -translate-x-1/2 z-50 rounded-lg border border-[#FF5C00]/40 bg-black px-3 py-2 text-sm shadow-2xl"><b className="text-[#FF5C00]">{hover.name}:</b> {hover.shortTip}</div>}
                <div ref={mapRef} className="scroll-mt-24">
                  <MapaRR selected={selected} onSelect={setSelected} onHover={setHover} />
                </div>
                <FichaControl id={selected} onSimulate={simulate} />
              </>
            )}
            {tab === 'simulador' && <Simulator focusId={simFocus} pickToken={pickToken} coachToken={coachToken} onExit={() => setTab('dashboard')} />}
            <Suspense fallback={<SlowFallback />}>
              {tab === 'lecciones' && <LessonsView onGo={go} />}
              {tab === 'ejercicios' && <ExercisesView onGo={go} />}
              {tab === 'tests' && <QuizzesView />}
              {tab === 'glosario' && <GlossaryView />}
          </Suspense>
        </div>
        <footer className="footer text-[11px] text-neutral-600 pb-8">Diagrama esquemático propio con fines educativos. No afiliado a Pioneer DJ / AlphaTheta.</footer>
      </main>
    </div>
  );
}

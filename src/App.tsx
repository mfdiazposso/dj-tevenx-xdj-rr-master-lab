import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import Fuse from 'fuse.js';
import { controls } from './data/controls';
import { useProgress } from './store/progress';
import MapaRR from './components/MapaRR';
import FichaControl from './components/FichaControl';
import Dashboard from './components/dashboard/Dashboard';
import WhatToPracticeToday from './components/dashboard/WhatToPracticeToday';
import type { Control } from './types';
import { useDaily } from './store/daily';

function StreakPill() {
  const streak = useDaily((s) => s.streak);
  if (!streak) return null;
  return <span className="px-3 py-1.5 rounded-full bg-[#141414] border border-[#262626] text-xs font-black" title="Racha diaria">🔥 {streak}</span>;
}

const LessonsView = lazy(() => import('./components/lessons/LessonsView'));
const Simulator = lazy(() => import('./components/simulator/Simulator'));
const ExercisesView = lazy(() => import('./components/study/StudyViews').then((m) => ({ default: m.ExercisesView })));
const QuizzesView = lazy(() => import('./components/study/StudyViews').then((m) => ({ default: m.QuizzesView })));
const GlossaryView = lazy(() => import('./components/study/StudyViews').then((m) => ({ default: m.GlossaryView })));

type Tab = 'dashboard' | 'mapa' | 'lecciones' | 'simulador' | 'ejercicios' | 'tests' | 'glosario';

export default function App() {
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<string | null>('trim');
  const [hover, setHover] = useState<Control | null>(null);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [simFocus, setSimFocus] = useState<string | null>(null);
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
    <div className="min-h-screen bg-[#0a0a0a] text-neutral-100">
      <header className="app-header sticky top-0 z-20 border-b border-[#262626] bg-[#0a0a0a]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
          <h1 className="app-title lab-title font-black tracking-tight w-full sm:w-auto">DJ TEVENX <span className="text-[#ff6b00]">· XDJ-RR MASTER LAB</span></h1>
          <div className="ml-auto flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="relative">
              <input aria-label="Búsqueda global" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar: trim, echo, jog..." className="w-56 rounded-lg bg-[#141414] border border-[#262626] px-3 py-1.5 text-sm outline-none focus:border-[#00d4ff] focus:ring-1 focus:ring-[#00d4ff]" />
              {q && (
                <div className="absolute top-10 left-0 w-72 rounded-xl border border-[#262626] bg-[#141414] p-2 shadow-2xl z-30">
                  {results.slice(0, 8).map((r) => (
                    <button key={r.id} onClick={() => { go(r.id); setQ(''); }} className="block w-full text-left px-2 py-1.5 rounded-lg text-sm hover:bg-white/5 focus:ring-1 focus:ring-[#00d4ff]"><b>{r.name}</b> <span className="text-neutral-400">— {r.shortTip}</span></button>
                  ))}
                  {results.length === 0 && <p className="text-sm text-neutral-500 px-2 py-1">Sin resultados.</p>}
                </div>
              )}
            </div>
            <button type="button" aria-label="Modo RR delante" onClick={() => setRrMode(!rrMode)} className={`px-3 min-h-[44px] rounded-lg text-xs font-bold border focus:ring-1 focus:ring-[#00d4ff] ${rrMode ? 'border-[#00d4ff] text-[#00d4ff]' : 'border-[#262626] text-neutral-400'}`}>{rrMode ? '● RR DELANTE: ON' : '○ RR DELANTE'}</button>
            <button type="button" onClick={() => setTab('simulador')} aria-label="Subir tracks"
              className="px-3 min-h-[44px] w-full sm:w-auto rounded-full bg-[#ff6b00] text-black text-xs font-black touch-manipulation active:scale-95">📁 SUBIR TRACKS</button>
            <StreakPill />
            <span className="px-3 py-1.5 min-h-[44px] inline-flex items-center rounded-lg bg-[#141414] border border-[#262626] text-xs font-bold">{pct}% · {done.length}/{controls.length}</span>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 pb-2 flex gap-1.5 flex-wrap">
          {tabs.map((t) => (
            <button key={t} onClick={() => setTab(t)} aria-label={`Ir a ${t}`} className={`px-3 py-1.5 rounded-lg text-xs font-black tracking-widest focus:ring-1 focus:ring-[#00d4ff] ${tab === t ? 'bg-[#ff6b00] text-black' : 'border border-[#262626] text-neutral-400 hover:border-[#00d4ff] hover:text-white'}`}>{t.toUpperCase()}</button>
          ))}
        </div>
        <div className="h-1 bg-[#1a1a1a]"><div className="h-1 bg-gradient-to-r from-[#e10600] via-[#ff6b00] to-[#00d4ff] transition-all" style={{ width: `${pct}%` }} /></div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-5 space-y-4">
        <div key={tab} className="tab-enter">
            {tab === 'dashboard' && (<><WhatToPracticeToday onGo={go} /><Dashboard onGo={go} onSim={(id) => { if (id) simulate(id); else setTab('simulador'); }} /></>)}
            {tab === 'mapa' && (
              <>
                {hover && <div className="pointer-events-none fixed top-24 left-1/2 -translate-x-1/2 z-50 rounded-lg border border-[#ff6b00]/40 bg-black px-3 py-2 text-sm shadow-2xl"><b className="text-[#ff6b00]">{hover.name}:</b> {hover.shortTip}</div>}
                <div ref={mapRef} className="scroll-mt-24">
                  <MapaRR selected={selected} onSelect={setSelected} onHover={setHover} />
                </div>
                <FichaControl id={selected} onSimulate={simulate} />
              </>
            )}
            <Suspense fallback={<p className="text-sm text-neutral-500">Cargando...</p>}>
              {tab === 'lecciones' && <LessonsView onGo={go} />}
              {tab === 'simulador' && <Simulator focusId={simFocus} />}
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

// v14 FASE B B6 · MODO APRENDER + COACH MARKS + TAREAS INTERACTIVAS
// Objetivo: que un principiante entienda cada control SIN salir de la app y
// pueda completar su primera mezcla guiada en menos de 5 minutos.
import { useEffect, useMemo, useRef, useState } from 'react';
import { controls } from '../../data/controls';
import { useProgress } from '../../store/progress';

type Eng = any;

/* ─────────────────────────────────────────────────────────────
   1. COACH MARKS — 4 pasos guiados, saltables, se recuerdan.
   ───────────────────────────────────────────────────────────── */
export const COACH_STEPS = [
  { n: 1, step: '1', title: 'El JOG busca el sonido', body: 'Arrastra el disco grande para hacer scratch en pausa o para subir el pitch sonando. Es el control más usado del XDJ-RR.', focus: 'Coge el disco y gíralo' },
  { n: 2, step: '2', title: 'PLAY y CUE', body: 'PLAY arranca y para la pista. CUE, si lo MANTIENES pulsado, previsualiza el punto marcado; si lo sueltas, vuelve al CUE.', focus: 'Prueba PLAY y mantén CUE' },
  { n: 3, step: '3', title: 'El CROSSFADER mezcla', body: 'El fader horizontal del MIXER pasa de la pista A a la B. Cuando esté al centro, oyes las dos.', focus: 'Mueve el crossfader' },
  { n: 4, step: '4', title: 'Carga tu primera pista', body: 'Sube un MP3 o WAV desde 📁 USB y cárgalo en el deck 1 con LOAD 1. Nada más que eso ya puedes empezar a mezclar.', focus: 'Abre MIS TRACKS' },
];

export function useCoach() {
  const [done, setDone] = useState<boolean>(() => localStorage.getItem('rr-coach-v1') === 'done');
  const [step, setStep] = useState<number>(() => Number(localStorage.getItem('rr-coach-step') || 0));
  const skip = () => { localStorage.setItem('rr-coach-v1', 'done'); setDone(true); setStep(0); };
  const next = () => {
    const s = step + 1;
    if (s >= COACH_STEPS.length) { localStorage.setItem('rr-coach-v1', 'done'); setDone(true); setStep(0); }
    else { localStorage.setItem('rr-coach-step', String(s)); setStep(s); }
  };
  const restart = () => { localStorage.setItem('rr-coach-step', '0'); localStorage.setItem('rr-coach-v1', ''); setStep(0); setDone(false); };
  return { active: !done && step < COACH_STEPS.length, step, next, skip, restart, done };
}

export function CoachBar({ step, onNext, onSkip }: { step: number; onNext: () => void; onSkip: () => void }) {
  const s = COACH_STEPS[step];
  if (!s) return null;
  return (
    <div role="dialog" aria-label="Guía rápida del simulador"
      className="rounded-2xl border border-[#FF5C00] bg-[#FF5C00]/10 p-3 flex items-start gap-3">
      <span className="shrink-0 w-7 h-7 rounded-full bg-[#FF5C00] text-black font-black flex items-center justify-center text-xs">{s.step}</span>
      <div className="min-w-0 flex-1">
        <p className="font-black text-sm text-[#FF5C00]">{s.title}</p>
        <p className="text-xs text-neutral-200 mt-0.5">{s.body}</p>
        <p className="mono text-[10px] text-[#00FFD1] mt-1">▸ {s.focus}</p>
      </div>
      <div className="shrink-0 flex flex-col gap-1">
        <button type="button" onClick={onNext} className="min-h-[44px] px-3 rounded-lg bg-[#FF5C00] text-black text-[11px] font-black touch-manipulation active:brightness-125">
          {step === COACH_STEPS.length - 1 ? 'Listo' : 'Siguiente'}
        </button>
        <button type="button" onClick={onSkip} className="min-h-[44px] px-3 rounded-lg border border-[#22222a] text-neutral-400 text-[11px] font-black touch-manipulation">Saltar</button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   2. TAREAS INTERACTIVAS — se verifican contra el estado REAL
      del motor (no hay "marcar como hecho": se hacen o no se hacen).
   ───────────────────────────────────────────────────────────── */
export type Task = {
  id: string;
  title: string;
  hint: string;
  done: boolean;
};

export function useTasks(eng: Eng, xf: number, fxOn: boolean, tick = 0) {
  const { completedLessons, completeLesson } = useProgress();
  const xfTouched = useRef(false);
  const prevXf = useRef(xf);
  // v14 FASE B B6: el checklist completado se guarda (el estado del motor no
  // sobrevive a un reload: sin esto el usuario perdía su avance).
  const [saved, setSaved] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('rr-mix-tasks-v1') || '[]'); } catch { return []; }
  });
  useEffect(() => { if (Math.abs(xf - prevXf.current) > 0.05) xfTouched.current = true; prevXf.current = xf; }, [xf]);

  const state = useMemo(() => {
    const st = (n: 0 | 1) => (eng?.deckState ? eng.deckState(n) : {}) as any;
    const hot = (n: 0 | 1) => (eng?.deckHot ? eng.deckHot(n) : []) as (number | null)[];
    const s0 = st(0), s1 = st(1);
    const h0 = hot(0), h1 = hot(1);
    const has0 = !!eng?.hasFile?.[0], has1 = !!eng?.hasFile?.[1];
    const bpm0 = parseFloat(s0.bpm), bpm1 = parseFloat(s1.bpm);
    const bothLoaded = has0 && has1 && !isNaN(bpm0) && !isNaN(bpm1);
    const tasks: Task[] = [
      {
        id: 'cargar', title: 'Carga una pista en un deck',
        hint: 'Sube un audio desde 📁 USB y pulsa LOAD 1 o LOAD 2.',
        done: has0 || has1,
      },
      {
        id: 'sync', title: 'Iguala el tempo con SYNC',
        hint: 'Carga dos pistas y pulsa SYNC en el deck que no manda: el BPM se iguala solo.',
        done: bothLoaded && Math.abs(bpm0 - bpm1) < 0.6,
      },
      {
        id: 'crossfader', title: 'Mezcla con el CROSSFADER',
        hint: 'Mueve el fader horizontal del MIXER: de CH1 a CH2.',
        done: xfTouched.current,
      },
      {
        id: 'hotcue', title: 'Pon un HOT CUE',
        hint: 'En modo HOT CUE, toca un pad A-H para guardarlo y otra vez para lanzarlo.',
        done: h0.some((h) => h != null) || h1.some((h) => h != null),
      },
      {
        id: 'loop', title: 'Crea un LOOP de 4 beats',
        hint: 'Pulsa 4BEAT en el deck: la pista repite 4 compases.',
        done: (s0.loop || 0) >= 4 || (s1.loop || 0) >= 4 || !!s0.loopLabel || !!s1.loopLabel,
      },
      {
        id: 'fx', title: 'Enciende el BEAT FX',
        hint: 'En el MIXER, enciende ○ FX OFF → ● FX ON y elige el efecto.',
        done: !!fxOn,
      },
    ];
    // lo hecho se guarda → el avance del usuario no se pierde al recargar
    return tasks.map((t) => ({ ...t, done: t.done || saved.includes(t.id) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eng, xf, fxOn, tick, saved]);

  // persiste las tareas que se acaban de completar
  useEffect(() => {
    const doneIds = state.filter((t) => t.done).map((t) => t.id);
    const next = Array.from(new Set([...saved, ...doneIds]));
    if (next.length !== saved.length) {
      try { localStorage.setItem('rr-mix-tasks-v1', JSON.stringify(next)); } catch { /* noop */ }
      setSaved(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // al completar las 6 se registra como "lección" para que cuenta en el progreso
  const allDone = state.every((t) => t.done);
  useEffect(() => {
    if (allDone && !completedLessons.includes('mix-primera-guia')) {
      try { completeLesson('mix-primera-guia', []); } catch { /* noop */ }
    }
  }, [allDone, completedLessons, completeLesson]);

  return { tasks: state, allDone, count: state.filter((t) => t.done).length };
}

/* ─────────────────────────────────────────────────────────────
   3. LEYENDA "APRENDER" — la explicación de cada control del
      simulador, con los textos que ya viven en data/controls.ts.
      Se listan los controles reales de zona deck + mixer (los que
      tienes delante en el simulador), no una lista hardcodeada.
   ───────────────────────────────────────────────────────────── */
export function LearnLegend({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const sim = controls.filter((c) => c.zone === 'deck' || c.zone === 'mixer' || c.zone === 'browser' || c.zone === 'screen');
    if (!q.trim()) return sim;
    const n = q.toLowerCase();
    return sim.filter((c) => (c.name + ' ' + c.shortTip + ' ' + c.what).toLowerCase().includes(n));
  }, [q]);
  return (
    <div className="rounded-2xl border border-[#22222a] bg-[#0d0e12] p-3">
      <div className="flex items-center gap-2 mb-2">
        <p className="lbl text-[#FF5C00] font-black">APRENDER · qué hace cada control</p>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar…" aria-label="Filtrar controles"
          className="ml-auto w-32 rounded-lg bg-black border border-[#22222a] px-2 py-1 text-xs outline-none focus:border-[#FF5C00] min-h-[36px]" />
        <button type="button" onClick={onClose} aria-label="Cerrar guía de controles" className="w-9 h-9 rounded-lg border border-[#22222a] text-neutral-400 font-black">✕</button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-64 overflow-y-auto overscroll-contain">
        {list.map((c: any) => (
          <div key={c.id} className="rounded-lg border border-[#22222a] bg-black/40 p-2 min-w-0">
            <p className="font-black text-xs text-[#FF8A00] truncate">{c.name}</p>
            <p className="text-[11px] text-neutral-300 mt-0.5">{c.shortTip}</p>
            <p className="text-[10px] text-neutral-500 mt-1">{c.what}</p>
          </div>
        ))}
        {!list.length && <p className="text-xs text-neutral-500 p-2">Sin resultados.</p>}
      </div>
    </div>
  );
}

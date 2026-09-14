import { useEffect, useState } from 'react';
import { controls } from '../../data/controls';
import { proTricks } from '../../data/proTricks';
import { CHALLENGES, dayIndex, ROUTINE, useDaily } from '../../store/daily';

function useCountdown(min: number) {
  const [left, setLeft] = useState(min * 60);
  const [run, setRun] = useState(false);
  useEffect(() => {
    if (!run) return;
    if (left <= 0) { setRun(false); return; }
    const id = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(id);
  }, [run, left]);
  return { left, run, setRun, reset: () => { setLeft(min * 60); setRun(false); } };
}

export default function DailyHabit({ onGo, onSim }: { onGo: (id: string) => void; onSim: (id: string) => void }) {
  const { streak, xp, learnedTricks, routineDone, toggleRoutine, touchToday } = useDaily();
  const trick = proTricks[dayIndex() % proTricks.length];
  const challenge = CHALLENGES[dayIndex() % CHALLENGES.length];
  const timer = useCountdown(10);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => { touchToday(); }, [touchToday]);

  const surprise = () => {
    const done = JSON.parse(localStorage.getItem('xdj-rr-lab-v1') || '{}').state?.done || [];
    const pool = controls.filter((c) => !done.includes(c.id));
    const pick = (pool.length ? pool : controls)[Math.floor(Math.random() * (pool.length ? pool.length : controls.length))];
    onGo(pick.id);
  };

  const hacker = learnedTricks.length >= 10;

  return (
    <div className="rounded-xl border border-[#ff6b00]/40 bg-[#0a0a0a] p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[11px] font-black tracking-widest text-[#ff6b00]">HÁBITO DIARIO</p>
        <span className="text-xs font-black">🔥 {streak} días</span>
        <span className="text-xs text-[#00d4ff] font-bold">{xp} XP</span>
        {hacker && <span className="text-xs font-black bg-[#ff6b00] text-black px-2 py-0.5 rounded">🏆 RR HACKER</span>}
        <button type="button" onClick={surprise} className="ml-auto text-xs font-black border border-[#262626] rounded-lg px-3 py-1.5 touch-manipulation active:scale-95">🎲 Sorpréndeme</button>
      </div>

      <div className="grid md:grid-cols-3 gap-2">
        <div className="rounded-lg border border-[#262626] bg-black/40 p-3 text-sm">
          <p className="text-[10px] font-black tracking-widest text-[#00d4ff]">TRUCO DEL DÍA</p>
          <p className="font-bold mt-1">{trick.title}</p>
          <p className="text-xs text-neutral-400">"{trick.hook}"</p>
          <div className="flex gap-1.5 mt-2">
            <button type="button" onClick={() => onGo(trick.controlIds[0])} className="text-xs font-bold text-[#00d4ff]">Ver ficha</button>
            <button type="button" onClick={() => onSim(trick.simFocus)} className="text-xs font-bold text-[#ff6b00]">Probar</button>
          </div>
        </div>
        <div className="rounded-lg border border-[#262626] bg-black/40 p-3 text-sm">
          <p className="text-[10px] font-black tracking-widest text-[#ff6b00]">RETO DIARIO · 10 MIN</p>
          <p className="font-bold mt-1 text-xs">{challenge}</p>
          <p className="font-mono text-lg mt-1">{Math.floor(timer.left / 60)}:{String(timer.left % 60).padStart(2, '0')}</p>
          <div className="flex gap-1.5 mt-1">
            {!timer.run
              ? <button type="button" onClick={() => timer.setRun(true)} className="text-xs font-black bg-emerald-600 rounded-lg px-3 py-1.5">▶ Empezar</button>
              : <button type="button" onClick={() => timer.setRun(false)} className="text-xs font-bold border border-[#262626] rounded-lg px-3 py-1.5">⏸ Pausa</button>}
            <button type="button" onClick={timer.reset} className="text-xs text-neutral-500">Reset</button>
          </div>
        </div>
        <div className="rounded-lg border border-[#262626] bg-black/40 p-3 text-sm">
          <p className="text-[10px] font-black tracking-widest text-neutral-400">RUTINA 10 MIN</p>
          <div className="space-y-1 mt-1">
            {ROUTINE.map((r) => {
              const done = routineDone.includes(`${today}:${r}`);
              return (
                <button key={r} type="button" onClick={() => toggleRoutine(r)}
                  className={`block w-full text-left text-xs px-2 py-1.5 rounded-lg border touch-manipulation ${done ? 'border-emerald-600 text-emerald-400' : 'border-[#262626] text-neutral-300'}`}>
                  {done ? '✓ ' : '○ '}{r}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

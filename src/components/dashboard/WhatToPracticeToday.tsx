import { controls } from '../../data/controls';
import { lessons } from '../../data/lessons';
import { missions } from '../../data/missions';
import { useProgress, levelLabel } from '../../store/progress';

export default function WhatToPracticeToday({ onGo }: { onGo: (controlId: string) => void }) {
  const { quizErrors, completedLessons, completedMissions } = useProgress();

  let rec: { kind: string; title: string; why: string; target: string } | null = null;
  if (quizErrors.length > 0) {
    const c = controls.find((x) => x.id === quizErrors[0]);
    if (c) rec = { kind: 'Repaso', title: c.name, why: `Te recomiendo ${c.name} porque fallaste su quiz. Repasa su ficha y marca su ejercicio.`, target: c.id };
  }
  if (!rec) {
    const next = lessons.find((l) => !completedLessons.includes(l.id));
    if (next) rec = { kind: `Lección N${next.level}`, title: next.title, why: `Te recomiendo "${next.title}" porque es tu siguiente pendiente de N0/N1 en la migración FLX4→RR.`, target: next.controls[0] };
  }
  if (!rec) {
    const nm = missions.find((m) => !completedMissions.includes(m.id));
    if (nm) rec = { kind: `Misión ${nm.n}`, title: nm.title, why: `N0/N1 listo. Te toca misión ${nm.n}: ${nm.objective}`, target: nm.controlIds[0] };
  }

  if (!rec) return <div className="rounded-xl border border-emerald-600/40 bg-emerald-600/10 p-4 text-sm">MASTER: todo completado. Improvisa un set de 30 min solo con USB.</div>;

  return (
    <div className="rounded-xl border border-[#ff6b00]/50 bg-[#ff6b00]/5 p-4 flex flex-wrap items-center gap-3">
      <div className="flex-1 min-w-52">
        <p className="text-[11px] font-bold tracking-widest text-[#ff6b00]">¿QUÉ PRACTICO HOY? · {rec.kind.toUpperCase()}</p>
        <p className="font-bold">{rec.title}</p>
        <p className="text-sm text-neutral-300">{rec.why}</p>
      </div>
      <button onClick={() => onGo(rec.target)} className="px-4 py-2 rounded-lg bg-[#ff6b00] hover:bg-[#e10600] font-bold text-sm">Practicar ahora</button>
    </div>
  );
}

export function DashboardStats() {
  const { done, completedLessons, completedMissions } = useProgress();
  const pct = Math.round((done.length / controls.length) * 100);
  const stats = [
    ['Nivel', levelLabel(pct)],
    ['Controles', `${done.length}/${controls.length}`],
    ['Lecciones', `${completedLessons.length}/${lessons.length}`],
    ['Misiones', `${completedMissions.length}/${missions.length}`],
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {stats.map(([k, v]) => (
        <div key={k} className="rounded-xl border border-[#262626] bg-[#141414] p-3"><p className="text-[11px] tracking-widest text-neutral-500">{k.toUpperCase()}</p><p className="text-lg font-black text-[#00d4ff]">{v}</p></div>
      ))}
    </div>
  );
}

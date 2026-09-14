import { lazy, Suspense } from 'react';
import { lessons } from '../../data/lessons';
import { useProgress } from '../../store/progress';

const AdvancedTransitions = lazy(() => import('./AdvancedTransitions'));
const UsbExportSim = lazy(() => import('./UsbExportSim'));

export default function LessonsView({ onGo }: { onGo: (id: string) => void }) {
  const { completedLessons, completeLesson } = useProgress();
  const groups: Array<[string, number]> = [['NIVEL 0 — Standalone crash', 0], ['NIVEL 1 — Repaso express', 1], ['NIVEL 2 — Dominio RR', 2], ['NIVEL 3 — Avanzado pro', 3]];
  return (
    <div className="space-y-4">
      <Suspense fallback={<p className="text-sm text-neutral-500">Cargando visualizador...</p>}>
        <AdvancedTransitions />
      </Suspense>
      <Suspense fallback={<p className="text-sm text-neutral-500">Cargando export USB...</p>}>
        <UsbExportSim />
      </Suspense>
      {groups.map(([title, lv]) => (
        <div key={lv} className="rounded-xl border border-[#262626] bg-[#141414] p-4">
          <p className="text-xs font-black tracking-widest text-[#ff6b00]">{title}</p>
          <div className="grid md:grid-cols-2 gap-2 mt-2">
            {lessons.filter((l) => l.level === lv).map((l) => {
              const ok = completedLessons.includes(l.id);
              return (
                <div key={l.id} className="rounded-lg border border-[#262626] bg-black/40 p-3 text-sm">
                  <p className="font-bold">{ok ? '✓ ' : ''}{l.title}</p>
                  <p className="text-xs text-[#ff6b00] mt-1">vs FLX4: {l.vsFLX4_note}</p>
                  <ul className="text-xs text-neutral-400 mt-1">{l.objectives.map((o) => <li key={o}>· {o}</li>)}</ul>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => onGo(l.controls[0])} aria-label={`Ver ${l.title} en mapa`} className="text-xs font-bold text-[#00d4ff] border border-[#00d4ff]/40 rounded-lg px-2 py-1 focus:ring-1 focus:ring-[#00d4ff]">Ver en Mapa</button>
                    {!ok && <button onClick={() => completeLesson(l.id, l.controls)} className="text-xs font-bold text-emerald-400 border border-emerald-600/40 rounded-lg px-2 py-1">Completar</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

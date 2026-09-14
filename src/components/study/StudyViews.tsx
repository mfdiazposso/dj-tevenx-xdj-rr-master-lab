import { useMemo, useState } from 'react';
import Fuse from 'fuse.js';
import { exercises } from '../../data/exercises';
import { quizzes } from '../../data/quizzes';
import { glossary } from '../../data/glossary';
import { useProgress } from '../../store/progress';

export function ExercisesView({ onGo }: { onGo: (id: string) => void }) {
  const [q, setQ] = useState(''); const [lv, setLv] = useState<string>('all');
  const { completedExercises, completeExercise } = useProgress();
  const fuse = useMemo(() => new Fuse(exercises, { keys: ['title', 'vsFLX4_tip'], threshold: 0.4 }), []);
  const list = (q ? fuse.search(q).map((r) => r.item) : exercises).filter((e) => lv === 'all' || e.level === Number(lv));
  return (
    <div className="rounded-xl border border-[#262626] bg-[#141414] p-4 space-y-3">
      <div className="flex gap-2 flex-wrap">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar ejercicios..." className="flex-1 min-w-40 rounded-lg bg-black border border-[#262626] px-3 py-1.5 text-sm outline-none focus:border-[#ff6b00]" />
        {[['all', 'Todos'], ['0', 'N0'], ['1', 'N1'], ['2', 'N2']].map(([v, l]) => <button key={v} onClick={() => setLv(v)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${lv === v ? 'bg-[#ff6b00] text-black border-[#ff6b00]' : 'border-[#262626] text-neutral-400'}`}>{l}</button>)}
      </div>
      <div className="grid md:grid-cols-2 gap-2">
        {list.map((e) => {
          const ok = completedExercises.includes(e.id);
          return <div key={e.id} className="rounded-lg bg-black/40 border border-[#262626] p-3 text-sm">
            <p className="font-bold">{ok ? '✓ ' : ''}{String(e.n).padStart(2, '0')} · {e.title}</p>
            <p className="text-xs text-[#ff6b00]">vs FLX4: {e.vsFLX4_tip}</p>
            <ul className="text-xs text-neutral-400 mt-1">{e.steps.map((s) => <li key={s}>· {s}</li>)}</ul>
            <p className="text-xs text-emerald-400 mt-1">Éxito: {e.successCriteria.join(' / ')}</p>
            <div className="flex gap-2 mt-2">
              <button onClick={() => onGo(e.controlIds[0])} className="text-xs font-bold text-[#00d4ff]">Ver control</button>
              {!ok && <button onClick={() => completeExercise(e.id)} className="text-xs font-bold text-emerald-400">Completar</button>}
            </div>
          </div>;
        })}
      </div>
    </div>
  );
}

export function QuizzesView() {
  const [ans, setAns] = useState<Record<string, number | boolean>>({});
  const { saveQuiz, addQuizError, clearQuizError } = useProgress();
  return (
    <div className="rounded-xl border border-[#262626] bg-[#141414] p-4 space-y-2">
      <p className="text-xs font-black tracking-widest text-[#00d4ff]">TESTS · 20 PREGUNTAS</p>
      {quizzes.map((t) => {
        const v = ans[t.id]; const done = v !== undefined;
        const good = done && v === t.correct;
        return <div key={t.id} className={`rounded-lg border p-3 text-sm ${done ? (good ? 'border-emerald-600' : 'border-[#e10600]') : 'border-[#262626] bg-black/40'}`}>
          <p className="font-bold">{t.q} <span className="text-[10px] text-neutral-500">[{t.type}]</span></p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {t.type === 'mc' ? t.options!.map((o, i) => <button key={i} onClick={() => { setAns((a) => ({ ...a, [t.id]: i })); const ok = i === t.correct; saveQuiz(t.id, ok ? 1 : 0); if (ok) t.controlIds.forEach(clearQuizError); else t.controlIds.forEach(addQuizError); }} className={`text-xs px-2 py-1 rounded-lg border ${v === i ? 'bg-[#ff6b00] text-black' : 'border-[#262626]'}`}>{o}</button>)
            : [true, false].map((b) => <button key={String(b)} onClick={() => { setAns((a) => ({ ...a, [t.id]: b })); const ok = b === t.correct; saveQuiz(t.id, ok ? 1 : 0); if (ok) t.controlIds.forEach(clearQuizError); else t.controlIds.forEach(addQuizError); }} className={`text-xs px-2 py-1 rounded-lg border ${v === b ? 'bg-[#ff6b00] text-black' : 'border-[#262626]'}`}>{b ? 'V' : 'F'}</button>)}
          </div>
          {done && <p className="text-xs mt-1 text-neutral-300">{good ? '✓ ' : '✗ '}{t.explanation} <span className="text-[#ff6b00]">vs FLX4: {t.vsFLX4_note}</span></p>}
        </div>;
      })}
    </div>
  );
}

export function GlossaryView() {
  const [q, setQ] = useState('');
  const fuse = useMemo(() => new Fuse(glossary, { keys: ['term', 'def'], threshold: 0.4 }), []);
  const list = q ? fuse.search(q).map((r) => r.item) : glossary;
  return (
    <div className="rounded-xl border border-[#262626] bg-[#141414] p-4 space-y-2">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar glosario: trim, booth, slip..." className="w-full rounded-lg bg-black border border-[#262626] px-3 py-1.5 text-sm outline-none focus:border-[#00d4ff]" />
      <div className="grid md:grid-cols-2 gap-2">
        {list.map((g) => <div key={g.term} className="rounded-lg bg-black/40 border border-[#262626] p-3 text-sm"><p className="font-bold text-[#00d4ff]">{g.term}</p><p>{g.def}</p><p className="text-xs text-[#ff6b00] mt-1">vs FLX4: {g.vsFLX4}</p></div>)}
      </div>
    </div>
  );
}

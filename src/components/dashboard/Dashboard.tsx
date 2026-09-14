import { useMemo, useState } from 'react';
import { lessons } from '../../data/lessons';
import { missions } from '../../data/missions';
import { quizzes } from '../../data/quizzes';
import { examFinalUnlocked, useProgress } from '../../store/progress';
import { fmtMB, MAX_TRACK_COUNT, useTracks } from '../../store/tracks';
import { DashboardStats } from './WhatToPracticeToday';
import DailyHabit from './DailyHabit';

function TracksCard({ onSim }: { onSim: () => void }) {
  const { tracks, usedBytes } = useTracks();
  const pct = Math.round((tracks.length / MAX_TRACK_COUNT) * 100);
  return (
    <div className="rounded-xl border border-[#00B0FF]/40 bg-[#00B0FF]/5 p-4">
      <div className="flex items-center gap-2">
        <p className="text-[11px] font-black tracking-widest text-[#00B0FF]">MIS TRACKS ({tracks.length}/{MAX_TRACK_COUNT})</p>
        <span className="text-[11px] text-neutral-500">{fmtMB(usedBytes())}</span>
        <button type="button" onClick={onSim} className="ml-auto text-xs font-black border border-[#00B0FF] text-[#00B0FF] rounded-lg px-3 py-1.5 touch-manipulation active:scale-95">Ir a Simulador</button>
      </div>
      <div className="h-2 rounded bg-black border border-[#262626] mt-2 overflow-hidden"><div className="h-full bg-[#00B0FF] transition-all" style={{ width: `${pct}%` }} /></div>
      {tracks.length > 0 && <p className="text-xs text-neutral-400 mt-1 truncate">Último: {tracks[tracks.length - 1].name}</p>}
    </div>
  );
}

const CLUB_CHECK = ['USB analizado FAT32', 'TRIM a 0dB (verdes + 1 ámbar)', 'BOOTH calibrado', 'QUANTIZE ON', 'MASTER en 0dB', 'ECHO 1/2 listo'];

function ClubCard() {
  const [check, setCheck] = useState<string[]>(() => JSON.parse(localStorage.getItem('rr-club-check') || '[]'));
  const toggle = (c: string) => { const n = check.includes(c) ? check.filter((x) => x !== c) : [...check, c]; setCheck(n); localStorage.setItem('rr-club-check', JSON.stringify(n)); };
  const exportJSON = () => {
    const raw = localStorage.getItem('xdj-rr-lab-v1') || '{}';
    const blob = new Blob([raw], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'rr-lab-backup.json'; a.click();
  };
  const importJSON = (f: File) => { const r = new FileReader(); r.onload = () => { localStorage.setItem('xdj-rr-lab-v1', String(r.result)); location.reload(); }; r.readAsText(f); };
  return (
    <div className="rounded-xl border border-[#ff6b00]/40 bg-[#ff6b00]/5 p-4">
      <p className="text-[11px] font-black tracking-widest text-[#ff6b00]">MODO CLUB · CHECKLIST PRE-SET</p>
      <div className="grid sm:grid-cols-2 gap-1.5 mt-2">
        {CLUB_CHECK.map((c) => (
          <button key={c} onClick={() => toggle(c)} aria-label={c} className={`text-left text-sm px-2 py-1.5 rounded-lg border focus:ring-1 focus:ring-[#00d4ff] ${check.includes(c) ? 'border-emerald-600 text-emerald-400' : 'border-[#262626] text-neutral-300'}`}>{check.includes(c) ? '✓ ' : '○ '}{c}</button>
        ))}
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={exportJSON} className="text-xs font-bold border border-[#262626] rounded-lg px-2 py-1.5">Exportar progreso JSON</button>
        <label className="text-xs font-bold border border-[#262626] rounded-lg px-2 py-1.5 cursor-pointer">Importar<input type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importJSON(f); }} /></label>
      </div>
    </div>
  );
}

export default function Dashboard({ onGo, onSim }: { onGo: (controlId: string) => void; onSim: (controlId?: string) => void }) {
  const { completedLessons, completedMissions, completedExercises, completeLesson, completeMission, lastLessonId, examScore, saveExam } = useProgress();
  const next = lessons.find((l) => !completedLessons.includes(l.id));
  const unlocked = examFinalUnlocked(completedLessons, completedExercises);
  const examQs = useMemo(() => [...quizzes].sort(() => Math.random() - 0.5).slice(0, 30), []);
  const [examAns, setExamAns] = useState<Record<string, number | boolean>>({});
  const [examDone, setExamDone] = useState(false);
  const examPct = examDone ? Math.round((examQs.filter((t) => examAns[t.id] === t.correct).length / examQs.length) * 100) : null;

  return (
    <section className="space-y-3">
      <DashboardStats />
      <DailyHabit onGo={onGo} onSim={(id) => onSim(id)} />
      <TracksCard onSim={() => onSim()} />
      <ClubCard />
      {unlocked ? (
        <div className="rounded-xl border border-[#00d4ff]/50 bg-[#00d4ff]/5 p-4">
          <p className="text-[11px] font-black tracking-widest text-[#00d4ff]">EXAMEN FINAL · 30 PREGUNTAS ALEATORIAS</p>
          {examScore !== null && examScore >= 85 && <p className="mt-1 font-black text-emerald-400">🏆 MASTER RR — {examScore}%</p>}
          {examScore !== null && examScore < 85 && <p className="mt-1 text-sm text-neutral-300">Último score: {examScore}% (necesitas 85% para MASTER RR)</p>}
          {!examDone ? (
            <div className="mt-2 space-y-2 max-h-96 overflow-auto">
              {examQs.map((t, i) => (
                <div key={t.id} className="rounded-lg border border-[#262626] bg-black/40 p-2 text-sm">
                  <p><b>{i + 1}. {t.q}</b></p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {t.type === 'mc' ? t.options!.map((o, oi) => <button key={oi} onClick={() => setExamAns((a) => ({ ...a, [t.id]: oi }))} className={`text-xs px-2 py-1 rounded-lg border focus:ring-1 focus:ring-[#00d4ff] ${examAns[t.id] === oi ? 'bg-[#ff6b00] text-black' : 'border-[#262626]'}`}>{o}</button>)
                    : [true, false].map((b) => <button key={String(b)} onClick={() => setExamAns((a) => ({ ...a, [t.id]: b }))} className={`text-xs px-2 py-1 rounded-lg border ${examAns[t.id] === b ? 'bg-[#ff6b00] text-black' : 'border-[#262626]'}`}>{b ? 'V' : 'F'}</button>)}
                  </div>
                </div>
              ))}
              <button onClick={() => { const s = Math.round((examQs.filter((t) => examAns[t.id] === t.correct).length / examQs.length) * 100); saveExam(s); setExamDone(true); }} className="px-4 py-2 rounded-lg bg-[#00d4ff] text-black text-sm font-black">Corregir examen</button>
            </div>
          ) : (
            <div className="mt-2 text-sm">
              <p className="font-black text-lg">Score: {examPct}% {examPct !== null && examPct >= 85 ? '🏆 MASTER RR' : ''}</p>
              <button onClick={() => { setExamDone(false); setExamAns({}); }} className="mt-1 text-xs border border-[#262626] rounded-lg px-2 py-1">Reintentar (nuevas 30)</button>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-[#262626] bg-[#141414] p-4 text-sm text-neutral-500">🔒 Examen final bloqueado: completa 24 lecciones N0-N2 + 12 ejercicios base ({completedLessons.length}/24 · {completedExercises.length}/12).</div>
      )}
      <div className="grid lg:grid-cols-2 gap-3">
        <div className="rounded-xl border border-[#262626] bg-[#141414] p-4">
          <p className="text-[11px] font-bold tracking-widest text-[#00d4ff]">CONTINUAR APRENDIENDO</p>
          {next ? (
            <div className="mt-1">
              <p className="font-bold">{next.title} <span className="text-xs text-neutral-500">N{next.level}</span></p>
              <p className="text-sm text-neutral-400">{next.vsFLX4_note}</p>
              <ul className="text-sm mt-2 space-y-1">{next.objectives.map((o) => <li key={o}>· {o}</li>)}</ul>
              <div className="flex gap-2 mt-3">
                <button onClick={() => onGo(next.controls[0])} className="px-3 py-1.5 rounded-lg border border-[#00d4ff] text-[#00d4ff] text-sm font-bold">Ver en Mapa</button>
                <button onClick={() => completeLesson(next.id, next.controls)} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-sm font-bold">Completar lección (+controles)</button>
              </div>
            </div>
          ) : <p className="text-sm text-emerald-400 font-bold">N0/N1 completado. Pasa a misiones.</p>}
          {lastLessonId && <p className="text-[11px] text-neutral-500 mt-2">Última: {lastLessonId}</p>}
        </div>
        <div className="rounded-xl border border-[#262626] bg-[#141414] p-4">
          <p className="text-[11px] font-bold tracking-widest text-[#ff6b00]">MISIONES 01–10</p>
          <div className="mt-2 space-y-1.5 max-h-56 overflow-auto">
            {missions.map((m) => {
              const ok = completedMissions.includes(m.id);
              return (
                <div key={m.id} className="flex items-center gap-2 rounded-lg bg-black/40 border border-[#262626] px-2 py-1.5 text-sm">
                  <span className={`text-[11px] font-black px-1.5 py-0.5 rounded ${ok ? 'bg-emerald-600' : 'bg-[#ff6b00]'}`}>{String(m.n).padStart(2, '0')}</span>
                  <span className="flex-1">{ok ? '✓ ' : ''}{m.title} <span className="text-neutral-500 text-xs">· {m.difficulty}</span></span>
                  <button onClick={() => onGo(m.controlIds[0])} className="text-xs text-[#00d4ff] font-bold">Ver</button>
                  {!ok && <button onClick={() => completeMission(m.id)} className="text-xs font-bold text-emerald-400">Hecha</button>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-[#262626] bg-[#141414] p-4">
        <p className="text-[11px] font-bold tracking-widest text-neutral-400">LECCIONES N0/N1</p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {lessons.map((l) => {
            const ok = completedLessons.includes(l.id);
            return <button key={l.id} onClick={() => onGo(l.controls[0])} title={l.vsFLX4_note} className={`text-xs px-2 py-1.5 rounded-lg border ${ok ? 'border-emerald-600 text-emerald-400' : 'border-[#262626] text-neutral-300 hover:border-[#ff6b00]'}`}>{ok ? '✓ ' : ''}N{l.level} · {l.title}</button>;
          })}
        </div>
      </div>
    </section>
  );
}

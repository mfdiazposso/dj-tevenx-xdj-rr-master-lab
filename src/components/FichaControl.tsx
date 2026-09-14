import { useState } from 'react';
import { controls } from '../data/controls';
import { proTricks } from '../data/proTricks';
import { useProgress } from '../store/progress';
import { useDaily } from '../store/daily';
import { ClipModal, copyTikTokScript } from './social/ContentFactory';

export default function FichaControl({ id, onSimulate }: { id: string | null; onSimulate?: (id: string) => void }) {
  const { done, favs, toggleDone, toggleFav } = useProgress();
  const c = controls.find((x) => x.id === id);
  if (!c) return <div className="rounded-xl border border-[#262626] bg-[#141414] p-6 text-neutral-400 text-sm">Pasa el cursor sobre el mapa o haz clic en un control para ver su ficha completa + <b className="text-[#ff6b00]">vs FLX4</b>.</div>;
  const isDone = done.includes(c.id);
  const tricks = proTricks.filter((t) => t.controlIds.includes(c.id));
  const { learnedTricks, learnTrick } = useDaily();
  const [clip, setClip] = useState<string | null>(null);
  return (
    <article className="rounded-xl border border-[#262626] bg-[#141414] p-5 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] tracking-widest text-[#00d4ff]">{c.zone.toUpperCase()} · NIVEL {c.level} · {c.kind}</p>
          <h2 className="text-xl font-bold">{c.name}</h2>
          <p className="text-sm text-neutral-400">{c.shortTip}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => toggleFav(c.id)} className="px-3 py-1.5 rounded-lg border border-[#262626] text-sm hover:border-[#ff6b00]">{favs.includes(c.id) ? '★' : '☆'}</button>
          <button onClick={() => toggleDone(c.id)} className={`px-3 py-1.5 rounded-lg text-sm font-bold ${isDone ? 'bg-emerald-600' : 'bg-[#e10600] hover:bg-[#ff6b00]'}`}>{isDone ? '✓ Hecho' : 'Marcar hecho'}</button>
          {onSimulate && <button type="button" onClick={() => onSimulate(c.id)} className="px-3 py-1.5 rounded-lg text-sm font-black border border-[#00d4ff] text-[#00d4ff] touch-manipulation active:scale-95">▶ Probar en Simulador</button>}
        </div>
      </div>
      <div className="rounded-lg border border-[#ff6b00]/50 bg-[#ff6b00]/5 p-3">
        <p className="text-xs font-bold tracking-widest text-[#ff6b00]">VS FLX4 — MIGRACIÓN</p>
        <p className="text-sm">{c.vsFLX4}</p>
      </div>
      <div className="grid md:grid-cols-2 gap-3 text-sm">
        {[['[BÁSICO] Novato FLX4', c.shortTip], ['[PRO] Residente de club', c.does], ['Audio (técnico)', c.audioTech], ['¿Cuándo usarlo?', c.whenUse], ['¿Cuándo NO?', c.whenNot], ['[ERROR CARO]', '⚠ ' + c.mistake], ['Ejercicio', '🎧 ' + c.exercise]].map(([t, v]) => (
          <div key={t} className="rounded-lg bg-black/40 border border-[#262626] p-3"><p className="text-xs font-bold text-neutral-400 mb-1">{t}</p><p>{v}</p></div>
        ))}
      </div>
      {tricks.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-black tracking-widest text-[#ff6b00]">🔓 TRUCO PRO · OCULTO</p>
          {tricks.map((t) => {
            const learned = learnedTricks.includes(t.id);
            return (
              <div key={t.id} className="rounded-lg border border-[#ff6b00]/40 bg-[#ff6b00]/5 p-3 text-sm">
                <p className="font-black">{learned ? '✓ ' : ''}{t.title}</p>
                <p className="text-xs text-[#00d4ff] mt-0.5">Hook Reels: "{t.hook}"</p>
                <p className="text-xs text-neutral-300 mt-1">[PRO] {t.pro}</p>
                <ol className="list-decimal ml-5 mt-1 text-xs space-y-0.5">{t.steps.map((s) => <li key={s}>{s}</li>)}</ol>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {onSimulate && <button type="button" onClick={() => onSimulate(t.simFocus)} className="text-xs font-black border border-[#00d4ff] text-[#00d4ff] rounded-lg px-2 py-1.5 touch-manipulation active:scale-95">▶ Probar truco</button>}
                  {!learned && <button type="button" onClick={() => learnTrick(t.id)} className="text-xs font-bold border border-emerald-600 text-emerald-400 rounded-lg px-2 py-1.5">+50 XP Aprendido</button>}
                  <button type="button" onClick={() => setClip(t.id)} className="text-xs font-bold border border-[#262626] rounded-lg px-2 py-1.5">📱 Crear Clip</button>
                  <button type="button" onClick={() => copyTikTokScript(t)} className="text-xs text-neutral-400 border border-[#262626] rounded-lg px-2 py-1.5">Copiar guión TikTok</button>
                </div>
                {clip === t.id && <ClipModal controlName={c.name} hook={t.hook} body={t.pro} onClose={() => setClip(null)} />}
              </div>
            );
          })}
        </div>
      )}
      <div className="text-sm"><p className="text-xs font-bold text-neutral-400 mb-1">PASO A PASO</p><ol className="list-decimal ml-5 space-y-1">{c.steps.map((s, i) => <li key={i}>{s}</li>)}</ol></div>
      <p className="text-[11px] text-neutral-500">Fuente: {c.source} · Diagrama educativo no afiliado a Pioneer DJ / AlphaTheta.</p>
    </article>
  );
}

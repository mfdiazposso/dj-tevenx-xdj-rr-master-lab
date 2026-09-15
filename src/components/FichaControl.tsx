import { Suspense, lazy, useState } from 'react';
import { controls } from '../data/controls';
import { proTricks } from '../data/proTricks';
import { useProgress } from '../store/progress';
import { useDaily } from '../store/daily';

const ClipModal = lazy(() => import('./social/ContentFactory').then((m) => ({ default: m.ClipModal })));

function copyTikTokScript(trick: { title: string; steps: string[]; hook: string }) {
  const s = `🎧 ${trick.hook}\n\n${trick.title}\n\n${trick.steps.map((x, i) => `${i + 1}. ${x}`).join('\n')}\n\nSígueme @djtevenx · XDJ-RR MASTER LAB (20s)`;
  navigator.clipboard?.writeText(s).catch(() => {});
}

type FichaTab = 'basico' | 'pro' | 'truco';

export default function FichaControl({ id, onSimulate }: { id: string | null; onSimulate?: (id: string) => void }) {
  const { done, favs, toggleDone, toggleFav } = useProgress();
  const [tab, setTab] = useState<FichaTab>('basico');
  const c = controls.find((x) => x.id === id);
  const { learnedTricks, learnTrick } = useDaily();
  const [clip, setClip] = useState<string | null>(null);
  if (!c) return <div className="card p-6 text-neutral-400 text-sm">Pasa el cursor sobre el mapa o haz clic en un control para ver su ficha completa + <b className="text-[#ff6b00]">vs FLX4</b>.</div>;
  const isDone = done.includes(c.id);
  const tricks = proTricks.filter((t) => t.controlIds.includes(c.id));

  return (
    <article className="card p-5 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span aria-label={isDone ? 'Completado' : 'Pendiente'} className={`h-3 w-3 rounded-full ${isDone ? 'bg-[#00E676] shadow-[0_0_12px_#00E676]' : 'bg-[#1e1e1e] border border-[#262626]'}`} />
          <div>
            <p className="text-[11px] tracking-widest text-[#00d4ff]">{c.zone.toUpperCase()} · NIVEL {c.level} · {c.kind}</p>
            <h2 className="text-xl font-bold">{c.name}</h2>
          </div>
          <span className="text-[10px] font-black px-2 py-1 rounded-full border border-[#ff6b00] text-[#ff6b00]">FLX4→RR</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => toggleFav(c.id)} aria-label="Favorito" className="px-3 py-1.5 rounded-full border border-[#262626] text-sm hover:border-[#ff6b00] touch-manipulation">{favs.includes(c.id) ? '★' : '☆'}</button>
          <button onClick={() => toggleDone(c.id)} className={`px-3 py-1.5 rounded-full text-sm font-bold touch-manipulation active:scale-95 ${isDone ? 'bg-[#00E676] text-black' : 'bg-[#e10600] hover:bg-[#ff6b00] text-white'}`}>{isDone ? '✓ Hecho' : 'Marcar hecho'}</button>
        </div>
      </div>

      <div className="flex gap-1.5" role="tablist" aria-label="Secciones de la ficha">
        {([['basico', 'Básico'], ['pro', 'Pro'], ['truco', `Truco Oculto${tricks.length ? ` (${tricks.length})` : ''}`]] as [FichaTab, string][]).map(([t, l]) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-xs font-black touch-manipulation ${tab === t ? 'bg-[#ff6b00] text-black glow-orange' : 'border border-[#262626] text-neutral-400'}`}>{l}</button>
        ))}
      </div>

      {tab === 'basico' && (
        <div className="ficha-grid text-sm">
          {[['[BÁSICO] 1 línea', c.shortTip], ['¿Qué es?', c.what], ['¿Qué hace?', c.does], ['[VS FLX4]', c.vsFLX4]].map(([t, v]) => (
            <div key={t} className="rounded-2xl bg-black/40 border border-[#1e1e1e] p-3"><p className="text-xs font-bold text-neutral-400 mb-1">{t}</p><p>{v}</p></div>
          ))}
          <div className="rounded-2xl bg-black/40 border border-[#1e1e1e] p-3 md:col-span-2"><p className="text-xs font-bold text-neutral-400 mb-1">PASO A PASO</p><ol className="list-decimal ml-5 space-y-1">{c.steps.map((s, i) => <li key={i}>{s}</li>)}</ol></div>
        </div>
      )}

      {tab === 'pro' && (
        <div className="ficha-grid text-sm">
          {[['[PRO] Residente de club', c.does], ['Audio (técnico)', c.audioTech], ['¿Cuándo usarlo?', c.whenUse], ['¿Cuándo NO?', c.whenNot], ['[ERROR CARO]', '⚠ ' + c.mistake], ['Ejercicio', '🎧 ' + c.exercise]].map(([t, v]) => (
            <div key={t} className="rounded-2xl bg-black/40 border border-[#1e1e1e] p-3"><p className="text-xs font-bold text-neutral-400 mb-1">{t}</p><p>{v}</p></div>
          ))}
        </div>
      )}

      {tab === 'truco' && (
        <div className="space-y-2">
          {tricks.length === 0 && <p className="text-sm text-neutral-500">Sin truco oculto para este control… todavía. Marca la ficha como hecha y sigue.</p>}
          {tricks.map((t) => {
            const learned = learnedTricks.includes(t.id);
            return (
              <div key={t.id} className="rounded-2xl border border-[#ff6b00]/40 bg-[#ff6b00]/5 p-3 text-sm">
                <p className="font-black">[TRUCO OCULTO] {learned ? '✓ ' : ''}{t.title}</p>
                <p className="text-xs text-[#00d4ff] mt-0.5">Hook Reels: "{t.hook}"</p>
                <p className="text-xs text-neutral-300 mt-1">[PRO] {t.pro}</p>
                <ol className="list-decimal ml-5 mt-1 text-xs space-y-0.5">{t.steps.map((s) => <li key={s}>{s}</li>)}</ol>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {onSimulate && <button type="button" onClick={() => onSimulate(t.simFocus)} className="text-xs font-black border border-[#00d4ff] text-[#00d4ff] rounded-full px-3 py-1.5 touch-manipulation active:scale-95">▶ Probar truco</button>}
                  {!learned && <button type="button" onClick={() => learnTrick(t.id)} className="text-xs font-bold border border-[#00E676] text-[#00E676] rounded-full px-3 py-1.5">+50 XP Aprendido</button>}
                  <button type="button" onClick={() => setClip(t.id)} className="text-xs font-bold border border-[#262626] rounded-full px-3 py-1.5">📱 Crear Clip 9:16</button>
                  <button type="button" onClick={() => copyTikTokScript(t)} className="text-xs text-neutral-400 border border-[#262626] rounded-full px-3 py-1.5">Copiar guión TikTok</button>
                </div>
                {clip === t.id && <Suspense fallback={<p className="text-xs text-neutral-500">Cargando editor...</p>}><ClipModal controlName={c.name} hook={t.hook} body={t.pro} onClose={() => setClip(null)} /></Suspense>}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {onSimulate && <button type="button" onClick={() => onSimulate(c.id)} className="px-5 py-2 rounded-full text-sm font-black bg-[#ff6b00] text-black glow-orange touch-manipulation active:scale-95">▶ Probar en Simulador</button>}
      </div>
      <p className="text-[11px] text-neutral-500">Fuente: manual XDJ-RR + rekordbox 6.8 + técnicos Pioneer · No oficial.</p>
    </article>
  );
}

import { useEffect, useRef, useState } from 'react';
import { controls } from '../data/controls';
import { useProgress } from '../store/progress';
import type { Control } from '../types';
import { auditMapControls, logQAReport } from './map/qaAudit';

const ZONES = [
  { id: 'deck', label: 'DECK 1', filter: (c: Control) => c.zone === 'deck' },
  { id: 'center', label: 'MIXER + FX + BROWSER + PANTALLA 7"', filter: (c: Control) => c.zone !== 'deck' },
  { id: 'deck2', label: 'DECK 2', filter: (c: Control) => c.zone === 'deck' },
] as const;

function Hotspot({ c, selected, fail, onSelect, onHover }: { c: Control; selected: boolean; fail: boolean; onSelect: () => void; onHover: (c: Control | null) => void }) {
  const { done } = useProgress();
  const isDone = done.includes(c.id);
  return (
    <button
      type="button"
      data-control-id={c.id}
      onMouseEnter={() => onHover(c)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(c)}
      onClick={onSelect}
      aria-label={c.name}
      title={`${c.name} — ${c.shortTip}`}
      className={`relative box-border border border-[#262626] text-left text-[11px] leading-tight px-2 py-1.5 min-h-[44px] rounded-md select-none touch-manipulation cursor-pointer transition-colors duration-150 transform-gpu hover:outline hover:outline-2 hover:outline-[#00d4ff] hover:bg-[#1a1a1a] hover:text-white active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00d4ff]
        ${fail ? 'bg-[#e10600]/10 text-white' : selected ? 'bg-[#00d4ff]/10 text-white outline outline-2 outline-[#00d4ff]' : 'bg-[#1a1a1a] text-neutral-300'}`}
    >
      <span className="font-semibold">{isDone ? '✓ ' : ''}{c.name}</span>
      {fail && (
        <span aria-hidden className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#e10600] text-[11px] font-black text-white shadow-[0_0_8px_#e10600]">✕</span>
      )}
    </button>
  );
}

export default function MapaRR({ selected, onSelect, onHover }: { selected: string | null; onSelect: (id: string) => void; onHover: (c: Control | null) => void }) {
  const decks = controls.filter((x) => x.zone === 'deck');
  const center = controls.filter((x) => x.zone !== 'deck');
  const rootRef = useRef<HTMLDivElement>(null);
  const [qa, setQa] = useState(false);
  const [fails, setFails] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!qa || !rootRef.current) { setFails(new Set()); return; }
    const res = auditMapControls(rootRef.current);
    setFails(new Set(res.map((f) => f.id)));
    logQAReport(res, controls.length);
  }, [qa]);

  return (
    <div ref={rootRef}>
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setQa((v) => !v)}
          aria-label="Activar diagnóstico QA del mapa"
          className={`px-3 py-1.5 rounded-lg text-xs font-black tracking-widest border touch-manipulation active:scale-95 ${qa ? 'bg-[#e10600] text-white border-[#e10600]' : 'border-[#262626] text-neutral-400 hover:border-[#e10600] hover:text-white'}`}
        >{qa ? `QA: ${fails.size} FAIL ✕ (ver consola)` : 'QA - FAILURE MAP'}</button>
        {qa && <span className="text-xs text-neutral-400">OK: {controls.length - fails.size} · FAIL: {fails.size} · AudioContext N/A en mapa</span>}
      </div>
      <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr_1fr] isolate overflow-visible">
        {[decks, center, decks].map((list, i) => (
          <div key={i} className="rounded-xl border border-[#262626] bg-[#141414] p-3">
            <h3 className="text-xs font-bold tracking-widest text-[#ff6b00] mb-2">{ZONES[i].label}</h3>
            {i === 1 && (
              <div className="mb-2 rounded-lg border border-[#00d4ff]/40 bg-black p-3 text-center">
                <p className="text-[11px] tracking-widest text-[#00d4ff]">PANTALLA 7" — WAVEFORM + BROWSE</p>
                <p className="text-[11px] text-neutral-400">Diagrama esquemático educativo. No oficial Pioneer.</p>
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {(i === 1 ? center : list.slice(0, 24)).map((ctl) => (
                <Hotspot key={`${i}-${ctl.id}`} c={ctl} selected={selected === ctl.id} fail={qa && fails.has(ctl.id)} onSelect={() => onSelect(ctl.id)} onHover={onHover} />
              ))}
            </div>
            {i !== 1 && <p className="mt-2 text-[11px] text-neutral-500">Controles simétricos L/R. JOG 206mm + JOG ADJUST mecánico.</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

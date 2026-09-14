import { useRef, useState } from 'react';

const MARKS = [
  { beat: 0, label: 'TRIM igualado', color: '#00d4ff' },
  { beat: 8, label: 'LOW swap 1/2', color: '#ff6b00' },
  { beat: 16, label: 'HPF abre', color: '#e10600' },
  { beat: 24, label: 'ECHO ON + LEVEL→75%', color: '#a855f7' },
  { beat: 31, label: 'OFF en el 1', color: '#22c55e' },
];

export default function AdvancedTransitions() {
  const [beat, setBeat] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const timer = useRef<any>(null);

  const blip = (ctx: AudioContext, f: number, t: number) => {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.value = f; o.type = 'sine';
    g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.13);
  };

  const play = () => {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!ctxRef.current) ctxRef.current = new Ctx();
    const ctx = ctxRef.current!; ctx.resume();
    setPlaying(true); setBeat(0);
    let b = 0;
    clearInterval(timer.current);
    timer.current = setInterval(() => {
      b += 1;
      const m = MARKS.find((x) => x.beat === b);
      blip(ctx, m ? 880 : 440, ctx.currentTime);
      if (b >= 32) { clearInterval(timer.current); setPlaying(false); setBeat(-1); return; }
      setBeat(b);
    }, 150);
  };

  const stop = () => { clearInterval(timer.current); setPlaying(false); setBeat(-1); };

  return (
    <div className="rounded-xl border border-[#262626] bg-[#141414] p-4">
      <p className="text-[11px] font-black tracking-widest text-[#ff6b00]">VISUALIZADOR TRANSICIÓN 32 BEATS</p>
      <div className="relative mt-3 h-14 rounded-lg bg-black border border-[#262626] overflow-hidden">
        <div className="absolute inset-0 flex">
          {Array.from({ length: 32 }).map((_, i) => (
            <div key={i} className={`flex-1 border-r border-[#1a1a1a] ${i <= beat ? 'bg-[#ff6b00]/20' : ''}`} />
          ))}
        </div>
        {MARKS.map((m) => (
          <div key={m.beat} className="absolute top-0 h-full" style={{ left: `${(m.beat / 32) * 100}%` }}>
            <div className="w-px h-full" style={{ background: m.color }} />
            <span className="absolute top-1 -translate-x-1/2 text-[9px] font-bold whitespace-nowrap px-1 rounded" style={{ background: '#000', color: m.color }}>{m.beat}: {m.label}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-3 items-center">
        {!playing
          ? <button onClick={play} aria-label="Reproducir demo transición" className="px-4 py-1.5 rounded-lg bg-[#ff6b00] text-black text-sm font-black focus:ring-1 focus:ring-[#00d4ff]">▶ Play demo</button>
          : <button onClick={stop} aria-label="Detener demo" className="px-4 py-1.5 rounded-lg border border-[#262626] text-sm font-bold">■ Stop</button>}
        <p className="text-xs text-neutral-400">Beat {beat < 0 ? '—' : beat}/32 · el blip agudo marca cada acción TRIM/EQ/FILTER/LEVEL.</p>
      </div>
    </div>
  );
}

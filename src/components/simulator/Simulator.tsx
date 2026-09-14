import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useAudioEngine } from '../../hooks/useAudioEngine';
import { controls } from '../../data/controls';
import { useTracks } from '../../store/tracks';
import { useDaily } from '../../store/daily';
import WavePeaks from '../uploader/WavePeaks';

let uiCtx: AudioContext | null = null;
function click() {
  try {
    if (!uiCtx) { const Ctx = window.AudioContext || (window as any).webkitAudioContext; uiCtx = new Ctx(); }
    if (uiCtx.state === 'suspended') uiCtx.resume();
    const t = uiCtx.currentTime;
    const o = uiCtx.createOscillator(); const g = uiCtx.createGain();
    o.type = 'square'; o.frequency.value = 2000;
    g.gain.setValueAtTime(0.03, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    o.connect(g); g.connect(uiCtx.destination); o.start(t); o.stop(t + 0.035);
  } catch { /* noop */ }
}
import { useProgress } from '../../store/progress';
import MobilePracticeMode from './MobilePracticeMode';

const TrackUploader = lazy(() => import('../uploader/TrackUploader'));

const BTN = 'touch-manipulation select-none relative z-10 active:scale-90 min-h-[56px] lg:min-h-[44px] min-w-[56px] transition-all';

function Slider({ label, min, max, step, value, onChange }: any) {
  const fire = (v: number) => onChange(v);
  return (
    <label className="block text-[11px] text-neutral-400 touch-manipulation">{label} <span className="text-[#ff6b00] font-bold">{typeof value === 'number' ? Math.round(value * 100) + '%' : ''}</span>
      <input type="range" aria-label={label} min={min} max={max} step={step} value={value}
        onInput={(e) => fire(Number((e.target as HTMLInputElement).value))}
        onChange={(e) => fire(Number(e.target.value))}
        className="w-full accent-[#ff6b00] h-12 lg:h-8 py-2 lg:py-0" />
    </label>
  );
}

function Meter({ value }: { value: number }) {
  const v = Math.min(1, Math.max(0, value));
  const pct = Math.round(v * 100);
  const color = pct > 90 ? 'bg-[#e10600]' : pct > 70 ? 'bg-[#ff6b00]' : 'bg-emerald-500';
  return <div className="w-4 h-28 rounded bg-black border border-[#262626] flex flex-col justify-end overflow-hidden"><div className={`${color} duration-75`} style={{ height: `${pct}%` }} /></div>;
}

function useLevels(eng: ReturnType<typeof useAudioEngine>) {
  const [lv, setLv] = useState({ deck: [0, 0] as [number, number], master: 0 });
  const ref = useRef(eng);
  ref.current = eng;
  useEffect(() => {
    const id = setInterval(() => setLv(ref.current.getLevels()), 120);
    return () => clearInterval(id);
  }, []);
  return lv;
}

function Jog({ onNudge }: { onNudge: (dx: number) => void }) {
  const lastX = useRef(0);
  return (
    <div
      role="slider" aria-label="Jog wheel" tabIndex={0}
      className="mx-auto h-28 w-28 lg:h-[180px] lg:w-[180px] rounded-full border-4 border-[#262626] hover:border-[#ff6b00]/50 bg-[radial-gradient(circle,#222_30%,#0a0a0a_70%)] cursor-grab active:cursor-grabbing flex items-center justify-center text-xs text-neutral-500 select-none focus:ring-1 focus:ring-[#00d4ff] touch-none"
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); lastX.current = e.clientX; e.preventDefault(); }}
      onPointerMove={(e) => { if (e.buttons === 1) { onNudge(e.clientX - lastX.current); lastX.current = e.clientX; } }}
      onPointerUp={(e) => { try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ } }}
      onPointerCancel={(e) => { try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ } }}
    >JOG ↓ arrastra →</div>
  );
}

function Wave({ seed }: { seed: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!; const g = c.getContext('2d')!;
    g.clearRect(0, 0, c.width, c.height); g.fillStyle = seed === 0 ? '#00d4ff' : '#ff6b00';
    for (let x = 0; x < c.width; x += 3) { const h = 8 + Math.abs(Math.sin(x * 0.2 + seed * 5)) * 24; g.fillRect(x, 32 - h / 2, 2, h); }
  }, [seed]);
  return <canvas ref={ref} width={220} height={64} className="w-full h-[60px] lg:h-[80px] rounded bg-black border border-[#262626] pointer-events-none" />;
}

export default function Simulator({ focusId }: { focusId?: string | null }) {
  const eng = useAudioEngine();
  const { rrMode } = useProgress();
  const lv = useLevels(eng);
  const [xf, setXf] = useState(0.5); const [master, setMaster] = useState(0.9);
  const [mobileTab, setMobileTab] = useState<'d1' | 'mix' | 'd2'>('mix');
  const [practice, setPractice] = useState(false);
  const [knobs, setKnobs] = useState<Record<string, number>>({});
  const focusName = focusId ? controls.find((c) => c.id === focusId)?.name ?? focusId : null;

  useEffect(() => {
    const unlock = () => { (eng as any).resume?.(); };
    window.addEventListener('touchstart', unlock, { once: true });
    window.addEventListener('click', unlock, { once: true });
    return () => { window.removeEventListener('touchstart', unlock); window.removeEventListener('click', unlock); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const K = (d: 0 | 1, k: string, def: number) => knobs[`${d}${k}`] ?? def;
  const SK = (d: 0 | 1, k: string, v: number, fn: (v: number) => void) => { setKnobs((s) => ({ ...s, [`${d}${k}`]: v })); fn(v); };
  const buzz = () => { if (navigator.vibrate) navigator.vibrate(10); };
  const cueBuzz = () => { if (navigator.vibrate) navigator.vibrate(50); };

  // Teclado web: SPACE=PLAY · C=CUE · 1-3=HOT CUE A-C (deck 1)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.code === 'Space') { e.preventDefault(); eng.play(0); }
      else if (e.key === 'c' || e.key === 'C') (eng as any).cue(0);
      else if (e.key >= '1' && e.key <= '3') (eng as any).triggerHotCue?.(0, Number(e.key) - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swipe móvil entre DECK1/MIXER/DECK2
  const swipeX = useRef<number | null>(null);
  const order: Array<'d1' | 'mix' | 'd2'> = ['d1', 'mix', 'd2'];
  const onSwipeEnd = (dx: number) => {
    if (Math.abs(dx) < 60) return;
    const i = order.indexOf(mobileTab);
    if (dx < 0 && i < 2) setMobileTab(order[i + 1]);
    if (dx > 0 && i > 0) setMobileTab(order[i - 1]);
  };

  const deckUI = (n: 0 | 1) => {
    const isFile = eng.hasFile[n];
    const tname = (eng as any).fileName ? (eng as any).fileName(n) : '';
    const uploaded = useTracks.getState().tracks.find((t) => t.name === tname);
    return (
      <div className="rounded-xl border border-[#262626] bg-[#0a0a0a] p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-black tracking-widest text-[#00d4ff] truncate">DECK {n + 1} {eng.playing[n] ? '▶' : '❚❚'}{tname ? ` · ${tname}` : ''}</p>
          <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded ${isFile ? 'bg-emerald-600' : 'bg-[#ff6b00] text-black'}`}>{isFile ? 'TRACK' : 'DEMO OSC'}</span>
        </div>
        {uploaded ? <WavePeaks peaks={uploaded.peaks} color="#ff6b00" height={64} /> : <Wave seed={n} />}
      {!isFile && <p className="text-[11px] text-neutral-500">Sube tracks en MIS TRACKS para practicar TRIM/GAIN. Ahora suena oscilador demo.</p>}
        <Jog onNudge={(dx) => (eng as any).nudge?.(n, dx)} />
        <div className="flex gap-3">
          <button type="button" aria-label={`Play deck ${n + 1}`} onClick={() => { buzz(); click(); if (eng.hasFile[n]) { try { useDaily.getState().bumpMixes(); } catch { /* noop */ } } eng.play(n); }} className={`${BTN} flex-1 rounded-lg bg-[#00E676] text-black font-bold text-base`}>PLAY</button>
          <button type="button" aria-label={`Pause deck ${n + 1}`} onClick={() => { buzz(); eng.pause(n); }} className={`${BTN} flex-1 rounded-lg border border-[#262626] font-bold text-base`}>PAUSE</button>
          <button type="button" aria-label={`Cue deck ${n + 1}`} onClick={() => { cueBuzz(); click(); eng.cue(n); }} className={`${BTN} flex-1 rounded-lg bg-[#FF1744] text-white font-bold text-base`}>CUE</button>
        </div>
        <div className="grid grid-cols-1 gap-1">
          <Slider label="TRIM" min={0} max={1.2} step={0.01} value={K(n, 't', 0.8)} onChange={(v: number) => SK(n, 't', v, (x) => eng.setTrim(n, x))} />
          <Slider label="HI" min={0} max={1} step={0.01} value={K(n, 'h', 0.75)} onChange={(v: number) => SK(n, 'h', v, (x) => eng.setEQ(n, 'high', x))} />
          <Slider label="MID" min={0} max={1} step={0.01} value={K(n, 'm', 0.75)} onChange={(v: number) => SK(n, 'm', v, (x) => eng.setEQ(n, 'mid', x))} />
          <Slider label="LOW" min={0} max={1} step={0.01} value={K(n, 'l', 0.75)} onChange={(v: number) => SK(n, 'l', v, (x) => eng.setEQ(n, 'low', x))} />
          <Slider label="COLOR" min={-1} max={1} step={0.01} value={K(n, 'c', 0)} onChange={(v: number) => SK(n, 'c', v, (x) => eng.setColor(n, x))} />
          <Slider label="CH FADER" min={0} max={1} step={0.01} value={K(n, 'f', 0.9)} onChange={(v: number) => SK(n, 'f', v, (x) => eng.setFader(n, x))} />
        </div>
        <div className="flex justify-center"><Meter value={lv.deck[n]} /></div>
      </div>
    );
  };

  const mixerUI = (
    <div className="rounded-xl border border-[#262626] bg-[#0a0a0a] p-3 space-y-2 text-center">
      <p className="text-xs font-black tracking-widest text-[#ff6b00]">MIXER</p>
      <div className="flex justify-center gap-3"><div><p className="text-[10px] text-neutral-500">CH1</p><Meter value={lv.deck[0]} /></div><div><p className="text-[10px] text-neutral-500">MST</p><Meter value={lv.master} /></div><div><p className="text-[10px] text-neutral-500">CH2</p><Meter value={lv.deck[1]} /></div></div>
      <div className="max-w-[200px] mx-auto w-full"><Slider label="CROSSFADER" min={0} max={1} step={0.01} value={xf} onChange={(v: number) => { setXf(v); eng.setCrossfader(v); }} /></div>
      <Slider label="MASTER" min={0} max={1.2} step={0.01} value={master} onChange={(v: number) => { setMaster(v); eng.setMaster(v); }} />
    </div>
  );

  if (practice) return <MobilePracticeMode eng={eng} onExit={() => setPractice(false)} />;

  return (
    <div className="pb-24">
      {rrMode && <div className="mb-2 rounded-xl border border-[#00d4ff]/50 bg-[#00d4ff]/10 p-3 text-sm"><b className="text-[#00d4ff]">RR DELANTE ON:</b> replica cada gesto en tu RR real.</div>}
      {focusName && <div className="mb-2 rounded-xl border border-[#00d4ff]/50 bg-[#00d4ff]/5 p-3 text-sm">🎯 <b className="text-[#00d4ff]">Practicando: {focusName}</b> <span className="text-neutral-400">— venido desde su ficha. Toca los controles equivalentes aquí.</span></div>}
      {!rrMode && <div className="mb-2 rounded-xl border border-[#262626] bg-[#141414] p-3 text-xs text-neutral-400">🖐 <b className="text-neutral-200">Guía de manos (sin RR delante):</b> izquierda → Jog + TEMPO Deck 1 · derecha → Jog + fader Deck 2 · pulgares → PLAY/CUE · mezcla con CROSSFADER al centro.</div>}
      <Suspense fallback={<p className="text-xs text-neutral-500">Cargando uploader...</p>}>
        <TrackUploader eng={eng} />
      </Suspense>
      <div className="flex gap-2 mb-2">
        <button type="button" onClick={() => setPractice(true)} className={`${BTN} px-4 py-2 rounded-lg bg-[#ff6b00] text-black text-sm font-black`}>📱 MODO PRÁCTICA CELULAR</button>
      </div>
      <div className="lg:hidden sticky top-0 z-20 bg-[#0a0a0a]/90 backdrop-blur border border-[#262626] rounded-xl flex gap-1.5 mb-2 py-2 px-2">
        {(['d1', 'mix', 'd2'] as const).map((t) => (
          <button type="button" key={t} onClick={() => setMobileTab(t)} aria-label={`Ver ${t}`} className={`${BTN} flex-1 px-2 py-3 rounded-lg text-xs font-black ${mobileTab === t ? 'bg-[#ff6b00] text-black' : 'border border-[#262626] text-neutral-400'}`}>{t === 'd1' ? 'DECK 1' : t === 'mix' ? 'MIXER' : 'DECK 2'}</button>
        ))}
      </div>
      <div className="lg:hidden"
        onTouchStart={(e) => { swipeX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => { if (swipeX.current != null) onSwipeEnd(e.changedTouches[0].clientX - swipeX.current); swipeX.current = null; }}
      >
        {mobileTab === 'd1' && deckUI(0)}
        {mobileTab === 'mix' && mixerUI}
        {mobileTab === 'd2' && deckUI(1)}
      </div>
      <div className="hidden lg:grid gap-3 lg:grid-cols-[1fr_280px_1fr]">
        {deckUI(0)}
        {mixerUI}
        {deckUI(1)}
      </div>
    </div>
  );
}

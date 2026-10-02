import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useAudioEngine } from '../../hooks/useAudioEngine';
import { controls } from '../../data/controls';
import { useProgress } from '../../store/progress';
import { useTracks } from '../../store/tracks';
import { useDaily } from '../../store/daily';
import WavePeaks from '../uploader/WavePeaks';
import MobilePracticeMode from './MobilePracticeMode';

const TrackUploader = lazy(() => import('../uploader/TrackUploader'));

const BTN = 'touch-manipulation select-none relative z-10 active:scale-90 min-h-[56px] lg:min-h-[44px] min-w-[56px] transition-all';

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

/* Knob giratorio estilo hardware: arrastra vertical, doble-click resetea */
function Knob({ label, min, max, value, onChange, color = '#FF5C00', reset }: any) {
  const drag = useRef<{ y: number; v: number } | null>(null);
  const pct = Math.min(1, Math.max(0, (value - min) / (max - min)));
  const ang = -135 + pct * 270;
  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <div role="slider" aria-label={label} aria-valuenow={Math.round(value * 100)} tabIndex={0}
        className="relative h-12 w-12 lg:h-14 lg:w-14 rounded-full touch-none cursor-ns-resize focus:ring-1 focus:ring-[#FF5C00]"
        style={{ background: 'radial-gradient(circle at 35% 30%, #22222a, #141418 70%)', boxShadow: '4px 4px 10px rgba(0,0,0,.65), -2px -2px 6px rgba(255,255,255,.06), inset 2px 2px 5px rgba(0,0,0,.65)' }}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { y: e.clientY, v: value }; e.preventDefault(); }}
        onPointerMove={(e) => { if (e.buttons === 1 && drag.current) { const dv = ((drag.current.y - e.clientY) / 120) * (max - min); const nv = Math.min(max, Math.max(min, drag.current.v + dv)); onChange(Math.round(nv * 100) / 100); } }}
        onDoubleClick={() => { if (reset !== undefined) onChange(reset); }}
        onKeyDown={(e) => { const s = (max - min) / 20; if (e.key === 'ArrowUp') onChange(Math.min(max, value + s)); if (e.key === 'ArrowDown') onChange(Math.max(min, value - s)); }}
      >
        <div className="absolute inset-0 pointer-events-none" style={{ transform: `rotate(${ang}deg)` }}>
          <div className="absolute left-1/2 top-[4px] h-[10px] w-[3px] -translate-x-1/2 rounded" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
        </div>
        <div className="absolute inset-[15px] rounded-full pointer-events-none" style={{ background: '#070707' }} />
      </div>
      <span className="lbl text-neutral-400">{label}</span>
    </div>
  );
}

function Slider({ label, min, max, step, value, onChange }: any) {
  const fire = (v: number) => onChange(v);
  return (
    <label className="block text-[11px] text-neutral-400 touch-manipulation">{label} <span className="text-[#FF5C00] font-bold">{typeof value === 'number' ? Math.round(value * 100) + '%' : ''}</span>
      <input type="range" aria-label={label} min={min} max={max} step={step} value={value}
        onInput={(e) => fire(Number((e.target as HTMLInputElement).value))}
        onChange={(e) => fire(Number(e.target.value))}
        className="w-full accent-[#FF5C00] h-12 lg:h-8 py-2 lg:py-0" />
    </label>
  );
}

/* Fader vertical con carril estilo hardware */
function VFader({ label, min, max, step, value, onChange, height = 120 }: any) {
  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <span className="lbl text-neutral-400">{label}</span>
      <div className="rounded-lg bg-black border border-[#22222a] flex items-center justify-center py-2" style={{ height, width: 52 }}>
        <input type="range" aria-label={label} min={min} max={max} step={step} value={value}
          onInput={(e) => onChange(Number((e.target as HTMLInputElement).value))}
          onChange={(e) => onChange(Number(e.target.value))}
          className="accent-[#FF5C00] touch-manipulation" style={{ writingMode: 'vertical-lr', direction: 'rtl', width: 40, height: height - 20 }} />
      </div>
      <span className="mono text-[10px] text-[#FF5C00]">{Math.round(value * 100)}%</span>
    </div>
  );
}

function Meter({ value }: { value: number }) {
  const v = Math.min(1, Math.max(0, value));
  const pct = Math.round(v * 100);
  const color = pct > 90 ? 'bg-[#FF3D00]' : pct > 70 ? 'bg-[#FF5C00]' : 'bg-[#FF3D00]';
  return <div className="w-4 h-28 rounded bg-black border border-[#22222a] flex flex-col justify-end overflow-hidden"><div className={`${color} duration-75`} style={{ height: `${pct}%` }} /></div>;
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

/* Jog con anillos metálicos como el hardware */
function Jog({ onNudge }: { onNudge: (dx: number) => void }) {
  const lastX = useRef(0);
  return (
    <div role="slider" aria-label="Jog wheel" tabIndex={0}
      className="jog jog-pro mx-auto h-28 w-28 lg:h-[180px] lg:w-[180px] rounded-full cursor-grab active:cursor-grabbing flex items-center justify-center select-none focus:ring-1 focus:ring-[#FF5C00] touch-none"
      style={{ background: 'radial-gradient(circle, #0d0e12 0%, #141418 45%, #070707 75%)', border: '6px solid #0d0e12', outline: '2px solid #22222a' }}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); lastX.current = e.clientX; e.preventDefault(); }}
      onPointerMove={(e) => { if (e.buttons === 1) { onNudge(e.clientX - lastX.current); lastX.current = e.clientX; } }}
      onPointerUp={(e) => { try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ } }}
      onPointerCancel={(e) => { try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ } }}
    >
      <div className="rounded-full flex items-center justify-center h-12 w-12 lg:h-20 lg:w-20" style={{ background: 'radial-gradient(circle at 40% 35%, #22222a, #070707 75%)', boxShadow: 'inset 2px 2px 6px rgba(0,0,0,.7)' }}>
        <span className="mono text-[9px] lg:text-[10px] text-neutral-500 pointer-events-none">XDJ-RR</span>
      </div>
    </div>
  );
}

function Wave({ seed }: { seed: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!; const g = c.getContext('2d')!;
    g.clearRect(0, 0, c.width, c.height); g.fillStyle = '#FF8A00';
    for (let x = 0; x < c.width; x += 3) { const h = 8 + Math.abs(Math.sin(x * 0.2 + seed * 5)) * 24; g.fillRect(x, 32 - h / 2, 2, h); }
  }, [seed]);
  return <canvas ref={ref} width={220} height={64} className="waveform w-full h-[60px] lg:h-[80px] rounded-xl bg-black border border-[#22222a] pointer-events-none" />;
}

/* Pantalla central 7" estilo hardware: filenames + BPM + time */
function ScreenStrip({ eng }: { eng: ReturnType<typeof useAudioEngine> }) {
  const st0: any = (eng as any).deckState ? (eng as any).deckState(0) : {};
  const st1: any = (eng as any).deckState ? (eng as any).deckState(1) : {};
  const n0 = (eng as any).fileName ? (eng as any).fileName(0) : '';
  const n1 = (eng as any).fileName ? (eng as any).fileName(1) : '';
  return (
    <div className="rounded-2xl border border-[#22222a] bg-black p-2 grid grid-cols-[1fr_auto_1fr] gap-2 items-center" style={{ boxShadow: 'inset 0 0 24px rgba(255,92,0,.12)' }}>
      <div className="min-w-0">
        <p className="mono text-[10px] text-[#FF8A00] truncate">{n0 || 'DECK 1 · demo osc'}</p>
        <p className="mono bpm font-black text-[#ffffff]">{st0.bpm || '---'} <span className="text-[10px] text-neutral-500">{st0.pitch}% · {st0.time}</span></p>
      </div>
      <div className="text-center px-2">
        <p className="lbl text-[#FF5C00]">XDJ-RR</p>
        <p className="mono text-[9px] text-neutral-500">{eng.playing[0] ? '▶' : '❚❚'} {eng.playing[1] ? '▶' : '❚❚'}</p>
      </div>
      <div className="min-w-0 text-right">
        <p className="mono text-[10px] text-[#FF8A00] truncate">{n1 || 'demo osc · DECK 2'}</p>
        <p className="mono bpm font-black text-[#ffffff]">{st1.bpm || '---'} <span className="text-[10px] text-neutral-500">{st1.pitch}% · {st1.time}</span></p>
      </div>
    </div>
  );
}

export default function Simulator({ focusId }: { focusId?: string | null }) {
  const eng = useAudioEngine();
  const { rrMode } = useProgress();
  const lv = useLevels(eng);
  const [xf, setXf] = useState(0.5); const [master, setMaster] = useState(0.9);
  const [mobileTab, setMobileTab] = useState<'d1' | 'mix' | 'd2'>('mix');
  const [practice, setPractice] = useState(false);
  const [browseIdx, setBrowseIdx] = useState(0);
  const [mode, setMode] = useState<'tactil' | 'consola'>(() =>
    typeof window !== 'undefined' && (/Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 900) ? 'consola' : 'tactil');
  const [cs, setCs] = useState(0.5);
  const fitRef = useRef<HTMLDivElement>(null);
  const { tracks: upTracks } = useTracks();
  const trackNames = upTracks.length ? upTracks.map((t) => t.name) : ['(sube tracks en MIS TRACKS)'];
  const browseName = trackNames[browseIdx % trackNames.length];
  const browseLoad = async (d: 0 | 1) => {
    const t = upTracks[browseIdx % upTracks.length];
    if (!t) return;
    try {
      const blob = await useTracks.getState().getBlob(t.id);
      if (!blob) return;
      await (eng as any).resume?.();
      await (eng as any).loadBlob(d, blob, t.name);
      buzz();
    } catch { /* noop */ }
  };

  useEffect(() => {
    if (mode !== 'consola') return;
    const el = fitRef.current;
    if (!el || !el.parentElement) return;
    const ro = new ResizeObserver(() => {
      const r = el.parentElement!.getBoundingClientRect();
      setCs(Math.min(r.width / 1280, (r.height || 620) / 533));
    });
    ro.observe(el.parentElement);
    return () => ro.disconnect();
  }, [mode]);
  const [knobs, setKnobs] = useState<Record<string, number>>({});
  const [leds, setLeds] = useState<Record<string, boolean>>({ v0: true, v1: true, q0: true, q1: true });
  const [fxSel, setFxSel] = useState('ECHO');
  const [fxOn, setFxOn] = useState(false);
  const [fxLvl, setFxLvl] = useState(0.5);
  const FXS = ['DELAY', 'ECHO', 'SPIRAL', 'REVERB', 'TRANS', 'FLANGER', 'PITCH', 'ROLL'];
  const COLORS = ['DUB ECHO', 'SWEEP', 'FILTER', 'NOISE'];
  const HOTPADS: Array<[string, string]> = [['A', '#FF5C00'], ['B', '#FF8A00'], ['C', '#FF3D00'], ['D', '#FFB800']];
  const LOOPS = [1, 2, 4, 8];
  const led = (k: string) => !!leds[k];
  const toggleLed = (k: string) => { setLeds((s) => ({ ...s, [k]: !s[k] })); buzz(); };
  const focusName = focusId ? controls.find((c) => c.id === focusId)?.name ?? focusId : null;

  useEffect(() => {
    const unlock = () => { (eng as any).resume?.(); };
    window.addEventListener('touchstart', unlock, { once: true });
    window.addEventListener('click', unlock, { once: true });
    return () => { window.removeEventListener('touchstart', unlock); window.removeEventListener('click', unlock); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // v7.0: horizontal por defecto en móvil (fullscreen + lock; iOS lo ignora y usa rotación CSS)
  useEffect(() => {
    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 900;
    if (!isMobile) return;
    try { document.documentElement.requestFullscreen?.(); } catch { /* noop */ }
    try {
      const o = screen.orientation as any;
      o?.lock?.('landscape')?.catch?.(() => {});
    } catch { /* noop */ }
  }, []);

  const K = (d: 0 | 1, k: string, def: number) => knobs[`${d}${k}`] ?? def;
  const SK = (d: 0 | 1, k: string, v: number, fn: (v: number) => void) => { setKnobs((s) => ({ ...s, [`${d}${k}`]: v })); fn(v); };
  const buzz = () => { if (navigator.vibrate) navigator.vibrate(10); };
  const cueBuzz = () => { if (navigator.vibrate) navigator.vibrate(50); };

  // Teclado web: SPACE=PLAY · C=CUE · 1-4=HOT CUE A-D (deck 1)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.code === 'Space') { e.preventDefault(); eng.play(0); }
      else if (e.key === 'c' || e.key === 'C') (eng as any).cue(0);
      else if (e.key >= '1' && e.key <= '4') (eng as any).triggerHotCue?.(0, Number(e.key) - 1);
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

  const tempoCol = (n: 0 | 1) => {
    const st: any = (eng as any).deckState ? (eng as any).deckState(n) : { range: 8, mt: false };
    return (
    <div className="flex flex-col items-center gap-1 select-none">
      <span className="lbl text-neutral-400">Tempo</span>
      <div className="rounded-lg bg-black border border-[#22222a] flex items-center justify-center py-2" style={{ height: 168, width: 52 }}>
        <input aria-label={`Tempo deck ${n + 1}`} type="range" min={-(st.range ?? 8)} max={st.range ?? 8} step={0.1} value={K(n, 'p', 0)}
          onInput={(e) => SK(n, 'p', Number((e.target as HTMLInputElement).value), (x) => eng.setTempo(n, x))}
          onChange={(e) => SK(n, 'p', Number(e.target.value), (x) => eng.setTempo(n, x))}
          className="accent-[#FF5C00] touch-manipulation" style={{ writingMode: 'vertical-lr', direction: 'rtl', width: 40, height: 148 }} />
      </div>
      <div className="flex gap-1">
        {[8, 16].map((r) => (
          <button key={r} type="button" onClick={() => { (eng as any).setTempoRange(n, r); SK(n, 'p', 0, (x) => eng.setTempo(n, x)); buzz(); }}
            className={`text-[9px] font-black rounded-full px-1.5 py-1 border touch-manipulation ${st.range === r ? 'bg-[#FF5C00] text-black' : 'border-[#22222a] text-neutral-500'}`}>±{r}</button>
        ))}
        <button type="button" onClick={() => { (eng as any).setMasterTempo(n, !st.mt); buzz(); }}
          className={`text-[9px] font-black rounded-full px-1.5 py-1 border touch-manipulation ${st.mt ? 'bg-[#FF8A00] text-black' : 'border-[#22222a] text-neutral-500'}`}>MT</button>
      </div>
      <button type="button" onClick={() => SK(n, 'p', 0, (x) => eng.setTempo(n, x))} className="lbl text-neutral-500 border border-[#22222a] rounded-full px-2 py-1 touch-manipulation">reset</button>
    </div>
    );
  };

  const deckUI = (n: 0 | 1) => {
    const isFile = eng.hasFile[n];
    const tname = (eng as any).fileName ? (eng as any).fileName(n) : '';
    const uploaded = useTracks.getState().tracks.find((t) => t.name === tname);
    const hot: (number | null)[] = (eng as any).deckHot ? (eng as any).deckHot(n) : [null, null, null, null];
    const st: any = (eng as any).deckState ? (eng as any).deckState(n) : { loop: 0 };
    const jogTempo = (
      <>
        <Jog onNudge={(dx) => (eng as any).nudge?.(n, dx)} />
        {tempoCol(n)}
      </>
    );
    const hotTap = (i: number) => {
      buzz(); click();
      if (hot[i] != null) (eng as any).triggerHotCue(n, i);
      else (eng as any).setHotCue(n, i);
    };
    return (
      <div className="rounded-3xl border border-[#22222a] p-3 space-y-2" style={{ background: 'linear-gradient(180deg,#0d0e12 0%,#141418 100%)' }}>
        <div className="flex items-center justify-between gap-2">
          <p className="lbl font-black text-[#FF5C00] truncate">Deck {n + 1}{tname ? ` · ${tname}` : ''}</p>
          <span className={`shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full ${isFile ? 'bg-[#FF3D00] text-black' : 'bg-[#22222a] text-neutral-400'}`}>{isFile ? '● TRACK' : '○ DEMO'}</span>
        </div>
        {uploaded ? <WavePeaks peaks={uploaded.peaks} color="#FF8A00" height={64} /> : <Wave seed={n} />}
        {!isFile && <p className="text-[11px] text-neutral-500">Sube tracks en MIS TRACKS para practicar TRIM/GAIN.</p>}
        <div className="flex gap-3 items-center justify-center">
          {n === 0 ? jogTempo : <>{tempoCol(n)}<Jog onNudge={(dx) => (eng as any).nudge?.(n, dx)} /></>}
        </div>
        <div className="flex gap-2">
          <button type="button" aria-label={`Play deck ${n + 1}`} onClick={() => { buzz(); click(); if (eng.hasFile[n]) { try { useDaily.getState().bumpMixes(); } catch { /* noop */ } } eng.play(n); }} className={`${BTN} btn-pro flex-1 rounded-3xl bg-[#FF3D00] text-black font-black text-base`}>▶</button>
          <button type="button" aria-label={`Cue deck ${n + 1}`} onClick={() => { cueBuzz(); click(); eng.cue(n); }} className={`${BTN} btn-pro flex-1 rounded-3xl bg-[#FF3D00] text-white font-black text-base`}>CUE</button>
          <button type="button" aria-label={`Pause deck ${n + 1}`} onClick={() => { buzz(); eng.pause(n); }} className={`${BTN} flex-1 rounded-3xl border border-[#22222a] font-black text-base text-neutral-300`}>❚❚</button>
        </div>
        <div className="flex gap-1.5 justify-center">
          {[['VINYL', `v${n}`], ['SYNC', `s${n}`], ['QUANT', `q${n}`]].map(([l, k]) => (
            <button key={k} type="button" onClick={() => toggleLed(k)}
              className={`lbl font-black rounded-full px-2 py-1.5 border touch-manipulation active:scale-95 ${led(k) ? 'border-[#FF8A00] text-[#FF8A00]' : 'border-[#22222a] text-neutral-600'}`}>{l}</button>
          ))}
        </div>
        <div>
          <p className="lbl text-neutral-500 text-center mb-1">Hot cue · toca = dispara/graba · doble-click = borra</p>
          <div className="grid grid-cols-4 gap-1.5">
            {HOTPADS.map(([p, col], i) => (
              <button key={p} type="button" aria-label={`Hot cue ${p} deck ${n + 1}`}
                onClick={() => hotTap(i)} onDoubleClick={() => { (eng as any).deleteHotCue(n, i); buzz(); }}
                style={hot[i] != null ? { borderColor: col, color: col, background: col + '22', boxShadow: `0 0 12px ${col}` } : undefined}
                className={`${BTN} min-h-[48px] rounded-xl font-black text-sm border ${hot[i] != null ? '' : 'border-[#22222a] text-neutral-600'}`}>{p}</button>
            ))}
          </div>
        </div>
        <div>
          <p className="lbl text-neutral-500 text-center mb-1">Beat loop</p>
          <div className="grid grid-cols-6 gap-1">
            {LOOPS.map((b) => (
              <button key={b} type="button" onClick={() => { (eng as any).setBeatLoop(n, b); buzz(); click(); }}
                className={`${BTN} min-h-[44px] rounded-xl font-black text-xs border touch-manipulation ${st.loop === b ? 'bg-[#FF8A00] text-black' : 'border-[#22222a] text-neutral-400'}`}>{b}</button>
            ))}
            <button type="button" onClick={() => { (eng as any).reloopExit(n); buzz(); }} className={`${BTN} min-h-[44px] rounded-xl font-black text-[10px] border border-[#22222a] text-neutral-300 touch-manipulation col-span-2`}>EXIT</button>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-2">
          <Knob label="Trim" min={0} max={1.2} value={K(n, 't', 0.8)} reset={0.8} onChange={(v: number) => SK(n, 't', v, (x) => eng.setTrim(n, x))} />
          <Knob label="Hi" min={0} max={1} value={K(n, 'h', 0.75)} reset={0.75} color="#FF8A00" onChange={(v: number) => SK(n, 'h', v, (x) => eng.setEQ(n, 'high', x))} />
          <Knob label="Mid" min={0} max={1} value={K(n, 'm', 0.75)} reset={0.75} color="#FF8A00" onChange={(v: number) => SK(n, 'm', v, (x) => eng.setEQ(n, 'mid', x))} />
          <Knob label="Low" min={0} max={1} value={K(n, 'l', 0.75)} reset={0.75} color="#FF8A00" onChange={(v: number) => SK(n, 'l', v, (x) => eng.setEQ(n, 'low', x))} />
          <Knob label="Color" min={-1} max={1} value={K(n, 'c', 0)} reset={0} color="#FF3D00" onChange={(v: number) => SK(n, 'c', v, (x) => eng.setColor(n, x))} />
        </div>
        <div className="grid grid-cols-4 gap-1">
          {COLORS.map((ct) => (
            <button key={ct} type="button" onClick={() => { (eng as any).setColorFX(n, ct); buzz(); }}
              className="lbl font-black rounded-lg border border-[#22222a] text-neutral-500 px-1 py-2 touch-manipulation active:scale-95">{ct.split(' ')[0]}</button>
          ))}
        </div>
        <div className="flex gap-3 items-start justify-center">
          <VFader label={`CH${n + 1}`} min={0} max={1} step={0.01} value={K(n, 'f', 0.9)} onChange={(v: number) => SK(n, 'f', v, (x) => eng.setFader(n, x))} />
          <div className="flex flex-col items-center gap-1">
            <span className="lbl text-neutral-400">Nivel</span>
            <Meter value={lv.deck[n]} />
          </div>
        </div>
      </div>
    );
  };

  const mixerUI = (
    <div className="rounded-3xl border border-[#22222a] p-3 space-y-2 text-center" style={{ background: 'linear-gradient(180deg,#0d0e12 0%,#141418 100%)' }}>
      <p className="lbl font-black text-[#FF5C00]">Mixer</p>
      <div className="flex justify-center gap-3"><div><p className="lbl text-neutral-500">CH1</p><Meter value={lv.deck[0]} /></div><div><p className="lbl text-neutral-500">MST</p><Meter value={lv.master} /></div><div><p className="lbl text-neutral-500">CH2</p><Meter value={lv.deck[1]} /></div></div>
      <div className="mx-auto w-full" style={{ width: 'clamp(140px, 60vw, 200px)', maxWidth: '100%' }}><Slider label="Crossfader" min={0} max={1} step={0.01} value={xf} onChange={(v: number) => { setXf(v); eng.setCrossfader(v); }} /></div>
      <div className="rounded-2xl border border-[#22222a] bg-black/40 p-2">
        <p className="lbl text-neutral-500">Beat FX · {fxSel}</p>
        <div className="flex gap-1 mt-1">
          <button type="button" aria-label="FX anterior" onClick={() => { const i = (FXS.indexOf(fxSel) + FXS.length - 1) % FXS.length; setFxSel(FXS[i]); (eng as any).setBeatFX(FXS[i], fxLvl, 0.375); buzz(); }} className="flex-1 min-h-[44px] rounded-xl border border-[#22222a] font-black touch-manipulation">◀</button>
          <button type="button" onClick={() => { const v = !fxOn; setFxOn(v); if (v) (eng as any).setBeatFX(fxSel, fxLvl, 0.375); (eng as any).fxOnOff(v); buzz(); }}
            className={`flex-[2] min-h-[48px] rounded-2xl font-black text-sm touch-manipulation active:scale-95 ${fxOn ? 'bg-[#FF5C00] text-black' : 'border border-[#FF5C00] text-[#FF5C00]'}`}>{fxOn ? '● ON' : '○ OFF'}</button>
          <button type="button" aria-label="FX siguiente" onClick={() => { const i = (FXS.indexOf(fxSel) + 1) % FXS.length; setFxSel(FXS[i]); (eng as any).setBeatFX(FXS[i], fxLvl, 0.375); buzz(); }} className="flex-1 min-h-[44px] rounded-xl border border-[#22222a] font-black touch-manipulation">▶</button>
        </div>
        <Slider label="FX Level" min={0} max={1} step={0.01} value={fxLvl} onChange={(v: number) => { setFxLvl(v); if (fxOn) (eng as any).setBeatFX(fxSel, v, 0.375); }} />
      </div>
      <div className="flex justify-center"><Knob label="Master" min={0} max={1.2} value={master} reset={0.9} color="#FF3D00" onChange={(v: number) => { setMaster(v); eng.setMaster(v); }} /></div>
    </div>
  );

  /* ===== CONSOLA 1:1 — réplica fiel escalada (nunca apiñada) ===== */
  const deckC = (n: 0 | 1) => {
    const hot8: (number | null)[] = (eng as any).deckHot ? (eng as any).deckHot(n) : [];
    const stc: any = (eng as any).deckState ? (eng as any).deckState(n) : { loop: 0 };
    return (
      <div className="rounded-2xl border border-[#22222a] p-2 space-y-1.5 min-h-0 overflow-hidden" style={{ background: 'linear-gradient(180deg,#0d0e12,#141418)' }}>
        <div className="flex items-center justify-center gap-2">
          <Jog onNudge={(dx) => (eng as any).nudge?.(n, dx)} />
        </div>
        <div className="flex gap-1">
          <button type="button" onClick={() => { buzz(); click(); eng.play(n); }} className="flex-1 min-h-[44px] rounded-xl bg-[#FF3D00] text-black font-black text-sm touch-manipulation active:scale-95">▶</button>
          <button type="button" onClick={() => { cueBuzz(); click(); eng.cue(n); }} className="flex-1 min-h-[44px] rounded-xl bg-[#FF3D00] text-white font-black text-sm touch-manipulation active:scale-95">CUE</button>
          <button type="button" onClick={() => { buzz(); eng.pause(n); }} className="flex-1 min-h-[44px] rounded-xl border border-[#22222a] font-black text-sm text-neutral-300 touch-manipulation">❚❚</button>
        </div>
        <div className="grid grid-cols-8 gap-1">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <button key={i} type="button" aria-label={`Hot ${i + 1} deck ${n + 1}`}
              onClick={() => { buzz(); if (hot8[i] != null) (eng as any).triggerHotCue(n, i); else (eng as any).setHotCue(n, i); }}
              onDoubleClick={() => { (eng as any).deleteHotCue(n, i); buzz(); }}
              style={hot8[i] != null ? { borderColor: '#FF5C00', color: '#FF5C00', background: '#FF5C0022', boxShadow: '0 0 10px #FF5C00' } : undefined}
              className="min-h-[36px] rounded-lg border border-[#22222a] text-neutral-600 font-black text-xs touch-manipulation active:scale-95">{i + 1}</button>
          ))}
        </div>
        <Slider label="Tempo" min={-8} max={8} step={0.1} value={K(n, 'p', 0)} onChange={(v: number) => SK(n, 'p', v, (x) => eng.setTempo(n, x))} />
        <div className="grid grid-cols-5 gap-1">
          {[1, 2, 4, 8].map((b) => (
            <button key={b} type="button" onClick={() => { (eng as any).setBeatLoop(n, b); buzz(); }}
              className={`min-h-[36px] rounded-lg text-xs font-black border touch-manipulation ${stc.loop === b ? 'bg-[#FF8A00] text-black' : 'border-[#22222a] text-neutral-400'}`}>{b}</button>
          ))}
          <button type="button" onClick={() => { (eng as any).reloopExit(n); buzz(); }} className="min-h-[36px] rounded-lg text-[10px] font-black border border-[#22222a] text-neutral-300 touch-manipulation">EXIT</button>
        </div>
        <div className="flex justify-center gap-2">
          <Knob label="Trim" min={0} max={1.2} value={K(n, 't', 0.8)} reset={0.8} onChange={(v: number) => SK(n, 't', v, (x) => eng.setTrim(n, x))} />
          <Knob label="Hi" min={0} max={1} value={K(n, 'h', 0.75)} reset={0.75} color="#FF8A00" onChange={(v: number) => SK(n, 'h', v, (x) => eng.setEQ(n, 'high', x))} />
          <Knob label="Mid" min={0} max={1} value={K(n, 'm', 0.75)} reset={0.75} color="#FF8A00" onChange={(v: number) => SK(n, 'm', v, (x) => eng.setEQ(n, 'mid', x))} />
          <Knob label="Low" min={0} max={1} value={K(n, 'l', 0.75)} reset={0.75} color="#FF8A00" onChange={(v: number) => SK(n, 'l', v, (x) => eng.setEQ(n, 'low', x))} />
        </div>
      </div>
    );
  };

  const mixerC = (
    <div className="rounded-2xl border border-[#22222a] p-2 space-y-1.5 text-center min-h-0 overflow-hidden" style={{ background: 'linear-gradient(180deg,#0d0e12,#141418)' }}>
      <p className="lbl font-black text-[#FF5C00]">Mixer</p>
      <div className="flex justify-center gap-2">
        <div><p className="lbl text-neutral-500">1</p><Meter value={lv.deck[0]} /></div>
        <div><p className="lbl text-neutral-500">M</p><Meter value={lv.master} /></div>
        <div><p className="lbl text-neutral-500">2</p><Meter value={lv.deck[1]} /></div>
      </div>
      <Slider label="CH1" min={0} max={1} step={0.01} value={K(0, 'f', 0.9)} onChange={(v: number) => SK(0, 'f', v, (x) => eng.setFader(0, x))} />
      <Slider label="CH2" min={0} max={1} step={0.01} value={K(1, 'f', 0.9)} onChange={(v: number) => SK(1, 'f', v, (x) => eng.setFader(1, x))} />
      <Slider label="Xfade" min={0} max={1} step={0.01} value={xf} onChange={(v: number) => { setXf(v); eng.setCrossfader(v); }} />
      <div className="flex justify-center"><Knob label="Master" min={0} max={1.2} value={master} reset={0.9} color="#FF3D00" onChange={(v: number) => { setMaster(v); eng.setMaster(v); }} /></div>
      <div className="flex gap-1 items-center justify-center">
        <button type="button" onClick={() => { const i = (FXS.indexOf(fxSel) + 1) % FXS.length; setFxSel(FXS[i]); (eng as any).setBeatFX(FXS[i], fxLvl, 0.375); buzz(); }} className="text-[10px] font-black text-[#FF5C00] truncate">FX:{fxSel}</button>
        <button type="button" onClick={() => { const v = !fxOn; setFxOn(v); if (v) (eng as any).setBeatFX(fxSel, fxLvl, 0.375); (eng as any).fxOnOff(v); buzz(); }}
          className={`min-h-[44px] px-3 rounded-xl font-black text-xs touch-manipulation ${fxOn ? 'bg-[#FF5C00] text-black' : 'border border-[#FF5C00] text-[#FF5C00]'}`}>{fxOn ? '●' : '○'}</button>
      </div>
    </div>
  );

  const consoleView = (
    <div ref={fitRef} className="w-full overflow-hidden" style={{ height: Math.max(200, 533 * cs) }}>
      <div className="xdj-rr-container" style={{ width: 1280, height: 533, transform: `scale(${cs})`, transformOrigin: 'top left' }}>
        <div style={{ gridColumn: '1 / -1' }} className="flex gap-2 items-stretch">
          <div className="flex-1 min-w-0"><ScreenStrip eng={eng} /></div>
          <div className="rounded-2xl border border-[#22222a] bg-black/60 px-3 py-1 flex items-center gap-2 shrink-0">
            <button type="button" aria-label="Browser anterior" onClick={() => { setBrowseIdx((i) => (i + trackNames.length - 1) % trackNames.length); buzz(); }} className="min-h-[44px] min-w-[44px] rounded-xl border border-[#22222a] font-black touch-manipulation">◀</button>
            <div className="w-40">
              <p className="lbl text-neutral-500">Browse</p>
              <p className="mono text-[11px] text-[#FF8A00] truncate">{browseName}</p>
            </div>
            <button type="button" aria-label="Browser siguiente" onClick={() => { setBrowseIdx((i) => (i + 1) % trackNames.length); buzz(); }} className="min-h-[44px] min-w-[44px] rounded-xl border border-[#22222a] font-black touch-manipulation">▶</button>
            <button type="button" onClick={() => browseLoad(0)} className="min-h-[44px] px-2 rounded-xl border border-[#FF5C00] text-[#FF5C00] text-xs font-black touch-manipulation">LOAD1</button>
            <button type="button" onClick={() => browseLoad(1)} className="min-h-[44px] px-2 rounded-xl border border-[#FF5C00] text-[#FF5C00] text-xs font-black touch-manipulation">LOAD2</button>
          </div>
        </div>
        {deckC(0)}
        {mixerC}
        {deckC(1)}
      </div>
    </div>
  );

  if (practice) return <MobilePracticeMode eng={eng} onExit={() => setPractice(false)} />;

  return (
    <div className="simulator-wrapper pb-24">
      <div className="sim-chrome"><ScreenStrip eng={eng} /></div>
      {rrMode && <div className="sim-chrome mb-2 rounded-2xl border border-[#FF5C00]/50 bg-[#FF5C00]/10 p-3 text-sm"><b className="text-[#FF5C00]">RR DELANTE ON:</b> replica cada gesto en tu RR real.</div>}
      {focusName && <div className="sim-chrome mb-2 rounded-2xl border border-[#FF5C00]/50 bg-[#FF5C00]/5 p-3 text-sm">🎯 <b className="text-[#FF5C00]">Practicando: {focusName}</b> <span className="text-neutral-400">— venido desde su ficha. Toca los controles equivalentes aquí.</span></div>}
      {!rrMode && <div className="sim-chrome mb-2 rounded-2xl border border-[#22222a] bg-[#0d0e12] p-3 text-xs text-neutral-400">🖐 <b className="text-neutral-200">Guía de manos (sin RR delante):</b> izquierda → Jog + Tempo Deck 1 · derecha → Jog + fader Deck 2 · pulgares → PLAY/CUE · mezcla con CROSSFADER al centro.</div>}
      <Suspense fallback={<p className="sim-chrome text-xs text-neutral-500">Cargando uploader...</p>}>
        <div className="sim-chrome"><TrackUploader eng={eng} /></div>
      </Suspense>
      <div className="sim-chrome flex gap-2 mb-2">
        <button type="button" onClick={() => setPractice(true)} className={`${BTN} px-4 py-2 rounded-full bg-[#FF5C00] text-black text-sm font-black btn-pro-violet`}>📱 MODO PRÁCTICA CELULAR</button>
        <button type="button" onClick={() => setMode((m) => (m === 'consola' ? 'tactil' : 'consola'))}
          className="px-4 py-2 rounded-full border border-[#FF8A00] text-[#FF8A00] text-sm font-black touch-manipulation active:scale-95 min-h-[56px] lg:min-h-[44px]">
          {mode === 'consola' ? '◧ TÁCTIL' : '🎛 CONSOLA 1:1'}
        </button>
      </div>
      {mode === 'consola' ? consoleView : (<></>)}
      {mode === 'tactil' && (
      <>
      <div className="sim-tabs tabs-mobile md:hidden border border-[#22222a] rounded-2xl flex gap-1.5 mb-2 py-2 px-2 bg-[#070707]">
        {(['d1', 'mix', 'd2'] as const).map((t) => (
          <button type="button" key={t} onClick={() => setMobileTab(t)} aria-label={`Ver ${t}`} className={`${BTN} flex-1 px-2 py-3 rounded-2xl text-xs font-black ${mobileTab === t ? 'bg-[#FF5C00] text-black' : 'border border-[#22222a] text-neutral-400'}`}>{t === 'd1' ? 'DECK 1' : t === 'mix' ? 'MIXER' : 'DECK 2'}</button>
        ))}
      </div>
      <div className="sim-mobile md:hidden overflow-hidden"
        onTouchStart={(e) => { swipeX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => { if (swipeX.current != null) onSwipeEnd(e.changedTouches[0].clientX - swipeX.current); swipeX.current = null; }}
      >
        {mobileTab === 'd1' && deckUI(0)}
        {mobileTab === 'mix' && mixerUI}
        {mobileTab === 'd2' && deckUI(1)}
      </div>
      <div className="sim-desktop hidden md:grid gap-3 md:grid-cols-2 lg:grid-cols-[1fr_320px_1fr] overflow-hidden">
        {deckUI(0)}
        {deckUI(1)}
        <div className="md:col-span-2 lg:col-span-1">{mixerUI}</div>
      </div>
      </>
      )}
    </div>
  );
}

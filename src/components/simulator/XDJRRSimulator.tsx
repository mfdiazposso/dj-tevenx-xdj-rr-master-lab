import { useCallback, useEffect, useRef, useState } from 'react';
import { useAudioEngine } from '../../hooks/useAudioEngine';
import { controls } from '../../data/controls';
import { useProgress } from '../../store/progress';
import { useTracks } from '../../store/tracks';
import { useDaily } from '../../store/daily';
import MobilePracticeMode from './MobilePracticeMode';
import TrackUploader from '../uploader/TrackUploader'; // EAGER: nada de lazy/Suspense en el simulador

type Eng = ReturnType<typeof useAudioEngine>;

const BTN = 'touch-manipulation select-none relative z-10 active:scale-90 transition-all';

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
function Knob({ label, min, max, value, onChange, color = '#FF5C00', reset, size = 'md', ring }: any) {
  const drag = useRef<{ y: number; v: number } | null>(null);
  const pct = Math.min(1, Math.max(0, (value - min) / (max - min)));
  const ang = -135 + pct * 270;
  const box = size === 'sm' ? 'h-10 w-10 lg:h-11 lg:w-11' : 'h-12 w-12 lg:h-14 lg:w-14';
  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <div role="slider" aria-label={label} aria-valuenow={Math.round(value * 100)} tabIndex={0}
        className={`relative ${box} rounded-full touch-none cursor-ns-resize focus:ring-1 focus:ring-[#FF5C00]`}
        style={{ background: 'radial-gradient(circle at 35% 30%, #3A3F4A, #1E2129 70%)', boxShadow: `4px 4px 10px rgba(0,0,0,.65), -2px -2px 6px rgba(255,255,255,.09), inset 2px 2px 5px rgba(0,0,0,.65), 0 0 12px ${ring || color}33` }}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { y: e.clientY, v: value }; e.preventDefault(); }}
        onPointerMove={(e) => { if (e.buttons === 1 && drag.current) { const dv = ((drag.current.y - e.clientY) / 120) * (max - min); const nv = Math.min(max, Math.max(min, drag.current.v + dv)); onChange(Math.round(nv * 100) / 100); } }}
        onDoubleClick={() => { if (reset !== undefined) onChange(reset); }}
        onKeyDown={(e) => { const s = (max - min) / 20; if (e.key === 'ArrowUp') onChange(Math.min(max, value + s)); if (e.key === 'ArrowDown') onChange(Math.max(min, value - s)); }}
      >
        <div className="absolute inset-0 pointer-events-none" style={{ transform: `rotate(${ang}deg)` }}>
          <div className="absolute left-1/2 top-[12%] h-[22%] w-[3px] -translate-x-1/2 rounded" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
        </div>
        <div className="absolute inset-[30%] rounded-full pointer-events-none" style={{ background: '#070707' }} />
      </div>
      <span className="lbl text-neutral-400 text-[9px] lg:text-[10px]">{label}</span>
    </div>
  );
}

function Slider({ label, min, max, step, value, onChange, suffix = '%' }: any) {
  return (
    <label className="block text-[11px] text-neutral-400 touch-manipulation">
      {label} <span className="text-[#FF5C00] font-bold font-mono">{typeof value === 'number' ? Math.round(value * 100) + suffix : ''}</span>
      <input type="range" aria-label={label} min={min} max={max} step={step} value={value}
        onInput={(e) => onChange(Number((e.target as HTMLInputElement).value))}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#FF5C00] h-10 lg:h-8" />
    </label>
  );
}

/* Fader vertical con carril estilo hardware */
function VFader({ label, min, max, step, value, onChange, height = 120 }: any) {
  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <span className="lbl text-neutral-400 text-[9px]">{label}</span>
      <div className="hw-rail rounded-lg flex items-center justify-center py-2" style={{ height, width: 46 }}>
        <input type="range" aria-label={label} min={min} max={max} step={step} value={value}
          onInput={(e) => onChange(Number((e.target as HTMLInputElement).value))}
          onChange={(e) => onChange(Number(e.target.value))}
          className="accent-[#FF5C00] touch-manipulation" style={{ writingMode: 'vertical-lr', direction: 'rtl', width: 36, height: height - 20 }} />
      </div>
      <span className="mono text-[10px] text-[#FF5C00]">{Math.round(value * 100)}%</span>
    </div>
  );
}

/* Vúmetro vivo aislado: actualiza el DOM por ref, sin re-renderizar el árbol */
function LiveMeter({ get, tall, label }: { get: () => number; tall?: boolean; label?: string }) {
  const bar = useRef<HTMLDivElement>(null);
  const getRef = useRef(get);
  getRef.current = get;
  useEffect(() => {
    const id = setInterval(() => {
      const el = bar.current;
      if (!el) return;
      const v = Math.min(1, Math.max(0, getRef.current()));
      const pct = Math.round(v * 100);
      el.style.height = `${pct}%`;
      el.className = pct > 90 ? 'bg-[#FF3D00]' : pct > 70 ? 'bg-[#FF5C00]' : 'bg-[#FF8A00]';
    }, 150);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`${tall ? 'w-2.5 h-32' : 'w-3.5 h-28'} rounded-sm border border-[#3A3F4A] flex flex-col justify-end overflow-hidden`}
        style={{ background: 'repeating-linear-gradient(0deg,#12141a 0 3px,#0b0c10 3px 5px)' }}>
        <div ref={bar} style={{ height: '0%' }} />
      </div>
      {label && <span className="lbl text-[9px] text-neutral-500">{label}</span>}
    </div>
  );
}

/* Jog con anillo metálico: gira mientras el deck reproduce */
function Jog({ onNudge, spinning }: { onNudge: (dx: number) => void; spinning?: boolean }) {
  const lastX = useRef(0);
  const mark = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!spinning) return;
    let raf = 0; let a = 0; let last = performance.now();
    const loop = (t: number) => { a = (a + (t - last) * 0.16) % 360; last = t; if (mark.current) mark.current.style.transform = `rotate(${a}deg)`; raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [spinning]);
  return (
    <div role="slider" aria-label="Jog wheel" tabIndex={0}
      className="jog jog-pro mx-auto h-28 w-28 sm:h-28 sm:w-28 lg:h-[180px] lg:w-[180px] rounded-full cursor-grab active:cursor-grabbing flex items-center justify-center select-none focus:ring-1 focus:ring-[#FF5C00] touch-none"
      style={{ background: 'radial-gradient(circle at 38% 32%, #343A46 0%, #1B1E26 42%, #0c0d11 78%)', border: '7px solid #3A3F4A', outline: '2px solid rgba(255,92,0,.35)', boxShadow: '0 0 26px rgba(255,92,0,.22), inset 0 0 24px rgba(0,0,0,.7)' }}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); lastX.current = e.clientX; e.preventDefault(); }}
      onPointerMove={(e) => { if (e.buttons === 1) { onNudge(e.clientX - lastX.current); lastX.current = e.clientX; } }}
      onPointerUp={(e) => { try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ } }}
      onPointerCancel={(e) => { try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ } }}
    >
      <div className="relative rounded-full flex items-center justify-center h-[46%] w-[46%]"
        style={{ background: 'radial-gradient(circle at 40% 35%, #3A3F4A, #0d0e12 75%)', boxShadow: 'inset 2px 2px 6px rgba(0,0,0,.7)' }}>
        <div ref={mark} className="absolute inset-0 pointer-events-none">
          <span className="absolute left-1/2 top-[3px] h-2 w-[3px] -translate-x-1/2 rounded bg-[#FF5C00]" style={{ boxShadow: '0 0 8px #FF5C00' }} />
        </div>
        <span className="mono text-[8px] lg:text-[10px] text-neutral-300 pointer-events-none relative z-10">XDJ-RR</span>
      </div>
    </div>
  );
}

/* Onda del deck: peaks fijos + playhead que se actualiza solo */
function DeckWave({ eng, n, height = 54 }: { eng: Eng; n: 0 | 1; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLDivElement>(null);
  const fileName = (eng as any).fileName ? (eng as any).fileName(n) : '';
  const uploaded = useTracks((s) => s.tracks.find((t) => t.name === fileName));

  const draw = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const w = c.clientWidth || 300; const h = c.clientHeight || height;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.max(1, Math.round(w * dpr)); c.height = Math.max(1, Math.round(h * dpr));
    const g = c.getContext('2d'); if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(w / 2, 0, 1, h);
    const bars = Math.max(1, Math.floor(w / 3));
    const peaks = uploaded?.peaks;
    const mid = h / 2;
    for (let i = 0; i < bars; i++) {
      const v = peaks && peaks.length
        ? peaks[Math.floor((i / bars) * peaks.length)]
        : 0.22 + Math.abs(Math.sin(i * 0.33 + n * 4)) * 0.62;
      const bh = Math.max(2, v * (h - 6));
      g.fillStyle = i % 2 ? '#FF7A1A' : '#FF5C00';
      g.fillRect(i * 3, mid - bh / 2, 2, bh);
    }
  }, [height, n, uploaded]);

  useEffect(() => { draw(); }, [draw]);
  useEffect(() => {
    const onR = () => draw();
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, [draw]);
  useEffect(() => {
    const id = setInterval(() => {
      const dur = (eng as any).trackInfo?.(n)?.duration || 0;
      const pos = (eng as any)._pos ? (eng as any)._pos(n) : 0;
      const p = dur ? Math.min(100, (pos / dur) * 100) : 0;
      if (headRef.current) headRef.current.style.left = `${p}%`;
      if (fileRef.current) fileRef.current.style.width = `${p}%`;
    }, 150);
    return () => clearInterval(id);
  }, [eng, n]);

  return (
    <div className="deck-wave relative rounded-xl overflow-hidden bg-black border border-[#22222a]" style={{ height }}>
      <canvas ref={canvasRef} className="waveform absolute inset-0 w-full h-full" />
      <div ref={fileRef} className="absolute inset-y-0 left-0 pointer-events-none" style={{ width: '0%', background: 'linear-gradient(90deg, rgba(255,92,0,.28), rgba(255,92,0,.06))' }} />
      <div ref={headRef} className="absolute inset-y-0 w-[2px] bg-white pointer-events-none" style={{ left: '0%', boxShadow: '0 0 8px #fff' }} />
      <span className="absolute inset-0 flex items-center justify-center mono text-[9px] text-white/25 pointer-events-none">WAVEFORM</span>
    </div>
  );
}

/* Pantalla central 7" estilo XDJ-RR real: wave + BPM + KEY + tiempo + HOT CUE A-H + LOOP */
const HC_COLORS = ['#FF5C00', '#FF8A00', '#FFD600', '#00FFD1', '#00D4FF', '#7C4DFF', '#FF3D00', '#ff1744'];
function ScreenStrip({ eng, onUpload }: { eng: Eng; onUpload: () => void }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, []);
  const side = (n: 0 | 1) => {
    const st: any = (eng as any).deckState ? (eng as any).deckState(n) : {};
    const name = (eng as any).fileName ? (eng as any).fileName(n) : '';
    const hot: (number | null)[] = (eng as any).deckHot ? (eng as any).deckHot(n) : [];
    return (
      <div className={`min-w-0 ${n === 1 ? 'text-right' : ''}`}>
        <p className="mono text-[10px] text-[#FF8A00] truncate">{name || (n === 0 ? 'DECK 1 · demo osc' : 'demo osc · DECK 2')}</p>
        <p className="mono font-black text-white leading-tight">
          {st.bpm || '---'} <span className="text-[10px] text-neutral-400 font-normal">{st.pitch}% · {st.time}</span>
        </p>
        <p className="mono text-[9px] text-[#00D4FF]">KEY {st.key ?? '+0.0'}{st.mt ? ' · MT' : ''}{st.slip ? ' · SLIP' : ''}</p>
        {/* HOT CUE A-H: punto relleno = guardado (como la pantalla real) */}
        <div className={`flex gap-[3px] ${n === 1 ? 'justify-end' : ''} mt-0.5`}>
          {'ABCDEFGH'.split('').map((L, i) => (
            <span key={L} aria-label={`Hot cue ${L} ${hot[i] != null ? 'guardado' : 'vacío'}`}
              className="mono text-[8px] px-[3px] rounded-sm"
              style={hot[i] != null
                ? { background: HC_COLORS[i], color: '#000', boxShadow: `0 0 6px ${HC_COLORS[i]}` }
                : { color: '#3a3f4a', border: '1px solid #22222a' }}>{L}</span>
          ))}
        </div>
        {st.loop ? <p className="mono text-[9px] text-[#00FFD1]">● LOOP {st.loop} BEATS</p> : null}
      </div>
    );
  };
  return (
    <div className="sim-screen rounded-2xl hairline-neon bg-black p-2 grid grid-cols-[1fr_auto_1fr] gap-2 items-center"
      style={{ boxShadow: 'inset 0 0 26px rgba(255,92,0,.18), 0 0 18px rgba(255,92,0,.14)' }}>
      {side(0)}
      <div className="sim-screen-mid text-center px-2 flex flex-col items-center gap-1">
        <p className="lbl text-[#FF5C00] font-black">XDJ-RR</p>
        <p className="mono text-[9px] text-neutral-500">{eng.playing[0] ? '▶' : '❚❚'} {eng.playing[1] ? '▶' : '❚❚'}</p>
        <button type="button" onClick={onUpload} aria-label="Abrir MIS TRACKS"
          className="min-h-[34px] px-3 rounded-full border border-[#FF5C00] text-[#FF5C00] text-[10px] font-black touch-manipulation active:scale-95 hover:bg-[#FF5C00]/15">📁 USB</button>
      </div>
      {side(1)}
    </div>
  );
}

export default function Simulator({ focusId, pickToken, onExit }: { focusId?: string | null; pickToken?: number; onExit?: () => void }) {
  const eng = useAudioEngine();
  const { rrMode } = useProgress();
  const levels = useRef({ deck: [0, 0] as [number, number], master: 0 });
  const readDeck0 = useCallback(() => levels.current.deck[0], []);
  const readDeck1 = useCallback(() => levels.current.deck[1], []);
  const readMaster = useCallback(() => levels.current.master, []);
  useEffect(() => {
    const id = setInterval(() => { levels.current = eng.getLevels(); }, 150);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [xf, setXf] = useState(0.5); const [master, setMaster] = useState(0.9);
  const [mobileTab, setMobileTab] = useState<'d1' | 'mix' | 'd2'>('mix');
  const [practice, setPractice] = useState(false);
  const [browseIdx, setBrowseIdx] = useState(0);
  const [tracksOpen, setTracksOpen] = useState(false);
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

  // "SUBIR TRACKS" del header → panel + selector de archivos
  const lastPick = useRef(0);
  const [autoPick, setAutoPick] = useState(false);
  useEffect(() => {
    if (pickToken && pickToken !== lastPick.current) { lastPick.current = pickToken; setAutoPick(true); setTracksOpen(true); }
  }, [pickToken]);
  const closeTracks = () => { setTracksOpen(false); setAutoPick(false); };

  const [knobs, setKnobs] = useState<Record<string, number>>({});
  const [leds, setLeds] = useState<Record<string, boolean>>({ v0: true, v1: true, q0: true, q1: true });
  const [fxSel, setFxSel] = useState('ECHO');
  const [fxOn, setFxOn] = useState(false);
  const [fxLvl, setFxLvl] = useState(0.5);
  const [tapBpm, setTapBpm] = useState(0);
  const FXS = ['DELAY', 'ECHO', 'SPIRAL', 'REVERB', 'TRANS', 'FLANGER', 'PITCH', 'ROLL'];
  const COLORS = ['DUB ECHO', 'SWEEP', 'FILTER', 'NOISE'];
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

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('XDJRR MOUNTED');
  }, []);

  // REGLA #1: SOLO el simulador pide landscape. Falla silenciosa fuera de fullscreen
  // (requisito del navegador); el fallback CSS de portrait ya lo cubre.
  useEffect(() => {
    try {
      const orient = (screen as any)?.orientation;
      orient?.lock?.('landscape')?.catch?.(() => { /* no soportado: ok */ });
    } catch { /* noop */ }
    return () => {
      try { (screen as any)?.orientation?.unlock?.(); } catch { /* noop */ }
    };
  }, []);

  const showDebug = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug');

  const K = (d: 0 | 1, k: string, def: number) => knobs[`${d}${k}`] ?? def;
  const SK = (d: 0 | 1, k: string, v: number, fn: (v: number) => void) => { setKnobs((s) => ({ ...s, [`${d}${k}`]: v })); fn(v); };
  const buzz = () => { if (navigator.vibrate) navigator.vibrate(10); };
  const cueBuzz = () => { if (navigator.vibrate) navigator.vibrate(50); };

  // Teclado: SPACE=PLAY/PAUSE · C=CUE · 1-4=HOT CUE deck 1
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.code === 'Space') { e.preventDefault(); if (eng.playing[0]) eng.pause(0); else eng.play(0); }
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
    const RANGES: Array<[string, number]> = [['±6', 6], ['±10', 10], ['±16', 16], ['WIDE', 100]];
    return (
      <div className="flex flex-col items-center gap-1 select-none">
        <span className="lbl text-neutral-400 text-[9px]">Tempo</span>
        <div className="hw-rail rounded-lg flex items-center justify-center py-2" style={{ height: 150, width: 46 }}>
          <input aria-label={`Tempo deck ${n + 1}`} type="range" min={-(st.range ?? 8)} max={st.range ?? 8} step={0.1} value={K(n, 'p', 0)}
            onInput={(e) => SK(n, 'p', Number((e.target as HTMLInputElement).value), (x) => eng.setTempo(n, x))}
            onChange={(e) => SK(n, 'p', Number(e.target.value), (x) => eng.setTempo(n, x))}
            className="accent-[#FF5C00] touch-manipulation" style={{ writingMode: 'vertical-lr', direction: 'rtl', width: 36, height: 130 }} />
        </div>
        <div className="grid grid-cols-2 gap-1">
          {RANGES.map(([l, r]) => (
            <button key={l} type="button" onClick={() => { (eng as any).setTempoRange(n, r); SK(n, 'p', 0, (x) => eng.setTempo(n, x)); buzz(); }}
              className={`text-[9px] font-black rounded-full px-1.5 py-1 min-h-[26px] border touch-manipulation ${st.range === r ? 'bg-[#FF5C00] text-black border-[#FF5C00]' : 'border-[#22222a] text-neutral-500 hover:border-[#FF5C00]'}`}>{l}</button>
          ))}
        </div>
        <button type="button" onClick={() => { (eng as any).setMasterTempo(n, !st.mt); buzz(); }}
          className={`w-full text-[9px] font-black rounded-full px-1.5 py-1 min-h-[26px] border touch-manipulation ${st.mt ? 'bg-[#FF8A00] text-black border-[#FF8A00]' : 'border-[#22222a] text-neutral-500 hover:border-[#FF5C00]'}`}>MASTER TEMPO</button>
        <button type="button" onClick={() => SK(n, 'p', 0, (x) => eng.setTempo(n, x))} className="lbl text-neutral-500 border border-[#22222a] rounded-full px-2 py-1 min-h-[26px] touch-manipulation hover:border-[#FF5C00] hover:text-[#FF5C00]">reset</button>
      </div>
    );
  };

  const deckUI = (n: 0 | 1, cls = '') => {
    const isFile = eng.hasFile[n];
    const tname = (eng as any).fileName ? (eng as any).fileName(n) : '';
    const hot: (number | null)[] = (eng as any).deckHot ? (eng as any).deckHot(n) : [];
    const st: any = (eng as any).deckState ? (eng as any).deckState(n) : { loop: 0 };
    const playing = eng.playing[n];
    const hotTap = (i: number) => {
      buzz(); click();
      if (hot[i] != null) (eng as any).triggerHotCue(n, i);
      else (eng as any).setHotCue(n, i);
    };
    // 8 pads A-H como la XDJ-RR real, cada uno con su color
    const pad = (i: number) => {
      const L = 'ABCDEFGH'[i];
      const on = hot[i] != null;
      return (
        <button key={L} type="button" aria-label={`Hot cue ${L} deck ${n + 1}`}
          onClick={() => hotTap(i)} onDoubleClick={() => { (eng as any).deleteHotCue(n, i); buzz(); }}
          style={on ? { borderColor: HC_COLORS[i], color: '#000', background: HC_COLORS[i], boxShadow: `0 0 16px ${HC_COLORS[i]}aa` } : undefined}
          className={`${BTN} min-h-[44px] rounded-lg font-black text-sm border font-mono ${on ? '' : 'border-[#3A3F4A] text-[#FF9A3C] bg-[#171a21] hover:border-[#FF5C00] hover:text-[#FF5C00] hover:shadow-[0_0_14px_rgba(255,92,0,.35)]'}`}>{L}</button>
      );
    };
    return (
      <div className={`hw-panel rounded-2xl p-2.5 lg:p-3 space-y-2 min-w-0 flex flex-col ${cls}`}>
        <div className="flex items-center justify-between gap-2">
          <p className="lbl font-black text-[#FF5C00] truncate">Deck {n + 1}{tname ? ` · ${tname}` : ''}</p>
          <span className={`shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full font-mono ${isFile ? 'bg-[#FF3D00] text-black' : 'bg-[#22222a] text-neutral-400'}`}>{isFile ? '● TRACK' : '○ DEMO'}</span>
        </div>
        {/* Display de carga estilo real: "CARGADO EN DECK 1: archivo" / "NO TRACK" */}
        <div className="rounded-lg border border-[#22222a] bg-black px-2 py-1 min-h-[28px] flex items-center">
          <p className={`mono text-[10px] truncate ${isFile ? 'text-[#00FFD1]' : 'text-neutral-600'}`}>
            {isFile ? `CARGADO EN DECK ${n + 1}: ${tname}` : 'NO TRACK'}
          </p>
        </div>
        <DeckWave eng={eng} n={n} height={54} />
        {!isFile && <p className="text-[11px] text-neutral-500">Sube tracks con 📁 USB para practicar TRIM/GAIN.</p>}

        <div className="flex gap-2 items-center flex-1 min-h-0">
          {n === 0 && tempoCol(n)}
          <div className="flex-1 min-w-0 flex flex-col items-center justify-center gap-2">
            <Jog spinning={playing} onNudge={(dx) => (eng as any).nudge?.(n, dx)} />
            <div className="flex gap-2 w-full">
              {/* Colores reales Pioneer: PLAY verde #00E676, CUE rojo #FF1744 */}
              <button type="button" aria-label={`Play deck ${n + 1}`}
                onClick={() => { buzz(); click(); if (isFile) { try { useDaily.getState().bumpMixes(); } catch { /* noop */ } } eng.play(n); }}
                className={`${BTN} flex-[2] min-h-[48px] rounded-xl text-black font-black text-base`} style={{ background: '#00E676', boxShadow: '0 0 18px rgba(0,230,118,.5), inset 0 2px 0 rgba(255,255,255,.35)' }}>▶</button>
              <button type="button" aria-label={`Cue deck ${n + 1}`} onClick={() => { cueBuzz(); click(); eng.cue(n); }}
                className={`${BTN} flex-1 min-h-[48px] rounded-xl font-black text-sm`} style={{ background: '#1E2129', color: '#FF1744', border: '1px solid #FF1744', boxShadow: '0 0 12px rgba(255,23,68,.35)' }}>CUE</button>
              <button type="button" aria-label={`Pause deck ${n + 1}`} onClick={() => { buzz(); eng.pause(n); }}
                className={`${BTN} flex-1 min-h-[48px] rounded-xl border border-[#3A3F4A] font-black text-sm text-neutral-300 hover:border-[#FF5C00]`}>❚❚</button>
            </div>
            <div className="flex gap-1.5 justify-center w-full flex-wrap">
              {[['VINYL', `v${n}`], ['SYNC', `s${n}`], ['QUANT', `q${n}`]].map(([l, k]) => (
                <button key={k} type="button" onClick={() => toggleLed(k)}
                  className={`flex-1 lbl font-black rounded-md px-1 py-1.5 min-h-[30px] border touch-manipulation active:scale-95 ${led(k) ? 'border-[#FF8A00] text-[#FF8A00] bg-[#FF8A00]/10' : 'border-[#22222a] text-neutral-600 hover:border-[#FF5C00]'}`}>{l}</button>
              ))}
              {/* SLIP: la pista sigue avanzando en fantasma bajo loops/hot cues */}
              <button type="button" aria-label={`Slip deck ${n + 1}`}
                onClick={() => { (eng as any).setSlip?.(n, !st.slip); buzz(); }}
                className={`flex-1 lbl font-black rounded-md px-1 py-1.5 min-h-[30px] border touch-manipulation active:scale-95 ${st.slip ? 'border-[#00D4FF] text-[#00D4FF] bg-[#00D4FF]/10' : 'border-[#22222a] text-neutral-600 hover:border-[#00D4FF]'}`}>SLIP</button>
              {/* REV: momentáneo como el real (mantén pulsado = rebobina, suelta = para) */}
              <button type="button" aria-label={`Reverse deck ${n + 1}`}
                onPointerDown={() => { cueBuzz(); (eng as any).startRev?.(n); }}
                onPointerUp={() => (eng as any).stopRev?.(n)}
                onPointerLeave={() => (eng as any).stopRev?.(n)}
                onPointerCancel={() => (eng as any).stopRev?.(n)}
                className="flex-1 lbl font-black rounded-md px-1 py-1.5 min-h-[30px] border border-[#22222a] text-neutral-600 hover:border-[#ff1744] hover:text-[#ff1744] touch-manipulation active:scale-95">REV</button>
            </div>
          </div>
          {n === 1 && tempoCol(n)}
        </div>

        <div style={{ marginTop: 'auto' }}>
          <p className="lbl text-neutral-500 mb-1 text-[9px]">Hot cue A-H · toca = dispara/grabra · doble-click = borra</p>
          <div className="grid grid-cols-4 gap-1.5">{[0, 1, 2, 3, 4, 5, 6, 7].map(pad)}</div>
        </div>
        <div>
          <p className="lbl text-neutral-500 mb-1 text-[9px]">Beat loop {st.loop ? `· ${st.loop}B` : ''}</p>
          <div className="grid grid-cols-5 gap-1.5">
            {LOOPS.map((b) => (
              <button key={b} type="button" onClick={() => { (eng as any).setBeatLoop(n, b); buzz(); click(); }}
                className={`${BTN} min-h-[44px] rounded-lg font-black text-xs border font-mono touch-manipulation ${st.loop === b ? 'bg-[#00FFD1] text-black border-[#00FFD1]' : 'border-[#1f4a44] text-[#7ff5e2] bg-[#11161c] hover:border-[#00FFD1]'}`}>{b}</button>
            ))}
            <button type="button" onClick={() => { (eng as any).reloopExit(n); buzz(); }}
              className={`${BTN} min-h-[44px] rounded-lg font-black text-[10px] border border-[#1f4a44] text-[#7ff5e2] touch-manipulation hover:border-[#00FFD1] hover:bg-[#00FFD1]/10`}>EXIT</button>
          </div>
        </div>
      </div>
    );
  };

  const channelStrip = (n: 0 | 1) => (
    <div className="rounded-xl bg-black/45 border border-[#22222a] p-2 flex flex-col items-center gap-1.5 min-w-0">
      <p className="lbl text-[#FF8A00] font-black">CH{n + 1}</p>
      <Knob label="Trim" size="sm" min={0} max={1.2} value={K(n, 't', 0.8)} reset={0.8} onChange={(v: number) => SK(n, 't', v, (x) => eng.setTrim(n, x))} />
      <Knob label="Hi" size="sm" min={0} max={1} value={K(n, 'h', 0.75)} reset={0.75} color="#FF8A00" onChange={(v: number) => SK(n, 'h', v, (x) => eng.setEQ(n, 'high', x))} />
      <Knob label="Mid" size="sm" min={0} max={1} value={K(n, 'm', 0.75)} reset={0.75} color="#FF8A00" onChange={(v: number) => SK(n, 'm', v, (x) => eng.setEQ(n, 'mid', x))} />
      <Knob label="Low" size="sm" min={0} max={1} value={K(n, 'l', 0.75)} reset={0.75} color="#FF8A00" onChange={(v: number) => SK(n, 'l', v, (x) => eng.setEQ(n, 'low', x))} />
      <Knob label="Color" size="sm" min={-1} max={1} value={K(n, 'c', 0)} reset={0} color="#00D4FF" ring="#00D4FF" onChange={(v: number) => SK(n, 'c', v, (x) => eng.setColor(n, x))} />
    </div>
  );

  const color0 = eng.deckState(0).color ?? '';

  const mixerUI = (
    <div className="hw-panel rounded-2xl p-2.5 lg:p-3 space-y-2.5 min-w-0">
      <div className="flex items-center justify-between">
        <p className="lbl font-black text-[#FF5C00]">Mixer</p>
        <button type="button" onClick={() => { const v = !fxOn; setFxOn(v); if (v) (eng as any).setBeatFX(fxSel, fxLvl, 0.375); (eng as any).fxOnOff(v); buzz(); }}
          className={`lbl font-black rounded-full px-2.5 min-h-[32px] border touch-manipulation active:scale-95 ${fxOn ? 'bg-[#FF5C00] text-black border-[#FF5C00]' : 'border-[#FF5C00] text-[#FF5C00]'}`}
          style={fxOn ? { boxShadow: '0 0 16px rgba(255,92,0,.6)' } : undefined}>{fxOn ? '● FX ON' : '○ FX OFF'}</button>
      </div>

      <div className="rounded-xl border border-[#22222a] bg-black/45 p-2 space-y-1.5">
        <p className="lbl text-neutral-500 text-[9px]">Beat FX{tapBpm ? ` · TAP ${tapBpm} BPM` : ''}</p>
        <div className="flex gap-1">
          <button type="button" aria-label="FX anterior" onClick={() => { const i = (FXS.indexOf(fxSel) + FXS.length - 1) % FXS.length; setFxSel(FXS[i]); (eng as any).setBeatFX(FXS[i], fxLvl, 0.375); buzz(); }}
            className="flex-1 min-h-[40px] rounded-lg border border-[#22222a] font-black touch-manipulation hover:border-[#FF5C00]">◀</button>
          <span className="flex-[2] min-h-[40px] rounded-lg border border-[#FF5C00]/40 bg-[#FF5C00]/10 text-[#FF8A00] font-black text-xs flex items-center justify-center font-mono">{fxSel}</span>
          <button type="button" aria-label="FX siguiente" onClick={() => { const i = (FXS.indexOf(fxSel) + 1) % FXS.length; setFxSel(FXS[i]); (eng as any).setBeatFX(FXS[i], fxLvl, 0.375); buzz(); }}
            className="flex-1 min-h-[40px] rounded-lg border border-[#22222a] font-black touch-manipulation hover:border-[#FF5C00]">▶</button>
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex-1 min-w-0"><Slider label="Level" min={0} max={1} step={0.01} value={fxLvl} onChange={(v: number) => { setFxLvl(v); if (fxOn) (eng as any).setBeatFX(fxSel, v, 0.375); }} /></div>
          <button type="button" onClick={() => { const b = (eng as any).tapTempo?.() || 0; if (b) setTapBpm(b); buzz(); }}
            className="lbl text-[9px] border border-[#22222a] rounded px-2 min-h-[38px] touch-manipulation hover:border-[#FF5C00] hover:text-[#FF5C00]">TAP</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">{channelStrip(0)}{channelStrip(1)}</div>

      {/* COLOR FX: en la XDJ-RR real hay un único bloque de 4 botones para ambos canales */}
      <div className="rounded-xl border border-[#22222a] bg-black/45 p-2 flex items-center gap-2">
        <p className="lbl text-neutral-500 text-[9px] shrink-0">Color FX</p>
        <div className="grid grid-cols-4 gap-1 flex-1">
          {COLORS.map((ct) => (
            <button key={ct} type="button" onClick={() => { eng.setColorFX(0, ct); eng.setColorFX(1, ct); buzz(); }}
              className={`lbl font-black rounded border px-0.5 min-h-[34px] touch-manipulation active:scale-95 ${color0 === ct.split(' ')[0] ? 'border-[#00D4FF] text-[#00D4FF] bg-[#00D4FF]/10 shadow-[0_0_12px_rgba(0,212,255,.35)]' : 'border-[#22222a] text-neutral-500 hover:border-[#00D4FF] hover:text-[#00D4FF]'}`}>{ct.split(' ')[0]}</button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 items-end justify-center">
        <VFader label="CH1" min={0} max={1} step={0.01} value={K(0, 'f', 0.9)} onChange={(v: number) => SK(0, 'f', v, (x) => eng.setFader(0, x))} height={116} />
        <VFader label="CH2" min={0} max={1} step={0.01} value={K(1, 'f', 0.9)} onChange={(v: number) => SK(1, 'f', v, (x) => eng.setFader(1, x))} height={116} />
        <div className="flex gap-1.5">
          <LiveMeter get={readDeck0} label="CH1" />
          <LiveMeter get={readMaster} label="MST" />
          <LiveMeter get={readDeck1} label="CH2" />
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 rounded-xl border border-[#22222a] bg-black/45 p-2">
        <p className="lbl text-neutral-500 text-[9px]">Master</p>
        <Knob label="MST" size="sm" min={0} max={1.2} value={master} reset={0.9} color="#FF3D00" ring="#FF3D00" onChange={(v: number) => { setMaster(v); eng.setMaster(v); }} />
        <span className="lbl text-[9px] text-neutral-500">{Math.round(master * 100)}%</span>
      </div>

      <div className="rounded-xl border border-[#22222a] bg-black/45 p-2">
        <Slider label="Crossfader" min={0} max={1} step={0.01} value={xf} onChange={(v: number) => { setXf(v); eng.setCrossfader(v); }} />
        <div className="flex justify-between lbl text-[9px] text-neutral-600 px-1"><span>CH1</span><span>OFF</span><span>CH2</span></div>
      </div>
    </div>
  );

  /* Fila browser: recorre MIS TRACKS + LOAD físico a cada deck (como el botón LOAD real) */
  const browserRow = (
    <div className="rounded-2xl hairline-neon bg-black/60 px-3 py-2 flex items-center gap-2">
      {onExit && (
        <button type="button" onClick={onExit} aria-label="Salir del simulador"
          className="console-exit min-h-[44px] px-3 rounded-full border border-[#FF5C00] bg-[#070707] text-[#FF5C00] text-xs font-black touch-manipulation">✕ SALIR</button>
      )}
      <button type="button" aria-label="Browser anterior" onClick={() => { setBrowseIdx((i) => (i + trackNames.length - 1) % trackNames.length); buzz(); }}
        className="min-h-[44px] min-w-[44px] rounded-xl border border-[#22222a] font-black touch-manipulation active:scale-95 hover:border-[#FF5C00]">◀</button>
      <div className="flex-1 min-w-0">
        <p className="lbl text-neutral-500 text-[9px]">Browse · MIS TRACKS</p>
        <p className="mono text-[11px] text-[#FF8A00] truncate">{browseName}</p>
      </div>
      <button type="button" aria-label="Browser siguiente" onClick={() => { setBrowseIdx((i) => (i + 1) % trackNames.length); buzz(); }}
        className="min-h-[44px] min-w-[44px] rounded-xl border border-[#22222a] font-black touch-manipulation active:scale-95 hover:border-[#FF5C00]">▶</button>
      <button type="button" onClick={() => browseLoad(0)} className="min-h-[44px] px-3 rounded-xl border border-[#FF5C00] text-[#FF5C00] text-xs font-black touch-manipulation active:scale-95 hover:bg-[#FF5C00]/15">LOAD 1</button>
      <button type="button" onClick={() => browseLoad(1)} className="min-h-[44px] px-3 rounded-xl border border-[#FF5C00] text-[#FF5C00] text-xs font-black touch-manipulation active:scale-95 hover:bg-[#FF5C00]/15">LOAD 2</button>
    </div>
  );

  if (practice) return <MobilePracticeMode eng={eng} onExit={() => setPractice(false)} />;

  return (
    <>
      <div className="simulator-wrapper xdj-sim-wrapper pb-24">
        {showDebug && <div style={{ position: 'fixed', top: 0, left: 0, zIndex: 9999, background: 'red', color: 'white', padding: 10 }}>DEBUG: SIMULADOR MONTADO</div>}
        <div><ScreenStrip eng={eng} onUpload={() => setTracksOpen(true)} /></div>
        <div className="mt-2">{browserRow}</div>
        {rrMode && <div className="sim-chrome mb-2 rounded-2xl border border-[#FF5C00]/50 bg-[#FF5C00]/10 p-3 text-sm"><b className="text-[#FF5C00]">RR DELANTE ON:</b> replica cada gesto en tu RR real.</div>}
        {focusName && <div className="sim-chrome mb-2 rounded-2xl border border-[#FF5C00]/50 bg-[#FF5C00]/5 p-3 text-sm">🎯 <b className="text-[#FF5C00]">Practicando: {focusName}</b> <span className="text-neutral-400">— venido desde su ficha. Toca los controles equivalentes aquí.</span></div>}
        {!rrMode && <div className="sim-chrome mb-2 rounded-2xl border border-[#22222a] bg-[#0d0e12] p-3 text-xs text-neutral-400">🖐 <b className="text-neutral-200">Guía de manos (sin RR delante):</b> izquierda → Jog + Tempo Deck 1 · derecha → Jog + fader Deck 2 · pulgares → PLAY/CUE · mezcla con CROSSFADER al centro.</div>}
        <div className="sim-chrome flex flex-wrap gap-2 mb-2">
          <button type="button" onClick={() => setTracksOpen(true)} className={`${BTN} px-4 min-h-[44px] rounded-full bg-[#FF5C00] text-black text-sm font-black btn-neon`}>📁 MIS TRACKS</button>
          <button type="button" onClick={() => setPractice(true)} className={`${BTN} px-4 min-h-[44px] rounded-full border border-[#FF5C00] text-[#FF5C00] text-sm font-black`}>📱 MODO PRÁCTICA CELULAR</button>
        </div>
        <div className="sim-tabs tabs-mobile md:hidden border border-[#22222a] rounded-2xl flex gap-1.5 mb-2 py-2 px-2 bg-[#070707]">
          {(['d1', 'mix', 'd2'] as const).map((t) => (
            <button type="button" key={t} onClick={() => setMobileTab(t)} aria-label={`Ver ${t}`} className={`${BTN} flex-1 px-2 min-h-[44px] rounded-2xl text-xs font-black ${mobileTab === t ? 'bg-[#FF5C00] text-black' : 'border border-[#22222a] text-neutral-400'}`}>{t === 'd1' ? 'DECK 1' : t === 'mix' ? 'MIXER' : 'DECK 2'}</button>
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
        {/* Orden real XDJ-RR: DECK 1 | MIXER | DECK 2 (order aplica en lg y en consola landscape) */}
        <div className="sim-desktop hidden md:grid gap-3 md:grid-cols-2 lg:grid-cols-[1fr_330px_1fr] overflow-hidden">
          {deckUI(0, 'lg:order-1')}
          {deckUI(1, 'lg:order-3')}
          <div className="mixer-cell md:col-span-2 lg:col-span-1 lg:order-2">{mixerUI}</div>
        </div>
      </div>

      {tracksOpen && (
        <div className="fixed inset-0 z-[95] bg-black/85 backdrop-blur-sm overflow-y-auto p-4" onClick={closeTracks}>
          <div className="mx-auto w-full max-w-xl mt-10 space-y-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="lbl font-black text-[#FF5C00]">MIS TRACKS · USB</p>
              <button type="button" onClick={closeTracks}
                className="min-h-[44px] px-4 rounded-full border border-[#22222a] text-neutral-300 text-xs font-black touch-manipulation hover:border-[#FF5C00] hover:text-[#FF5C00]">✕ CERRAR</button>
            </div>
            <TrackUploader eng={eng} autoOpen={autoPick} />
          </div>
        </div>
      )}
    </>
  );
}

import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import type { useAudioEngine } from '../../hooks/useAudioEngine';

const TrackUploader = lazy(() => import('../uploader/TrackUploader'));

type Eng = ReturnType<typeof useAudioEngine>;

const BTN = 'touch-manipulation select-none relative z-10 active:scale-90 transition-all';
const buzz = (ms = 10) => { if (navigator.vibrate) navigator.vibrate(ms); };
const FXS = ['DELAY', 'ECHO', 'SPIRAL', 'REVERB', 'TRANS', 'FLANGER', 'PITCH', 'ROLL'] as const;
const COLORS = ['DUB ECHO', 'SWEEP', 'FILTER', 'NOISE'] as const;
const HOTPADS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
const HOTCOLORS = ['#00B0FF', '#FF8F00', '#00E676', '#E040FB', '#FFEA00', '#D500F9', '#651FFF', '#00E5FF'] as const;
const LOOPS = [1, 2, 4, 8] as const;
const RANGES = [{ l: '±8', v: 8 }, { l: '±16', v: 16 }, { l: 'WIDE', v: 100 }] as const;

function Jog({ label, vinyl, onNudge }: { label: string; vinyl: boolean; onNudge: (dx: number) => void }) {
  const lastX = useRef(0);
  return (
    <div role="slider" aria-label={`Jog ${label}`} tabIndex={0}
      className={`jog rounded-full border-4 flex items-center justify-center select-none focus:ring-1 focus:ring-[#00d4ff] touch-none ${vinyl ? 'border-[#00d4ff]/70' : 'border-[#262626]'}`}
      style={{ width: 140, height: 140, background: 'radial-gradient(circle,#262626 18%,#141414 45%,#0a0a0a 75%)' }}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); lastX.current = e.clientX; e.preventDefault(); }}
      onPointerMove={(e) => { if (e.buttons === 1) { onNudge(e.clientX - lastX.current); lastX.current = e.clientX; } }}
      onPointerUp={(e) => { try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ } }}
      onPointerCancel={(e) => { try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ } }}
    >
      <div className="rounded-full border border-[#333] flex items-center justify-center" style={{ width: 56, height: 56 }}>
        <span className="text-[10px] text-neutral-500 font-mono">{label}{vinyl ? ' VINYL' : ''}</span>
      </div>
    </div>
  );
}

function DeckZone({ n, eng, tick }: { n: 0 | 1; eng: Eng; tick: number }) {
  void tick;
  const st: any = (eng as any).deckState ? (eng as any).deckState(n) : {};
  const [vinyl, setVinyl] = useState(true);
  const [tempo, setTempo] = useState(0);
  const [rev, setRev] = useState(false);
  const [sync, setSync] = useState(false);
  const [slip, setSlip] = useState(false);
  const [quant, setQuant] = useState(true);
  const [showRemain, setShowRemain] = useState(false);
  const [hotMode, setHotMode] = useState<'play' | 'rec' | 'del'>('play');
  const hot: (number | null)[] = ((eng as any).deckHot?.(n) as any) ?? [null, null, null, null, null, null, null, null];
  const E = eng as any;

  const T = (v: number) => { setTempo(v); E.setTempo(n, v); buzz(); };

  return (
    <div className="rounded-xl border border-[#262626] bg-[#0a0a0a] p-2 space-y-2">
      <div className="rounded-lg bg-black border border-[#262626] p-2 font-mono">
        <div className="flex justify-between text-[10px] text-neutral-500"><span>DECK {n + 1}</span>
          <button type="button" onClick={() => setShowRemain((s) => !s)} className="text-neutral-400">{showRemain ? st.remain : st.time}</button></div>
        <div className="flex justify-between items-end">
          <span className="text-2xl font-black text-[#00d4ff]">{st.bpm}</span>
          <span className="text-sm font-bold text-[#ff6b00]">{st.pitch}%</span>
        </div>
        <div className="flex gap-1 mt-1">
          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${sync ? 'bg-[#00E676] text-black' : 'bg-[#1a1a1a] text-neutral-600'}`}>SYNC</span>
          {slip && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-[#00d4ff] text-black">SLIP</span>}
          {quant && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-[#1a1a1a] text-neutral-300 border border-[#333]">Q</span>}
        </div>
        <div className="text-[10px] text-neutral-500">RANGE {st.range === 100 ? 'WIDE' : `±${st.range}`} {st.mt ? '· MT ON' : ''} {rev ? '· REV' : ''} {st.loop ? `· LOOP ${st.loop}` : ''}</div>
      </div>

      <div className="flex gap-2 items-center justify-center">
        <Jog label={`${n + 1}`} vinyl={vinyl} onNudge={(dx) => E.nudge?.(n, dx)} />
        <div className="flex flex-col items-center gap-1">
          <span className="text-[9px] text-neutral-500 font-bold">TEMPO</span>
          <input aria-label={`Tempo deck ${n + 1}`} type="range" min={-(st.range ?? 8)} max={st.range ?? 8} step={0.1} value={tempo}
            onInput={(e) => T(Number((e.target as HTMLInputElement).value))} onChange={(e) => T(Number(e.target.value))}
            className="accent-[#ff6b00] touch-manipulation" style={{ writingMode: 'vertical-lr', direction: 'rtl', width: 40, height: 160 }} />
          <span className="text-[9px] font-mono text-[#ff6b00]">{tempo.toFixed(1)}</span>
        </div>
      </div>

      <div className="flex gap-1.5">
        {RANGES.map((r) => (
          <button key={r.l} type="button" onClick={() => { E.setTempoRange(n, r.v); setTempo(0); E.resetTempo(n); buzz(); }} className={`${BTN} flex-1 text-[10px] font-black rounded-lg border px-1 py-2 ${st.range === r.v ? 'bg-[#ff6b00] text-black' : 'border-[#262626] text-neutral-400'}`}>{r.l}</button>
        ))}
      </div>
      <div className="flex gap-1.5">
        <button type="button" onClick={() => { E.setMasterTempo(n, !st.mt); buzz(); }} className={`${BTN} flex-1 text-[10px] font-black rounded-lg border px-1 py-2 ${st.mt ? 'bg-[#00d4ff] text-black' : 'border-[#262626] text-neutral-400'}`}>MT</button>
        <button type="button" onClick={() => { setTempo(0); E.resetTempo(n); buzz(); }} className={`${BTN} flex-1 text-[10px] font-black rounded-lg border border-[#262626] text-neutral-400 px-1 py-2`}>RESET</button>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <button type="button" aria-label={`Play ${n + 1}`} onPointerDown={() => buzz()} onClick={() => { const now = Date.now(); (E._lt ??= {})[n] = (E._lt ?? {})[n] || 0; if (now - E._lt[n] < 300) E.cue(n); else E.play(n); E._lt[n] = now; }}
          className={`${BTN} min-h-[56px] rounded-xl bg-[#00E676] text-black font-black text-base ${eng.playing[n] ? 'shadow-[0_0_12px_#00E676]' : ''}`}>▶ PLAY</button>
        <button type="button" aria-label={`Cue ${n + 1}`} onPointerDown={() => { if (navigator.vibrate) navigator.vibrate(50); E.cue(n); }} onPointerUp={() => E.pause(n)}
          className={`${BTN} min-h-[56px] rounded-xl bg-[#FF1744] text-white font-black text-base`}>CUE</button>
        <button type="button" onClick={() => { setSync((s) => !s); E.play(n); buzz(); }} className={`${BTN} min-h-[56px] rounded-xl border font-black text-xs ${sync ? 'bg-[#00E676] text-black shadow-[0_0_12px_#00E676]' : 'border-[#262626] text-neutral-300'}`}>SYNC</button>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        <button type="button" onClick={() => { setSlip((s) => !s); buzz(); }} className={`${BTN} text-[10px] font-black rounded-lg border px-1 py-2 ${slip ? 'bg-[#00d4ff] text-black' : 'border-[#262626] text-neutral-400'}`}>SLIP</button>
        <button type="button" onClick={() => { setQuant((q) => !q); buzz(); }} className={`${BTN} text-[10px] font-black rounded-lg border px-1 py-2 ${quant ? 'border-[#00d4ff] text-[#00d4ff]' : 'border-[#262626] text-neutral-400'}`}>QUANT</button>
        <button type="button" onClick={() => { setVinyl((v) => !v); buzz(); }} className={`${BTN} text-[10px] font-black rounded-lg border px-1 py-2 ${vinyl ? 'border-[#00d4ff] text-[#00d4ff]' : 'border-[#262626] text-neutral-400'}`}>VINYL</button>
        <button type="button" onClick={() => { setRev((r) => !r); buzz(); }} className={`${BTN} text-[10px] font-black rounded-lg border px-1 py-2 ${rev ? 'bg-[#e10600] text-white' : 'border-[#262626] text-neutral-400'}`}>REV</button>
      </div>
      <div className="flex gap-1">
        <button type="button" aria-label="Pitch bend menos" onClick={() => E.nudge?.(n, -20)} className={`${BTN} flex-1 text-xs font-black rounded-lg border border-[#262626] py-2`}>−</button>
        <button type="button" aria-label="Pitch bend mas" onClick={() => E.nudge?.(n, 20)} className={`${BTN} flex-1 text-xs font-black rounded-lg border border-[#262626] py-2`}>+</button>
      </div>

      <div>
        <div className="flex gap-1 mb-1">
          {(['play', 'rec', 'del'] as const).map((m) => (
            <button key={m} type="button" onClick={() => setHotMode(m)} className={`text-[9px] font-black px-2 py-1 rounded border ${hotMode === m ? 'bg-[#ff6b00] text-black' : 'border-[#262626] text-neutral-500'}`}>{m === 'play' ? 'CALL' : m === 'rec' ? '● REC' : '✕ DEL'}</button>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {HOTPADS.map((p, i) => {
            const col = HOTCOLORS[i];
            const set = hot[i] != null;
            return (
              <button key={p} type="button" aria-label={`Hot cue ${p}`}
                onClick={() => { buzz(); if (hotMode === 'rec') E.setHotCue(n, i); else if (hotMode === 'del') E.deleteHotCue(n, i); else E.triggerHotCue(n, i); }}
                style={set ? { borderColor: col, color: col, background: col + '22', boxShadow: `0 0 12px ${col}` } : undefined}
                className={`${BTN} min-h-[48px] rounded-lg font-black text-sm border ${set ? '' : 'border-[#262626] text-neutral-500'}`}>{p}</button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="grid grid-cols-4 gap-1 mb-1">
          {LOOPS.map((b) => (
            <button key={b} type="button" onClick={() => { E.setBeatLoop(n, b); buzz(); }} className={`${BTN} text-[10px] font-black rounded-lg border px-1 py-2 ${st.loop === b ? 'bg-[#00d4ff] text-black' : 'border-[#262626] text-neutral-400'}`}>{b}</button>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-1">
          <button type="button" onClick={() => { E.setBeatLoop(n, 4); buzz(); }} className={`${BTN} text-[9px] font-black rounded-lg border border-[#262626] text-neutral-400 px-1 py-2`}>IN</button>
          <button type="button" onClick={() => { E.reloopExit(n); buzz(); }} className={`${BTN} text-[9px] font-black rounded-lg border border-[#262626] text-neutral-400 px-1 py-2`}>OUT</button>
          <button type="button" onClick={() => { E.reloopExit(n); buzz(); }} className={`${BTN} text-[9px] font-black rounded-lg border border-[#262626] text-neutral-400 px-1 py-2`}>RELOOP</button>
          <div className="flex gap-1">
            <button type="button" aria-label="Loop mitad" onClick={() => E.loopHalfDouble(n, -1)} className={`${BTN} flex-1 text-[10px] font-black rounded-lg border border-[#262626] text-neutral-300`}>½</button>
            <button type="button" aria-label="Loop doble" onClick={() => E.loopHalfDouble(n, 1)} className={`${BTN} flex-1 text-[10px] font-black rounded-lg border border-[#262626] text-neutral-300`}>2×</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MixerZone({ eng }: { eng: Eng }) {
  const E = eng as any;
  const [fx, setFx] = useState<string>('ECHO');
  const [fxOn, setFxOn] = useState(false);
  const [fxLvl, setFxLvl] = useState(0.5);
  const [fxTime, setFxTime] = useState(0.375);
  const [chSel, setChSel] = useState('MASTER');
  const [color, setColor] = useState('FILTER');
  const [mix, setMix] = useState(0.5); const [hpLvl, setHpLvl] = useState(0.7);
  const [booth, setBooth] = useState(0.9); const [master, setMaster] = useState(0.9);
  const [xf, setXf] = useState(0.5); const [f, setF] = useState<[number, number]>([0.9, 0.9]);
  const [eq, setEq] = useState<Record<string, number>>({});
  const Q = (d: number, b: string, def: number) => eq[`${d}${b}`] ?? def;
  const SQ = (d: 0 | 1, b: 'low' | 'mid' | 'high', v: number) => { setEq((s) => ({ ...s, [`${d}${b}`]: v })); E.setEQ(d, b, v); };
  const kill = (d: 0 | 1, b: 'low' | 'mid' | 'high') => { SQ(d, b, 0); buzz(); };

  const applyFx = (t: string, l = fxLvl, tm = fxTime) => { setFx(t); E.setBeatFX(t, l, tm); };
  const toggleFx = () => { const v = !fxOn; setFxOn(v); if (!E.fxWetInit) { E.setBeatFX(fx, fxLvl, fxTime); E.fxWetInit = true; } E.fxOnOff(v); buzz(15); };

  return (
    <div className="rounded-xl border border-[#262626] bg-[#0a0a0a] p-2 space-y-2">
      <p className="text-[10px] font-black tracking-widest text-[#ff6b00] text-center">MIXER</p>
      {[0, 1].map((d) => (
        <div key={d} className="rounded-lg border border-[#262626] p-2 space-y-1">
          <p className="text-[9px] font-black text-neutral-500">CH{d + 1}</p>
          <label className="block text-[10px] text-neutral-400 touch-manipulation">TRIM
            <input aria-label={`Trim CH${d + 1}`} type="range" min={0} max={1.2} step={0.01} defaultValue={0.8}
              onDoubleClick={(e) => { (e.target as HTMLInputElement).value = '0.8'; E.setTrim(d, 0.8); }}
              onInput={(e) => E.setTrim(d, Number((e.target as HTMLInputElement).value))} onChange={(e) => E.setTrim(d, Number(e.target.value))}
              className="w-full h-12 accent-[#ff6b00]" /></label>
          {(['HI', 'MID', 'LOW'] as const).map((b) => (
            <label key={b} className="block text-[10px] text-neutral-400 touch-manipulation">{b} · doble-tap=kill
              <input aria-label={`${b} CH${d + 1}`} type="range" min={0} max={1} step={0.01} value={Q(d, b.toLowerCase(), 0.75)}
                onDoubleClick={() => kill(d as 0 | 1, b.toLowerCase() as any)}
                onInput={(e) => SQ(d as 0 | 1, b.toLowerCase() as any, Number((e.target as HTMLInputElement).value))}
                onChange={(e) => SQ(d as 0 | 1, b.toLowerCase() as any, Number(e.target.value))}
                className="w-full h-12 accent-[#ff6b00]" /></label>
          ))}
          <div className="grid grid-cols-4 gap-1">
            {COLORS.map((c) => (
              <button key={c} type="button" onClick={() => { setColor(c); E.setColorFX(d, c); buzz(); }} className={`${BTN} text-[8px] font-black rounded border px-0.5 py-2 ${color === c ? 'bg-[#ff6b00] text-black' : 'border-[#262626] text-neutral-500'}`}>{c}</button>
            ))}
          </div>
          <label className="block text-[10px] text-neutral-400 touch-manipulation">COLOR · doble-tap=reset
            <input aria-label={`Color CH${d + 1}`} type="range" min={-1} max={1} step={0.01} defaultValue={0}
              onDoubleClick={(e) => { (e.target as HTMLInputElement).value = '0'; E.setColor(d, 0); }}
              onInput={(e) => E.setColor(d, Number((e.target as HTMLInputElement).value))} onChange={(e) => E.setColor(d, Number(e.target.value))}
              className="w-full h-12 accent-[#00d4ff]" /></label>
          <div className="flex gap-2 items-center">
            <button type="button" aria-label={`CUE phones CH${d + 1}`} onClick={() => buzz()} className={`${BTN} text-[10px] font-black rounded-lg border border-[#262626] text-neutral-300 px-2 py-2`}>🎧 CUE</button>
            <label className="flex-1 text-[10px] text-neutral-400 touch-manipulation">CH FADER
              <input aria-label={`Fader CH${d + 1}`} type="range" min={0} max={1} step={0.01} value={f[d]}
                onInput={(e) => { const v = Number((e.target as HTMLInputElement).value); setF((p) => (d === 0 ? [v, p[1]] : [p[0], v])); E.setFader(d, v); }}
                onChange={(e) => { const v = Number(e.target.value); setF((p) => (d === 0 ? [v, p[1]] : [p[0], v])); E.setFader(d, v); }}
                className="accent-[#ff6b00]" style={{ writingMode: 'vertical-lr', direction: 'rtl', width: 44, height: 120 }} /></label>
          </div>
        </div>
      ))}

      <div className="rounded-lg border border-[#262626] p-2">
        <p className="text-[9px] font-black text-neutral-500">BEAT FX</p>
        <div className="grid grid-cols-4 gap-1 my-1">
          {FXS.map((t) => (
            <button key={t} type="button" onClick={() => { applyFx(t); buzz(); }} className={`${BTN} text-[8px] font-black rounded border px-0.5 py-2 ${fx === t ? 'bg-[#00d4ff] text-black' : 'border-[#262626] text-neutral-500'}`}>{t}</button>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-1 mb-1">
          {['CH1', 'CH2', 'MASTER'].map((c) => (
            <button key={c} type="button" onClick={() => { setChSel(c); buzz(); }} className={`${BTN} text-[9px] font-black rounded border px-1 py-1.5 ${chSel === c ? 'bg-[#ff6b00] text-black' : 'border-[#262626] text-neutral-500'}`}>{c}</button>
          ))}
          <button type="button" onClick={() => { const b = E.tapTempo?.(); buzz(); if (b) setFxTime(30 / b); }} className={`${BTN} text-[9px] font-black rounded border border-[#262626] text-neutral-300 px-1 py-1.5`}>TAP</button>
        </div>
        <label className="block text-[10px] text-neutral-400 touch-manipulation">TIME
          <input aria-label="FX time" type="range" min={0.03} max={1} step={0.01} value={fxTime}
            onInput={(e) => { setFxTime(Number((e.target as HTMLInputElement).value)); E.setBeatFX(fx, fxLvl, Number((e.target as HTMLInputElement).value)); }}
            onChange={(e) => { setFxTime(Number(e.target.value)); E.setBeatFX(fx, fxLvl, Number(e.target.value)); }} className="w-full h-12 accent-[#00d4ff]" /></label>
        <label className="block text-[10px] text-neutral-400 touch-manipulation">LEVEL/DEPTH
          <input aria-label="FX level" type="range" min={0} max={1} step={0.01} value={fxLvl}
            onInput={(e) => { setFxLvl(Number((e.target as HTMLInputElement).value)); E.setBeatFX(fx, Number((e.target as HTMLInputElement).value), fxTime); }}
            onChange={(e) => { setFxLvl(Number(e.target.value)); E.setBeatFX(fx, Number(e.target.value), fxTime); }} className="w-full h-12 accent-[#ff6b00]" /></label>
        <button type="button" onClick={toggleFx} className={`${BTN} w-full min-h-[56px] rounded-xl font-black text-base ${fxOn ? 'bg-[#ff6b00] text-black shadow-[0_0_12px_#ff6b00]' : 'border border-[#ff6b00] text-[#ff6b00]'}`}>{fxOn ? '● FX ON' : '○ FX OFF'}</button>
      </div>

      <label className="block text-[10px] text-neutral-400 touch-manipulation">CROSSFADER · THRU
        <input aria-label="Crossfader" type="range" min={0} max={1} step={0.01} value={xf}
          onInput={(e) => { setXf(Number((e.target as HTMLInputElement).value)); E.setCrossfader(xf); }} onChange={(e) => { setXf(Number(e.target.value)); E.setCrossfader(Number(e.target.value)); }}
          className="w-full h-14 accent-[#00d4ff]" /></label>
      <div className="grid grid-cols-2 gap-1">
        <label className="block text-[10px] text-neutral-400 touch-manipulation">MASTER
          <input aria-label="Master" type="range" min={0} max={1.2} step={0.01} value={master}
            onInput={(e) => { setMaster(Number((e.target as HTMLInputElement).value)); E.setMaster(master); }} onChange={(e) => { setMaster(Number(e.target.value)); E.setMaster(Number(e.target.value)); }} className="w-full h-10 accent-[#ff6b00]" /></label>
        <label className="block text-[10px] text-neutral-400 touch-manipulation">BOOTH
          <input aria-label="Booth" type="range" min={0} max={1.2} step={0.01} value={booth}
            onInput={(e) => setBooth(Number((e.target as HTMLInputElement).value))} onChange={(e) => setBooth(Number(e.target.value))} className="w-full h-10 accent-[#ff6b00]" /></label>
      </div>
      <div className="grid grid-cols-2 gap-1">
        <label className="block text-[10px] text-neutral-400 touch-manipulation">HP MIX/CUE
          <input aria-label="HP mix" type="range" min={0} max={1} step={0.01} value={mix} onInput={(e) => setMix(Number((e.target as HTMLInputElement).value))} onChange={(e) => setMix(Number(e.target.value))} className="w-full h-10 accent-[#00d4ff]" /></label>
        <label className="block text-[10px] text-neutral-400 touch-manipulation">HP LEVEL
          <input aria-label="HP level" type="range" min={0} max={1} step={0.01} value={hpLvl} onInput={(e) => setHpLvl(Number((e.target as HTMLInputElement).value))} onChange={(e) => setHpLvl(Number(e.target.value))} className="w-full h-10 accent-[#00d4ff]" /></label>
      </div>
      <div className="rounded-lg border border-[#262626] p-2">
        <p className="text-[9px] font-black text-neutral-500">MIC 1/2 <span className="text-neutral-600">(demo: sin fuente en web)</span></p>
        <label className="block text-[10px] text-neutral-400 touch-manipulation">MIC LEVEL
          <input aria-label="Mic level" type="range" min={0} max={1} step={0.01} defaultValue={0}
            onInput={(e) => E.setMicLevel?.(Number((e.target as HTMLInputElement).value))} onChange={(e) => E.setMicLevel?.(Number(e.target.value))} className="w-full h-12 accent-[#ff6b00]" /></label>
      </div>
    </div>
  );
}

export default function MobilePracticeMode({ eng, onExit }: { eng: Eng; onExit: () => void }) {
  const [lv, setLv] = useState({ deck: [0, 0] as [number, number], master: 0 });
  const [, setTick] = useState(0);
  const [showUp, setShowUp] = useState(false);
  const [showRotate, setShowRotate] = useState(true);
  const lpTimer = useRef<any>(null);

  const goLandscape = async () => {
    buzz(15);
    try {
      await document.documentElement.requestFullscreen?.();
      const o = screen.orientation as any;
      await o?.lock?.('landscape');
    } catch { /* noop: iOS usa el hint manual */ }
    setShowRotate(false);
  };

  const lpOpen = () => { lpTimer.current = setTimeout(() => { buzz(15); setShowUp(true); }, 450); };
  const lpCancel = (open = false) => { clearTimeout(lpTimer.current); if (open) setShowUp(true); };

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  useEffect(() => {
    const id = setInterval(() => { setLv(eng.getLevels()); setTick((t) => t + 1); }, 120);
    return () => clearInterval(id);
  }, [eng]);

  const meter = (v: number) => {
    const p = Math.round(Math.min(1, Math.max(0, v)) * 100);
    const c = p > 90 ? 'bg-[#e10600]' : p > 70 ? 'bg-[#ff6b00]' : 'bg-emerald-500';
    return <div className="w-6 h-20 rounded bg-black border border-[#262626] flex flex-col justify-end overflow-hidden"><div className={`${c} duration-75`} style={{ height: `${p}%` }} /></div>;
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#0a0a0a] overflow-hidden">
      <div className="h-[100dvh] flex flex-col gap-2 p-2 overflow-hidden">
        <header className="flex items-center gap-3">
          <div className="flex gap-2">
            <div className="text-center"><p className="text-[9px] text-neutral-500">CH1</p>{meter(lv.deck[0])}</div>
            <div className="text-center"><p className="text-[9px] text-neutral-500">MST</p>{meter(lv.master)}</div>
            <div className="text-center"><p className="text-[9px] text-neutral-500">CH2</p>{meter(lv.deck[1])}</div>
          </div>
          <p className="font-black text-xs">XDJ-RR <span className="text-[#ff6b00]">1:1</span></p>
          <button type="button" aria-label="Abrir uploader (long-press LOAD)"
            onPointerDown={lpOpen} onPointerUp={() => lpCancel(true)} onPointerLeave={() => lpCancel()}
            className={`${BTN} text-xs border border-[#00B0FF] text-[#00B0FF] rounded-lg px-3 py-2`}>📁 LOAD</button>
          <button type="button" aria-label="Pantalla completa" onClick={() => {
            try {
              if (document.fullscreenElement) document.exitFullscreen();
              else document.documentElement.requestFullscreen?.();
              const o = screen.orientation as any;
              if (!document.fullscreenElement && o?.lock) o.lock('landscape').catch(() => {});
              else if (o?.unlock) o.unlock();
            } catch { /* noop */ }
            buzz();
          }} className={`${BTN} text-xs border border-[#262626] text-neutral-300 rounded-lg px-3 py-2`}>⛶ FULL</button>
          <button type="button" onClick={onExit} aria-label="Salir" className={`${BTN} ml-auto text-sm border border-[#262626] rounded-lg px-3 py-2`}>✕</button>
        </header>
        <p className="portrait-only text-center text-[11px] text-[#ff6b00] font-bold">📱 Gira tu celular para ver la RR completa sin scroll + ⛶ FULL</p>
        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 flex-1 min-h-0 overflow-y-auto">
          <DeckZone n={0} eng={eng} tick={0} />
          <MixerZone eng={eng} />
          <DeckZone n={1} eng={eng} tick={0} />
        </div>
        <button type="button" onClick={onExit} className={`${BTN} w-full min-h-[52px] rounded-xl border border-[#ff6b00] text-[#ff6b00] font-black text-sm`}>SALIR DE MODO PRÁCTICA</button>
        {showRotate && (
          <div className={`rotate-hint show fixed inset-0 z-[130] items-center justify-center bg-black/85 p-6`} role="dialog" aria-label="Gira tu celular">
            <div className="w-full max-w-[420px] rounded-2xl border border-[#ff6b00]/50 bg-[#111111] p-6 text-center space-y-3">
              <p className="text-4xl">📱↻</p>
              <p className="font-black">GIRA TU CELULAR</p>
              <p className="text-sm text-neutral-400">Modo horizontal para usar todo el XDJ-RR sin scroll.</p>
              <button type="button" onClick={goLandscape} className="w-full min-h-[52px] rounded-full bg-[#ff6b00] text-black font-black touch-manipulation active:scale-95">⛶ FULLSCREEN + HORIZONTAL</button>
              <button type="button" onClick={() => setShowRotate(false)} className="text-xs text-neutral-500">Seguir en vertical</button>
            </div>
          </div>
        )}
        {showUp && (
          <div className="absolute inset-0 z-[110] bg-black/80 p-3 overflow-y-auto">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-xs font-black text-[#00B0FF]">📁 CARGAR TRACK A DECK</p>
              <button type="button" onClick={() => setShowUp(false)} className={`${BTN} ml-auto text-sm border border-[#262626] rounded-lg px-3 py-2`}>✕ Cerrar</button>
            </div>
            <Suspense fallback={<p className="text-xs text-neutral-500">Cargando...</p>}>
              <TrackUploader eng={eng} />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  );
}

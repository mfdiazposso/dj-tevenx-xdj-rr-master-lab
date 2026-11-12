import { useEffect, useRef, useState } from 'react';

export function useAudioEngine() {
  const ctxRef = useRef<AudioContext | null>(null);
  const nodes = useRef<any>({});
  const [playing, setPlaying] = useState<[boolean, boolean]>([false, false]);
  const [hasFile, setHasFile] = useState<[boolean, boolean]>([false, false]);
  const [, force] = useState(0);

  const ensure = () => {
    if (ctxRef.current) return ctxRef.current;
    const ctx = new AudioContext();
    ctxRef.current = ctx;
    const master = ctx.createGain(); master.gain.value = 0.9;
    const masterAn = ctx.createAnalyser(); masterAn.fftSize = 256;
    const comp = ctx.createDynamicsCompressor();
    const fxIn = ctx.createGain(); const fxDry = ctx.createGain(); fxDry.gain.value = 1;
    fxIn.connect(fxDry); fxDry.connect(masterAn);
    masterAn.connect(comp); comp.connect(ctx.destination);
    const decks: any[] = [];
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? 'sawtooth' : 'square';
      osc.frequency.value = i === 0 ? 55 : 58.27;
      const srcGain = ctx.createGain(); srcGain.gain.value = 1; // file source entra aquí
      const trim = ctx.createGain(); trim.gain.value = 0.8;
      const low = ctx.createBiquadFilter(); low.type = 'lowshelf'; low.frequency.value = 320;
      const mid = ctx.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 1000;
      const high = ctx.createBiquadFilter(); high.type = 'highshelf'; high.frequency.value = 3200;
      const color = ctx.createBiquadFilter(); color.type = 'lowpass'; color.frequency.value = 18000;
      const ch = ctx.createGain(); ch.gain.value = 0.9;
      const an = ctx.createAnalyser(); an.fftSize = 256;
      const xf = ctx.createGain(); xf.gain.value = 0;
      osc.connect(srcGain);
      srcGain.connect(trim); trim.connect(low); low.connect(mid); mid.connect(high); high.connect(color); color.connect(ch); ch.connect(an); an.connect(xf); xf.connect(fxIn);
      osc.start();
      // CUE de auriculares: pre-fader (ignora fader/crossfader, como el hardware)
      const phone = ctx.createGain(); phone.gain.value = 0; ch.connect(phone);
      decks.push({ osc, srcGain, trim, low, mid, high, color, ch, an, xf, phone, buf: null as AudioBuffer | null, fileSrc: null as AudioBufferSourceNode | null, fileName: '', rate: 1, range: 8, masterTempo: false, hotcues: [null, null, null, null, null, null, null, null] as (number | null)[], loopBeats: 0, loopOn: true, startStamp: 0, offsetBase: 0, colorType: 'FILTER', slipOn: false, cueMon: false, ghostBase: 0, ghostStamp: 0, slipMod: false, revTimer: 0 as ReturnType<typeof setInterval> | 0,
        // v14 FASE 2 (fidelidad XDJ-RR)
        stopped: true, // deck en pausa: la posición NO avanza (antes sí, bug)
        cuePt: 0, cueReady: false, previewing: false,
        vinyl: true, quant: true, bpmBase: 120,
        manualLoop: false, loopInPt: 0 as number | null, manualIn: 0, manualEnd: 0 });
    }
    // Salida de auriculares (en web suena en el mismo parlante: no hay jack PHONES)
    const phones = ctx.createGain(); phones.gain.value = 0.9; phones.connect(ctx.destination);
    decks.forEach((dk: any) => dk.phone.connect(phones));
    nodes.current = { ctx, master, masterAn, fxIn, phones, decks, fxType: 'ECHO', fxLevel: 0.5, fxTime: 0.375, fxOn: false, micGain: null as GainNode | null, xfCurve: '1' as 'THRU' | '1' | '2', masterDeck: null as 0 | 1 | null, timeMode: 'elapsed' as 'elapsed' | 'remain', phoneLevel: 0.9, phoneMix: 0, fxChannel: 'MASTER' as '1' | '2' | 'MASTER' };
    return ctx;
  };

  const api = {
    playing, hasFile, ready: () => !!ctxRef.current,
    resume: async () => { const ctx = ensure(); if (ctx.state === 'suspended') await ctx.resume(); return ctx; },
    // PLAY: si el deck estaba congelado (pausa), re-crea la fuente en la posición congelada
    play: async (d: 0 | 1) => {
      const ctx = ensure(); if (ctx.state === 'suspended') await ctx.resume();
      const dk = nodes.current.decks[d];
      if (dk.buf && dk.stopped) (api as any)._spawn(d);
      dk.xf.gain.setTargetAtTime(api._xfGain(d), ctx.currentTime, 0.05);
      setPlaying((p) => (d === 0 ? [true, p[1]] : [p[0], true]));
    },
    // PAUSA real: congela la posición (antes la posición seguía avanzando en silencio)
    pause: async (d: 0 | 1) => {
      if (!ctxRef.current) return; const ctx = ctxRef.current;
      if (ctx.state === 'suspended') await ctx.resume();
      const dk = nodes.current.decks[d];
      if (dk.buf && !dk.stopped) {
        dk.offsetBase = (api as any)._pos(d);
        try { dk.fileSrc?.stop(); } catch { /* noop */ }
        dk.fileSrc = null; dk.stopped = true;
      }
      dk.xf.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      setPlaying((p) => (d === 0 ? [false, p[1]] : [p[0], false]));
    },
    // CUE como el hardware (XDJ-RR manual):
    //  - reproduciendo → salta al punto CUE y pausa
    //  - en pausa → si el playhead está fuera del CUE, marca nuevo CUE ahí;
    //    mantener pulsado = preview; soltar = vuelve al CUE y pausa
    cueDown: async (d: 0 | 1) => {
      const ctx = ensure(); if (ctx.state === 'suspended') await ctx.resume();
      const dk = nodes.current.decks[d];
      if (api.playing[d]) {
        if (dk.cueReady) (api as any)._seek(d, dk.cuePt);
        await api.pause(d);
        dk.previewing = false;
      } else {
        const pos = (api as any)._pos(d);
        if (!dk.cueReady || Math.abs(pos - dk.cuePt) > 0.03) {
          dk.cuePt = dk.quant ? (api as any)._quantSnap(d, pos) : pos;
          dk.cueReady = true;
        } else {
          dk.cuePt = pos;
        }
        (api as any)._seek(d, dk.cuePt);
        dk.previewing = true;
        await api.play(d); // preview mientras se mantiene pulsado
      }
      force((x) => x + 1);
    },
    cueUp: async (d: 0 | 1) => {
      const dk = nodes.current.decks?.[d];
      if (!dk?.previewing) return;
      dk.previewing = false;
      (api as any)._seek(d, dk.cuePt);
      await api.pause(d);
      force((x) => x + 1);
    },
    // Legacy (teclado/práctica): emulación simple de CUE
    cue: async (d: 0 | 1) => { await api.play(d); setTimeout(() => api.pause(d), 400); },
    _xf: 0.5, _ch: [0.9, 0.9] as [number, number],
    // Curva del crossfader (THRU = sin crossfade, 1 = gradual, 2 = cortante)
    _xfGain(d: number) {
      const base = api._ch[d];
      const x = api._xf;
      const curve = nodes.current.xfCurve || '1';
      if (curve === 'THRU') return base;
      if (curve === '2') {
        const s = (t: number) => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
        return base * (d === 0 ? 1 - s((x - 0.4) / 0.2) : s((x - 0.4) / 0.2));
      }
      return base * (d === 0 ? Math.cos((x * Math.PI) / 2) : Math.cos(((1 - x) * Math.PI) / 2));
    },
    setXfCurve: (c: 'THRU' | '1' | '2') => { ensure(); nodes.current.xfCurve = c; api._applyXf(); force((x) => x + 1); },
    _applyXf() { if (!ctxRef.current) return; const t = ctxRef.current.currentTime; nodes.current.decks.forEach((dk: any, i: number) => dk.xf.gain.setTargetAtTime(api._xfGain(i), t, 0.03)); },
    setTrim: (d: 0 | 1, v: number) => { ensure(); nodes.current.decks[d].trim.gain.setTargetAtTime(v, ctxRef.current!.currentTime, 0.03); },
    setEQ: (d: 0 | 1, band: 'low' | 'mid' | 'high', v: number) => { ensure(); nodes.current.decks[d][band].gain.setTargetAtTime((v - 0.75) * 34, ctxRef.current!.currentTime, 0.03); },
    setColor: (d: 0 | 1, v: number) => { ensure(); const f = nodes.current.decks[d].color; const ctx = ctxRef.current!; if (v < 0) { f.type = 'lowpass'; f.frequency.setTargetAtTime(18000 + v * 17000, ctx.currentTime, 0.03); } else { f.type = 'highpass'; f.frequency.setTargetAtTime(20 + v * 4000, ctx.currentTime, 0.03); } },
    setFader: (d: 0 | 1, v: number) => { ensure(); api._ch[d] = v; api._applyXf(); },
    setCrossfader: (v: number) => { ensure(); api._xf = v; api._applyXf(); },
    setMaster: (v: number) => { ensure(); nodes.current.master.gain.setTargetAtTime(v, ctxRef.current!.currentTime, 0.03); },
    setBooth: (_v: number) => { ensure(); /* booth monitor demo */ },
    nudge: (d: 0 | 1, dx: number) => {
      if (!ctxRef.current) return;
      const dk = nodes.current.decks?.[d];
      if (!dk) return;
      // pitch-bend temporal ±0.02 durante 200ms según dirección del drag
      try {
        const t = ctxRef.current.currentTime;
        const bend = dx === 0 ? 0 : dx > 0 ? 0.02 : -0.02;
        if (dk.fileSrc?.playbackRate) {
          dk.fileSrc.playbackRate.cancelScheduledValues(t);
          dk.fileSrc.playbackRate.setValueAtTime(1 + bend, t);
          dk.fileSrc.playbackRate.setValueAtTime(1, t + 0.2);
        } else if (dk.osc?.detune) {
          dk.osc.detune.cancelScheduledValues(t);
          dk.osc.detune.setValueAtTime(bend * 100 * 12, t);
          dk.osc.detune.setValueAtTime(0, t + 0.2);
        }
      } catch { /* noop */ }
    },
    async loadFile(d: 0 | 1, file: File) {
      await (api as any).loadBlob(d, file, file.name);
    },
    async loadBlob(d: 0 | 1, blob: Blob, name: string, bpm?: number) {
      const ctx = ensure();
      if (ctx.state === 'suspended') await ctx.resume();
      const ab = await blob.arrayBuffer();
      const buf = await ctx.decodeAudioData(ab);
      const dk = nodes.current.decks[d];
      dk.buf = buf; dk.fileName = name;
      if (bpm && bpm > 0) dk.bpmBase = bpm;
      // silencia el demo-osc: a partir de aquí suena el archivo
      try { dk.osc.disconnect(); } catch { /* noop */ }
      dk.srcGain.gain.value = 0;
      // Como el hardware: cargar otra pista limpia hot cues, loops y CUE
      dk.hotcues = [null, null, null, null, null, null, null, null];
      dk.loopBeats = 0; dk.manualLoop = false; dk.loopInPt = null; dk.loopOn = true;
      dk.cuePt = 0; dk.cueReady = false; dk.previewing = false;
      dk.slipMod = false;
      try { dk.fileSrc?.stop(); } catch { /* noop */ }
      dk.fileSrc = null; dk.offsetBase = 0; dk.startStamp = ctx.currentTime;
      const wasPlaying = playing[d];
      if (wasPlaying) {
        dk.stopped = false;
        (api as any)._spawn(d);
        dk.xf.gain.setTargetAtTime(api._xfGain(d), ctx.currentTime, 0.05);
      } else {
        dk.stopped = true;
        dk.xf.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
      }
      setHasFile((p) => (d === 0 ? [true, p[1]] : [p[0], true]));
      force((x) => x + 1);
    },
    // ---- SUPER PRO: tempo / hot cue / loop ----
    setTempo: (d: 0 | 1, pct: number) => {
      const ctx = ensure(); const dk = nodes.current.decks[d];
      const range = dk.range || 8;
      const cl = Math.max(-range, Math.min(range, pct));
      dk.rate = 1 + cl / 100;
      try {
        // Nota: el keylock (pitch invariable) real requiere time-stretch; en Web Audio
        // el rate cambia velocidad y pitch. El LED MASTER TEMPO recuerda el estado y
        // frena el pitch del demo-osc. La velocidad SIEMPRE cambia (necesario para batir).
        if (dk.fileSrc?.playbackRate) dk.fileSrc.playbackRate.setTargetAtTime(dk.rate, ctx.currentTime, 0.02);
        if (dk.osc?.detune) dk.osc.detune.setTargetAtTime(dk.masterTempo ? 0 : cl * 100, ctx.currentTime, 0.02);
      } catch { /* noop */ }
      force((x) => x + 1);
    },
    resetTempo: (d: 0 | 1) => { (api as any).setTempo(d, 0); },
    setTempoRange: (d: 0 | 1, r: number) => { ensure(); nodes.current.decks[d].range = r; (api as any).setTempo(d, ((nodes.current.decks[d].rate || 1) - 1) * 100); force((x) => x + 1); },
    setMasterTempo: (d: 0 | 1, on: boolean) => { ensure(); const dk = nodes.current.decks[d]; dk.masterTempo = on; (api as any).setTempo(d, ((dk.rate || 1) - 1) * 100); },
    _pos: (d: 0 | 1) => {
      const dk = nodes.current.decks?.[d]; if (!dk?.buf) return 0;
      if (dk.stopped) return dk.offsetBase || 0; // pausa: posición congelada
      const el = (dk.offsetBase || 0) + (ctxRef.current?.currentTime ?? 0) - (dk.startStamp || 0);
      return ((el % dk.buf.duration) + dk.buf.duration) % dk.buf.duration;
    },
    // Crea la fuente de reproducción en offsetBase (llamada al play/desde load)
    _spawn: (d: 0 | 1) => {
      const ctx = ensure(); const dk = nodes.current.decks[d];
      if (!dk?.buf) return;
      try { dk.fileSrc?.stop(); } catch { /* noop */ }
      const off = ((dk.offsetBase || 0) % dk.buf.duration + dk.buf.duration) % dk.buf.duration;
      const src = ctx.createBufferSource(); src.buffer = dk.buf;
      const beat = 60 / (dk.bpmBase || 120);
      if (dk.manualLoop && dk.loopOn !== false) {
        src.loop = true; src.loopStart = dk.manualIn; src.loopEnd = dk.manualEnd;
      } else if (dk.loopBeats) {
        src.loop = true; src.loopStart = off; src.loopEnd = Math.min(dk.buf.duration, off + dk.loopBeats * beat);
      } else {
        src.loop = dk.loopOn !== false;
      }
      src.playbackRate.value = dk.rate || 1;
      const g = ctx.createGain(); g.gain.value = 1;
      src.connect(g); g.connect(dk.trim);
      src.start(0, off);
      dk.fileSrc = src; dk.startStamp = ctx.currentTime; dk.offsetBase = off; dk.stopped = false;
    },
    // Snap al grid de beats (quantize) — beat en segundos de buffer
    _quantSnap: (d: 0 | 1, t: number) => {
      const dk = nodes.current.decks?.[d];
      const beat = 60 / (dk?.bpmBase || 120);
      return Math.round(t / beat) * beat;
    },
    _seek: (d: 0 | 1, offset: number) => {
      const ctx = ensure(); const dk = nodes.current.decks[d];
      if (!dk.buf) return;
      const dur = dk.buf.duration;
      const off = ((offset % dur) + dur) % dur;
      dk.offsetBase = off; dk.startStamp = ctx.currentTime;
      if (dk.stopped) { // en pausa solo movemos el marcador (no suena ni avanza)
        try { dk.fileSrc?.stop(); } catch { /* noop */ }
        dk.fileSrc = null;
        return;
      }
      (api as any)._spawn(d);
    },
    // Needle search / scrub: salta a una fracción de la pista
    seekFrac: (d: 0 | 1, frac: number) => {
      const dk = nodes.current.decks?.[d]; if (!dk?.buf) return;
      const off = Math.max(0, Math.min(0.999, frac)) * dk.buf.duration;
      (api as any)._seek(d, dk.quant && !dk.stopped ? (api as any)._quantSnap(d, off) : off);
      force((x) => x + 1);
    },
    // Scratch lite (JOG MODE VINYL en pausa): dx en px → desplaza la posición
    scratch: (d: 0 | 1, dxPx: number) => {
      const dk = nodes.current.decks?.[d]; if (!dk?.buf || !dk.stopped) return;
      const off = (dk.offsetBase || 0) + dxPx * 0.03;
      (api as any)._seek(d, Math.max(0, Math.min(dk.buf.duration - 0.05, off)));
      force((x) => x + 1);
    },
    // BEAT JUMP: ±n beats (con quantize salta exacto al grid)
    beatJump: (d: 0 | 1, beats: number) => {
      const dk = nodes.current.decks?.[d]; if (!dk?.buf) return;
      const beat = 60 / (dk.bpmBase || 120);
      const pos = (api as any)._pos(d);
      let t = pos + beats * beat;
      if (dk.quant) t = (api as any)._quantSnap(d, t);
      (api as any)._seek(d, t);
      force((x) => x + 1);
    },
    // SYNC: iguala el BPM del deck al deck MASTER (o al otro deck)
    sync: (d: 0 | 1) => {
      const dk = nodes.current.decks?.[d]; if (!dk) return;
      const md = nodes.current.masterDeck;
      const target: 0 | 1 = md != null && md !== d ? md : d === 0 ? 1 : 0;
      const tb = (nodes.current.decks[target].bpmBase || 120) * (nodes.current.decks[target].rate || 1);
      const sb = (dk.bpmBase || 120) * (dk.rate || 1);
      if (!tb || !sb) return;
      (api as any).setTempo(d, (tb / (dk.bpmBase || 120) - 1) * 100);
      force((x) => x + 1);
    },
    setMasterDeck: (d: 0 | 1) => { ensure(); nodes.current.masterDeck = nodes.current.masterDeck === d ? null : d; force((x) => x + 1); },
    setVinyl: (d: 0 | 1, on: boolean) => { ensure(); nodes.current.decks[d].vinyl = on; force((x) => x + 1); },
    setQuantize: (d: 0 | 1, on: boolean) => { ensure(); nodes.current.decks[d].quant = on; force((x) => x + 1); },
    // INSTANT DOUBLES (SYNC long-press): misma pista + misma posición al otro deck
    instantDoubles: (d: 0 | 1) => {
      const dk = nodes.current.decks?.[d]; if (!dk?.buf) return false;
      const o: 0 | 1 = d === 0 ? 1 : 0; const od = nodes.current.decks[o];
      const pos = (api as any)._pos(d);
      od.buf = dk.buf; od.fileName = dk.fileName; od.bpmBase = dk.bpmBase;
      od.hotcues = [...dk.hotcues];
      od.loopBeats = dk.loopBeats; od.manualLoop = dk.manualLoop; od.manualIn = dk.manualIn; od.manualEnd = dk.manualEnd; od.loopOn = dk.loopOn;
      od.rate = dk.rate; od.masterTempo = dk.masterTempo; od.range = dk.range;
      od.cuePt = pos; od.cueReady = true; od.previewing = false;
      od.offsetBase = pos; od.startStamp = ctxRef.current?.currentTime ?? 0; od.stopped = false;
      try { od.osc.disconnect(); } catch { /* noop */ }
      od.srcGain.gain.value = 0;
      (api as any)._spawn(o);
      od.xf.gain.setTargetAtTime(api._xfGain(o), ctxRef.current!.currentTime, 0.05);
      setHasFile((p) => (o === 0 ? [true, p[1]] : [p[0], true]));
      setPlaying((p) => (o === 0 ? [true, p[1]] : [p[0], true]));
      force((x) => x + 1);
      return true;
    },
    // LOOP IN / LOOP OUT manuales (como los botones LOOP IN/OUT físicos)
    loopIn: (d: 0 | 1) => {
      const dk = nodes.current.decks?.[d]; if (!dk?.buf) return;
      const pos = (api as any)._pos(d);
      dk.loopInPt = dk.quant ? (api as any)._quantSnap(d, pos) : pos;
      force((x) => x + 1);
    },
    loopOut: (d: 0 | 1) => {
      const dk = nodes.current.decks?.[d]; if (!dk?.buf || dk.loopInPt == null) return;
      const pos = (api as any)._pos(d);
      const beat = 60 / (dk.bpmBase || 120);
      dk.manualIn = dk.loopInPt;
      dk.manualEnd = pos > dk.loopInPt + 0.05 ? pos : dk.loopInPt + beat;
      dk.manualLoop = true; dk.loopBeats = 0; dk.loopOn = true; dk.loopInPt = null;
      if (dk.slipOn) { dk.ghostBase = (api as any)._pos(d); dk.ghostStamp = ctxRef.current?.currentTime ?? 0; dk.slipMod = true; }
      if (dk.stopped) { force((x) => x + 1); return; }
      try {
        if (dk.fileSrc) { dk.fileSrc.loop = true; dk.fileSrc.loopStart = dk.manualIn; dk.fileSrc.loopEnd = dk.manualEnd; }
      } catch { /* noop */ }
      force((x) => x + 1);
    },
    // Auriculares: nivel y mezcla cue↔master (en web salen por el mismo parlante)
    setPhoneLevel: (v: number) => {
      const N = nodes.current; if (!N.decks) return; N.phoneLevel = v;
      N.decks.forEach((dk: any) => dk.cueMon && dk.phone.gain.setTargetAtTime(v * (1 - (N.phoneMix ?? 0)), ctxRef.current?.currentTime ?? 0, 0.03));
      force((x) => x + 1);
    },
    setPhoneMix: (v: number) => {
      const N = nodes.current; if (!N.decks) return; N.phoneMix = v;
      N.decks.forEach((dk: any) => dk.cueMon && dk.phone.gain.setTargetAtTime((N.phoneLevel ?? 0.9) * (1 - v), ctxRef.current?.currentTime ?? 0, 0.03));
      force((x) => x + 1);
    },
    setHotCue: (d: 0 | 1, i: number) => { ensure(); nodes.current.decks[d].hotcues[i] = (api as any)._pos(d); force((x) => x + 1); },
    triggerHotCue: (d: 0 | 1, i: number) => {
      const dk = nodes.current.decks?.[d];
      const p = dk?.hotcues?.[i];
      if (p == null || !dk) return;
      // SLIP: guarda la posición fantasma antes de saltar
      if (dk.slipOn) { dk.ghostBase = (api as any)._pos(d); dk.ghostStamp = ctxRef.current?.currentTime ?? 0; }
      (api as any)._seek(d, p || 0);
      (api as any).play(d);
    },
    deleteHotCue: (d: 0 | 1, i: number) => { if (nodes.current.decks?.[d]) { nodes.current.decks[d].hotcues[i] = null; force((x) => x + 1); } },
    // ---- v12.0 SLIP: la pista sigue avanzando en fantasma bajo loops/hot cues ----
    setSlip: (d: 0 | 1, on: boolean) => {
      const dk = nodes.current.decks?.[d]; if (!dk) return;
      dk.slipOn = on;
      if (on) { dk.ghostBase = (api as any)._pos(d); dk.ghostStamp = ctxRef.current?.currentTime ?? 0; }
      else if (dk.slipMod) { // al salir de slip con loop/hot cue activo → vuelve a la fantasma
        dk.slipMod = false;
        const gh = ((dk.ghostBase || 0) + ((ctxRef.current?.currentTime ?? 0) - (dk.ghostStamp || 0)) + (dk.buf?.duration || 0)) % (dk.buf?.duration || 1);
        (api as any)._seek(d, gh);
      }
      force((x) => x + 1);
    },
    // ---- v13.1 CUE de monitor (pre-fader, como el botón CUE físico) ----
    setCueMon: (d: 0 | 1, on: boolean) => {
      const dk = nodes.current.decks?.[d]; if (!dk) return;
      dk.cueMon = on;
      const N = nodes.current;
      dk.phone.gain.setTargetAtTime(on ? (N.phoneLevel ?? 0.9) * (1 - (N.phoneMix ?? 0)) : 0, ctxRef.current?.currentTime ?? 0, 0.03);
      force((x) => x + 1);
    },
    // TIME MODE (AUTO CUE button): alterna tiempo transcurrido / restante
    toggleTimeMode: () => { ensure(); nodes.current.timeMode = nodes.current.timeMode === 'remain' ? 'elapsed' : 'remain'; force((x) => x + 1); },
    // ---- v12.0 REV (momentáneo, estilo real: suelta y para) ----
    startRev: (d: 0 | 1) => {
      const dk = nodes.current.decks?.[d]; if (!dk || dk.revTimer) return;
      (api as any).play(d);
      dk.revTimer = setInterval(() => {
        const cur = (api as any)._pos(d);
        (api as any)._seek(d, Math.max(0, cur - 0.18));
      }, 90);
    },
    stopRev: (d: 0 | 1) => {
      const dk = nodes.current.decks?.[d]; if (!dk?.revTimer) return;
      clearInterval(dk.revTimer); dk.revTimer = 0;
      (api as any).pause(d);
    },
    setBeatLoop: (d: 0 | 1, beats: number) => {
      const dk = nodes.current.decks?.[d]; if (!dk?.buf) return;
      const pos = (api as any)._pos(d);
      dk.loopBeats = beats; dk.loopOn = true; dk.manualLoop = false;
      const beat = 60 / (dk.bpmBase || 120);
      if (dk.slipOn) { dk.ghostBase = pos; dk.ghostStamp = ctxRef.current?.currentTime ?? 0; dk.slipMod = true; }
      if (dk.stopped) { force((x) => x + 1); return; } // en pausa: se aplica al reanudar (_spawn)
      try { if (dk.fileSrc) { dk.fileSrc.loop = true; dk.fileSrc.loopStart = pos; dk.fileSrc.loopEnd = Math.min(dk.buf.duration, pos + beats * beat); } } catch { /* noop */ }
      force((x) => x + 1);
    },
    loopHalfDouble: (d: 0 | 1, dir: 1 | -1) => {
      const dk = nodes.current.decks?.[d]; if (!dk?.loopBeats) return;
      (api as any).setBeatLoop(d, dir === 1 ? dk.loopBeats * 2 : Math.max(0.25, dk.loopBeats / 2));
    },
    reloopExit: (d: 0 | 1) => {
      const dk = nodes.current.decks?.[d]; if (!dk) return;
      dk.loopOn = !dk.loopOn;
      try {
        if (!dk.loopOn) {
          if (dk.fileSrc) dk.fileSrc.loop = false;
          // SLIP: al salir del loop vuelve a la posición fantasma
          if (dk.slipOn && dk.slipMod) {
            dk.slipMod = false;
            const gh = ((dk.ghostBase || 0) + ((ctxRef.current?.currentTime ?? 0) - (dk.ghostStamp || 0)) + (dk.buf?.duration || 0)) % (dk.buf?.duration || 1);
            (api as any)._seek(d, gh);
          }
        } else if (dk.manualLoop && !dk.stopped && dk.fileSrc) {
          dk.fileSrc.loop = true; dk.fileSrc.loopStart = dk.manualIn; dk.fileSrc.loopEnd = dk.manualEnd;
        } else if (dk.loopBeats) (api as any).setBeatLoop(d, dk.loopBeats);
      } catch { /* noop */ }
      force((x) => x + 1);
    },
    // ---- SUPER PRO: color FX por deck ----
    setColorFX: (d: 0 | 1, type: string) => {
      const ctx = ensure(); const dk = nodes.current.decks[d];
      dk.colorType = type;
      try {
        const f = dk.color;
        if (type === 'FILTER') { f.type = 'lowpass'; f.frequency.setTargetAtTime(18000, ctx.currentTime, 0.03); }
        else if (type === 'SWEEP') { f.type = 'bandpass'; f.frequency.setTargetAtTime(1000, ctx.currentTime, 0.03); f.Q.value = 2; }
        else if (type === 'DUB ECHO') {
          f.type = 'allpass';
          if (!dk.dub) {
            const dl = ctx.createDelay(1); dl.delayTime.value = 0.375;
            const fb = ctx.createGain(); fb.gain.value = 0.45;
            const wet = ctx.createGain(); wet.gain.value = 0;
            dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(dk.an);
            const send = ctx.createGain(); send.gain.value = 1; dk.ch.connect(send); send.connect(dl);
            dk.dub = { dl, fb, wet };
          }
          dk.dub.wet.gain.setTargetAtTime(0.5, ctx.currentTime, 0.05);
        } else if (type === 'NOISE') {
          f.type = 'highpass'; f.frequency.setTargetAtTime(4000, ctx.currentTime, 0.03);
          if (!dk.noiseSrc) {
            const len = ctx.sampleRate;
            const nb = ctx.createBuffer(1, len, ctx.sampleRate);
            const ch0 = nb.getChannelData(0);
            for (let i = 0; i < len; i++) ch0[i] = Math.random() * 2 - 1;
            const ns = ctx.createBufferSource(); ns.buffer = nb; ns.loop = true;
            const ng = ctx.createGain(); ng.gain.value = 0;
            ns.connect(ng); ng.connect(dk.trim); ns.start();
            dk.noiseSrc = ns; dk.noiseGain = ng;
          }
          dk.noiseGain.gain.setTargetAtTime(0.12, ctx.currentTime, 0.1);
        }
        if (type !== 'DUB ECHO' && dk.dub) dk.dub.wet.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
        if (type !== 'NOISE' && dk.noiseGain) dk.noiseGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      } catch { /* noop */ }
      force((x) => x + 1);
    },
    // ---- SUPER PRO: beat FX (grafo compartido: delay + reverb + LFO flanger) ----
    _fxEnsure: () => {
      const ctx = ensure(); const N = nodes.current;
      if (N.fxWet) return;
      const dl = ctx.createDelay(2); const fb = ctx.createGain(); fb.gain.value = 0.4;
      const wet = ctx.createGain(); wet.gain.value = 0;
      const len = Math.floor(ctx.sampleRate * 1.5);
      const imp = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const dd = imp.getChannelData(c); for (let i = 0; i < len; i++) dd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5); }
      const conv = ctx.createConvolver(); conv.buffer = imp;
      const vwet = ctx.createGain(); vwet.gain.value = 0;
      const sendMaster = ctx.createGain(); sendMaster.gain.value = 1;
      const send1 = ctx.createGain(); send1.gain.value = 1;
      const send2 = ctx.createGain(); send2.gain.value = 1;
      N.fxIn.connect(sendMaster);           // MASTER: post-crossfader
      N.decks[0].ch.connect(send1);         // CH1/CH2: pre-fader
      N.decks[1].ch.connect(send2);
      dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(N.master);
      conv.connect(vwet); vwet.connect(N.master);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.5;
      const lg = ctx.createGain(); lg.gain.value = 0;
      lfo.connect(lg); lg.connect(dl.delayTime); lfo.start();
      N.fxWet = wet; N.fxVerb = vwet; N.fxDelay = dl; N.fxLfoGain = lg; N.fxConv = conv;
      N.fxSends = { MASTER: sendMaster, '1': send1, '2': send2 };
      // Solo entra al FX el canal seleccionado en el switch CH SELECT
      const chSel: 'MASTER' | '1' | '2' = N.fxChannel || 'MASTER';
      (['MASTER', '1', '2'] as const).forEach((k) => {
        if (k === chSel && N.fxSends[k]) { N.fxSends[k].connect(dl); N.fxSends[k].connect(conv); }
      });
    },
    // CH SELECT (1 / 2 / MASTER): a qué canal aplica el Beat FX
    setFxChannel: (sel: '1' | '2' | 'MASTER') => {
      const N = nodes.current;
      (api as any)._fxEnsure();
      N.fxChannel = sel;
      (['MASTER', '1', '2'] as const).forEach((k) => {
        const s = N.fxSends?.[k];
        if (!s) return;
        try { s.disconnect(N.fxDelay); } catch { /* noop */ }
        try { s.disconnect(N.fxConv); } catch { /* noop */ }
        if (k === sel) { try { s.connect(N.fxDelay); s.connect(N.fxConv); } catch { /* noop */ } }
      });
      force((x) => x + 1);
    },
    setBeatFX: (type: string, level: number, time: number) => {
      const ctx = ensure(); const N = nodes.current;
      N.fxType = type; N.fxLevel = level; N.fxTime = time;
      try {
        (api as any)._fxEnsure();
        N.fxDelay.delayTime.setTargetAtTime(Math.max(0.03, time), ctx.currentTime, 0.03);
        const on = N.fxOn;
        N.fxWet.gain.setTargetAtTime(on && type !== 'REVERB' ? level : 0, ctx.currentTime, 0.03);
        N.fxVerb.gain.setTargetAtTime(on && type === 'REVERB' ? level : 0, ctx.currentTime, 0.03);
        N.fxLfoGain.gain.setTargetAtTime(type === 'FLANGER' ? 0.004 : 0, ctx.currentTime, 0.05);
      } catch { /* noop */ }
      force((x) => x + 1);
    },
    fxOnOff: (on: boolean) => {
      const N = nodes.current; N.fxOn = on;
      if (!ctxRef.current || !N.fxWet) { if (on) (api as any)._fxEnsure(); if (ctxRef.current) (api as any).setBeatFX(N.fxType || 'ECHO', N.fxLevel ?? 0.5, N.fxTime ?? 0.375); force((x) => x + 1); return; }
      const t = ctxRef.current.currentTime;
      if (!on) { N.fxWet.gain.setTargetAtTime(0, t, 0.03); N.fxVerb.gain.setTargetAtTime(0, t, 0.03); }
      else (api as any).setBeatFX(N.fxType || 'ECHO', N.fxLevel ?? 0.5, N.fxTime ?? 0.375);
    },
    // Atajos Beat FX: mantienen el resto de parámetros
    setFxType: (type: string) => { const N = nodes.current; N.fxType = type; (api as any).setBeatFX(type, N.fxLevel ?? 0.5, N.fxTime ?? 0.375); },
    setFxLevel: (v: number) => { const N = nodes.current; N.fxLevel = v; (api as any).setBeatFX(N.fxType || 'ECHO', v, N.fxTime ?? 0.375); },
    // Fracción de beat (BEAT c/d): el tiempo del efecto = fracción × 60/BPM master
    setFxBeat: (frac: number) => {
      const N = nodes.current;
      const md = N.masterDeck ?? 0;
      const bpm = (N.decks?.[md]?.bpmBase || 120) * (N.decks?.[md]?.rate || 1);
      N.fxBeat = frac;
      (api as any).setBeatFX(N.fxType || 'ECHO', N.fxLevel ?? 0.5, Math.max(0.03, (frac * 60) / bpm));
    },
    fxFrac: () => nodes.current.fxBeat ?? 1,
    tapTempo: (() => {
      let taps: number[] = [];
      return () => {
        const now = performance.now();
        taps = [...taps.filter((t) => now - t < 2000), now];
        if (taps.length >= 2) {
          const bpm = 60000 / ((taps[taps.length - 1] - taps[0]) / (taps.length - 1));
          const beat = 60 / bpm;
          nodes.current.fxTime = beat / 2;
          if (nodes.current.fxDelay && ctxRef.current) nodes.current.fxDelay.delayTime.setTargetAtTime(beat / 2, ctxRef.current.currentTime, 0.02);
          force((x) => x + 1);
          return Math.round(bpm);
        }
        return 0;
      };
    })(),
    deckHot: (d: 0 | 1) => (nodes.current.decks?.[d]?.hotcues ?? [null, null, null, null, null, null, null, null]) as (number | null)[],
    trackInfo: (d: 0 | 1) => {
      const dk = nodes.current.decks?.[d];
      return { name: dk?.fileName || '', duration: dk?.buf?.duration || 0, hasFile: !!(dk?.buf || dk?.fileSrc) };
    },
    setMicLevel: (v: number) => {
      const ctx = ensure(); const N = nodes.current;
      try {
        if (!N.micGain) { N.micGain = ctx.createGain(); N.micGain.gain.value = 0; N.micGain.connect(N.master); }
        N.micGain.gain.setTargetAtTime(v, ctx.currentTime, 0.03); // demo: sin fuente de micro en web
      } catch { /* noop */ }
    },
    deckState: (d: 0 | 1) => {
      const dk = nodes.current.decks?.[d];
      const N = nodes.current;
      if (!dk) return { pitch: '+0.0', range: 8, mt: false, bpm: '---', time: '0:00', remain: '-0:00', color: 'FILTER', loop: 0, loopLabel: '', key: '0.0', slip: false, cueMon: false, cueBlink: false, vinyl: true, quant: true, master: false, timeMode: 'elapsed' as const, artist: '', title: '', pos01: 0 };
      const rate = dk.rate || 1;
      const pos = (api as any)._pos ? (api as any)._pos(d) : 0;
      const dur = dk.buf?.duration || 0;
      const fmt = (s: number) => Math.floor(s / 60) + ':' + Math.floor(s % 60).toString().padStart(2, '0');
      // KEY musical en semitonos respecto al original
      const semis = 12 * Math.log2(rate);
      // "Artista - Título" del nombre de archivo (si trae separador)
      const base = (dk.fileName || '').replace(/\.[a-z0-9]+$/i, '');
      const parts = base.split(/\s+[-–—]\s+/);
      const artist = parts.length > 1 ? parts[0] : '';
      const title = parts.length > 1 ? parts.slice(1).join(' - ') : base;
      return {
        pitch: (((rate - 1) * 100) >= 0 ? '+' : '') + ((rate - 1) * 100).toFixed(1),
        range: dk.range || 8, mt: !!dk.masterTempo,
        bpm: dk.buf ? ((dk.bpmBase || 120) * rate).toFixed(1) : '---',
        time: fmt(pos), remain: dur ? '-' + fmt(Math.max(0, dur - pos)) : '-0:00',
        color: dk.colorType || 'FILTER', loop: dk.loopBeats || 0,
        loopLabel: dk.manualLoop && !dk.loopBeats ? 'IN→OUT' : (dk.loopBeats ? `${dk.loopBeats} BEATS` : ''),
        key: (semis >= 0 ? '+' : '') + semis.toFixed(1),
        slip: !!dk.slipOn,
        cueMon: !!dk.cueMon,
        // Parpadeo del CUE: en pausa con punto CUE listo (como el hardware)
        cueBlink: !!dk.cueReady && !playing[d] && !dk.previewing,
        vinyl: dk.vinyl !== false, quant: dk.quant !== false,
        master: N.masterDeck === d,
        timeMode: (N.timeMode || 'elapsed') as 'elapsed' | 'remain',
        artist, title,
        pos01: dur ? pos / dur : 0,
      };
    },
    getLevels(): { deck: [number, number]; master: number } {
      const read = (an: AnalyserNode | undefined) => {
        if (!an) return 0;
        const a = new Uint8Array(an.frequencyBinCount);
        an.getByteTimeDomainData(a);
        let peak = 0;
        for (let i = 0; i < a.length; i++) { const v = Math.abs(a[i] - 128) / 128; if (v > peak) peak = v; }
        return Math.min(1, peak);
      };
      if (!ctxRef.current || !nodes.current.decks) return { deck: [0, 0], master: 0 };
      return { deck: [read(nodes.current.decks[0]?.an), read(nodes.current.decks[1]?.an)], master: read(nodes.current.masterAn) };
    },
    fileName: (d: 0 | 1) => nodes.current.decks?.[d]?.fileName ?? '',
    dispose: () => { try { nodes.current.decks?.forEach((dk: any) => { try { dk.fileSrc?.stop(); } catch { /* noop */ } try { dk.osc?.stop(); } catch { /* noop */ } }); ctxRef.current?.close(); } catch { /* noop */ } ctxRef.current = null; },
  };

  // Móvil suspende el AudioContext al cambiar de pestaña / perder foco →
  // reanudamos al volver (el audio sigue: no se pierde la reproducción).
  useEffect(() => {
    const resume = () => {
      const ctx = ctxRef.current;
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => { /* requiere gesto */ });
    };
    const onVis = () => { if (!document.hidden) resume(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pageshow', resume);
    window.addEventListener('focus', resume);
    const id = setInterval(resume, 5000); // red si el navegador suspende en background
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pageshow', resume);
      window.removeEventListener('focus', resume);
      clearInterval(id);
    };
  }, []);

  useEffect(() => () => { try { ctxRef.current?.close(); } catch { /* noop */ } }, []);
  return api;
}

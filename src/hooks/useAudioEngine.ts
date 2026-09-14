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
      decks.push({ osc, srcGain, trim, low, mid, high, color, ch, an, xf, buf: null as AudioBuffer | null, fileSrc: null as AudioBufferSourceNode | null, fileName: '', rate: 1, range: 8, masterTempo: false, hotcues: [null, null, null, null, null, null, null, null] as (number | null)[], loopBeats: 0, loopOn: true, startStamp: 0, offsetBase: 0, colorType: 'FILTER' });
    }
    nodes.current = { ctx, master, masterAn, fxIn, decks, fxType: 'ECHO', fxLevel: 0.5, fxTime: 0.375, fxOn: false, micGain: null as GainNode | null };
    return ctx;
  };

  const api = {
    playing, hasFile, ready: () => !!ctxRef.current,
    resume: async () => { const ctx = ensure(); if (ctx.state === 'suspended') await ctx.resume(); return ctx; },
    play: async (d: 0 | 1) => { const ctx = ensure(); if (ctx.state === 'suspended') await ctx.resume(); const t = ctx.currentTime; nodes.current.decks[d].xf.gain.setTargetAtTime(api._xfGain(d), t, 0.05); setPlaying((p) => (d === 0 ? [true, p[1]] : [p[0], true])); },
    pause: async (d: 0 | 1) => { if (!ctxRef.current) return; const ctx = ctxRef.current; if (ctx.state === 'suspended') await ctx.resume(); nodes.current.decks[d].xf.gain.setTargetAtTime(0, ctx.currentTime, 0.05); setPlaying((p) => (d === 0 ? [false, p[1]] : [p[0], false])); },
    cue: async (d: 0 | 1) => { await api.play(d); setTimeout(() => api.pause(d), 400); },
    _xf: 0.5, _ch: [0.9, 0.9] as [number, number],
    _xfGain(d: number) { const x = api._xf; const base = api._ch[d]; return d === 0 ? base * Math.cos((x * Math.PI) / 2) : base * Math.cos(((1 - x) * Math.PI) / 2); },
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
    async loadBlob(d: 0 | 1, blob: Blob, name: string) {
      const ctx = ensure();
      if (ctx.state === 'suspended') await ctx.resume();
      const ab = await blob.arrayBuffer();
      const buf = await ctx.decodeAudioData(ab);
      const dk = nodes.current.decks[d];
      dk.buf = buf; dk.fileName = name;
      // silencia oscilador y conecta buffer en loop
      dk.osc.disconnect(); dk.srcGain.gain.value = 0; // reset
      try { dk.fileSrc?.stop(); } catch { /* noop */ }
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const g = ctx.createGain(); g.gain.value = 1;
      src.connect(g); g.connect(dk.trim);
      // re-conecta osc apagado: baja srcGain osc — simplificado: osc ya desconectado
      src.start();
      dk.fileSrc = src; dk.startStamp = ctx.currentTime; dk.offsetBase = 0;
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
        if (dk.fileSrc?.playbackRate) dk.fileSrc.playbackRate.setTargetAtTime(dk.masterTempo ? 1 : dk.rate, ctx.currentTime, 0.02);
        if (dk.osc?.detune) dk.osc.detune.setTargetAtTime(dk.masterTempo ? 0 : cl * 100, ctx.currentTime, 0.02);
      } catch { /* noop */ }
      force((x) => x + 1);
    },
    resetTempo: (d: 0 | 1) => { (api as any).setTempo(d, 0); },
    setTempoRange: (d: 0 | 1, r: number) => { ensure(); nodes.current.decks[d].range = r; force((x) => x + 1); },
    setMasterTempo: (d: 0 | 1, on: boolean) => { ensure(); const dk = nodes.current.decks[d]; dk.masterTempo = on; (api as any).setTempo(d, ((dk.rate || 1) - 1) * 100); },
    _pos: (d: 0 | 1) => {
      const dk = nodes.current.decks?.[d]; if (!dk?.buf || !ctxRef.current) return 0;
      const el = (dk.offsetBase || 0) + (ctxRef.current.currentTime - (dk.startStamp || 0));
      return ((el % dk.buf.duration) + dk.buf.duration) % dk.buf.duration;
    },
    _seek: (d: 0 | 1, offset: number) => {
      const ctx = ensure(); const dk = nodes.current.decks[d];
      if (!dk.buf) return;
      try { dk.fileSrc?.stop(); } catch { /* noop */ }
      const src = ctx.createBufferSource(); src.buffer = dk.buf; src.loop = dk.loopOn !== false;
      if (dk.loopBeats) { src.loopStart = offset; src.loopEnd = Math.min(dk.buf.duration, offset + dk.loopBeats * 0.5); }
      src.playbackRate.value = dk.masterTempo ? 1 : dk.rate || 1;
      const g = ctx.createGain(); g.gain.value = 1;
      src.connect(g); g.connect(dk.trim); src.start();
      dk.fileSrc = src; dk.startStamp = ctx.currentTime; dk.offsetBase = offset;
    },
    setHotCue: (d: 0 | 1, i: number) => { ensure(); nodes.current.decks[d].hotcues[i] = (api as any)._pos(d); force((x) => x + 1); },
    triggerHotCue: (d: 0 | 1, i: number) => { const p = nodes.current.decks?.[d]?.hotcues?.[i]; if (p == null) return; (api as any)._seek(d, p || 0); (api as any).play(d); },
    deleteHotCue: (d: 0 | 1, i: number) => { if (nodes.current.decks?.[d]) { nodes.current.decks[d].hotcues[i] = null; force((x) => x + 1); } },
    setBeatLoop: (d: 0 | 1, beats: number) => {
      const dk = nodes.current.decks?.[d]; if (!dk?.buf) return;
      const pos = (api as any)._pos(d);
      dk.loopBeats = beats; dk.loopOn = true;
      try { if (dk.fileSrc) { dk.fileSrc.loop = true; dk.fileSrc.loopStart = pos; dk.fileSrc.loopEnd = Math.min(dk.buf.duration, pos + beats * 0.5); } } catch { /* noop */ }
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
        if (!dk.loopOn && dk.fileSrc) dk.fileSrc.loop = false;
        else if (dk.loopBeats) (api as any).setBeatLoop(d, dk.loopBeats);
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
    // ---- SUPER PRO: beat FX en master ----
    setBeatFX: (type: string, level: number, time: number) => {
      const ctx = ensure(); const N = nodes.current;
      N.fxType = type; N.fxLevel = level; N.fxTime = time;
      try {
        if (!N.fxWet) {
          const dl = ctx.createDelay(2); const fb = ctx.createGain(); fb.gain.value = 0.4;
          const wet = ctx.createGain(); wet.gain.value = 0;
          const len = Math.floor(ctx.sampleRate * 1.5);
          const imp = ctx.createBuffer(2, len, ctx.sampleRate);
          for (let c = 0; c < 2; c++) { const dd = imp.getChannelData(c); for (let i = 0; i < len; i++) dd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5); }
          const conv = ctx.createConvolver(); conv.buffer = imp;
          const vwet = ctx.createGain(); vwet.gain.value = 0;
          const send = ctx.createGain(); send.gain.value = 1;
          N.fxIn.connect(send); send.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(N.master);
          send.connect(conv); conv.connect(vwet); vwet.connect(N.master);
          const lfo = ctx.createOscillator(); lfo.frequency.value = 0.5;
          const lg = ctx.createGain(); lg.gain.value = 0;
          lfo.connect(lg); lg.connect(dl.delayTime); lfo.start();
          N.fxWet = wet; N.fxVerb = vwet; N.fxDelay = dl; N.fxLfoGain = lg;
        }
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
      if (!ctxRef.current || !N.fxWet) { force((x) => x + 1); return; }
      const t = ctxRef.current.currentTime;
      if (!on) { N.fxWet.gain.setTargetAtTime(0, t, 0.03); N.fxVerb.gain.setTargetAtTime(0, t, 0.03); }
      else (api as any).setBeatFX(N.fxType || 'ECHO', N.fxLevel ?? 0.5, N.fxTime ?? 0.375);
    },
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
    deckState: (d: 0 | 1) => {      const dk = nodes.current.decks?.[d];
      if (!dk) return { pitch: '+0.0', range: 8, mt: false, bpm: '---', time: '0:00', color: 'FILTER', loop: 0 };
      const rate = dk.rate || 1;
      const pos = (api as any)._pos ? (api as any)._pos(d) : 0;
      const dur = dk.buf?.duration || 0;
      const fmt = (s: number) => Math.floor(s / 60) + ':' + Math.floor(s % 60).toString().padStart(2, '0');
      return {
        pitch: (((rate - 1) * 100) >= 0 ? '+' : '') + ((rate - 1) * 100).toFixed(1),
        range: dk.range || 8, mt: !!dk.masterTempo,
        bpm: dk.buf ? (120 * rate).toFixed(1) : '---',
        time: fmt(pos), remain: dur ? '-' + fmt(Math.max(0, dur - pos)) : '-0:00',
        color: dk.colorType || 'FILTER', loop: dk.loopBeats || 0,
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
  useEffect(() => () => { try { ctxRef.current?.close(); } catch { /* noop */ } }, []);
  return api;
}

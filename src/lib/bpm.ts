// Detección de BPM (modo AUTO del XDJ-RR: rango oficial 70–180 BPM).
// Flujo energético (onsets) + autocorrelación; dobla octavas al rango útil.
export function detectBpm(buf: AudioBuffer): number {
  try {
    const sr = buf.sampleRate;
    const ch = buf.getChannelData(0);
    const hop = 1024;
    const frames = Math.floor(ch.length / hop);
    if (frames < 64) return 0;
    const env = new Float32Array(frames);
    let prevE = 0;
    for (let i = 0; i < frames; i++) {
      let e = 0;
      const s = i * hop;
      const end = Math.min(s + hop, ch.length);
      let n = 0;
      for (let j = s; j < end; j += 8) { const v = ch[j]; e += v * v; n++; }
      e = n ? Math.sqrt(e / n) : 0;
      env[i] = Math.max(0, e - prevE); // flujo energético = onsets
      prevE = e;
    }
    const fps = sr / hop;
    const minLag = Math.max(2, Math.floor((fps * 60) / 180));
    const maxLag = Math.min(frames - 8, Math.ceil((fps * 60) / 70));
    let best = -1;
    let bestLag = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let sum = 0;
      for (let i = 0; i + lag < frames; i++) sum += env[i] * env[i + lag];
      const norm = sum / (frames - lag);
      if (norm > best) { best = norm; bestLag = lag; }
    }
    if (!bestLag) return 0;
    let bpm = (60 * fps) / bestLag;
    while (bpm < 70) bpm *= 2;  // pliegue de octava dentro del rango 70–180
    while (bpm > 180) bpm /= 2;
    return Math.round(bpm * 10) / 10;
  } catch {
    return 0;
  }
}

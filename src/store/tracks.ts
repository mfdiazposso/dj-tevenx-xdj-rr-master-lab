import { create } from 'zustand';
import { del, get, set } from 'idb-keyval';

export interface TrackMeta {
  id: string;
  name: string;
  duration: number; // s
  size: number; // bytes
  peaks: number[]; // 120 buckets 0..1 (persistido en localStorage)
}

const META_KEY = 'rr-tracks-meta';
const MAX_TRACKS = 10;
const MAX_BYTES = 50 * 1024 * 1024;

function loadMeta(): TrackMeta[] {
  try { return JSON.parse(localStorage.getItem(META_KEY) || '[]'); } catch { return []; }
}
function saveMeta(t: TrackMeta[]) {
  try { localStorage.setItem(META_KEY, JSON.stringify(t)); } catch { /* quota: picos recortados */ }
}

function peaksOf(buf: AudioBuffer, n = 120): number[] {
  const ch = buf.getChannelData(0);
  const out: number[] = [];
  const step = Math.max(1, Math.floor(ch.length / n));
  for (let i = 0; i < n; i++) {
    let p = 0;
    const s = i * step;
    for (let j = s; j < Math.min(s + step, ch.length); j += 7) {
      const v = Math.abs(ch[j]);
      if (v > p) p = v;
    }
    out.push(Math.min(1, p));
  }
  return out;
}

async function decode(file: Blob): Promise<AudioBuffer> {
  const ab = await file.arrayBuffer();
  const Ctx = window.AudioContext || (window as any).webkitAudioContext;
  const ctx: AudioContext = new Ctx();
  try {
    return await ctx.decodeAudioData(ab);
  } finally {
    try { await ctx.close(); } catch { /* noop */ }
  }
}

interface TracksState {
  tracks: TrackMeta[];
  error: string | null;
  addFiles: (files: FileList | File[]) => Promise<void>;
  removeTrack: (id: string) => Promise<void>;
  getBlob: (id: string) => Promise<Blob | undefined>;
  usedBytes: () => number;
}

export const MAX_TRACK_COUNT = MAX_TRACKS;

export const useTracks = create<TracksState>()((setState, getState) => ({
  tracks: loadMeta(),
  error: null,
  usedBytes: () => getState().tracks.reduce((a, t) => a + t.size, 0),
  getBlob: (id: string) => get(`rr-track-${id}`) as Promise<Blob | undefined>,
  addFiles: async (files) => {
    const list = Array.from(files).filter((f) => f.type.startsWith('audio/') || /\.(mp3|wav|flac|ogg|m4a)$/i.test(f.name));
    if (!list.length) { setState({ error: 'Sin archivos de audio válidos (MP3/WAV/FLAC).' }); return; }
    for (const f of list) {
      const cur = getState().tracks;
      if (cur.length >= MAX_TRACKS) { setState({ error: `Máximo ${MAX_TRACKS} tracks.` }); break; }
      if (f.size > MAX_BYTES) { setState({ error: `"${f.name}": supera 50MB.` }); continue; }
      try {
        const buf = await decode(f);
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        await set(`rr-track-${id}`, f);
        const meta: TrackMeta = { id, name: f.name, duration: buf.duration, size: f.size, peaks: peaksOf(buf) };
        const next = [...getState().tracks, meta];
        setState({ tracks: next, error: null });
        saveMeta(next);
      } catch {
        setState({ error: `"${f.name}": no se pudo decodificar.` });
      }
    }
  },
  removeTrack: async (id) => {
    await del(`rr-track-${id}`);
    const next = getState().tracks.filter((t) => t.id !== id);
    setState({ tracks: next });
    saveMeta(next);
  },
}));

export const fmtTime = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
export const fmtMB = (b: number) => `${(b / 1048576).toFixed(1)}MB`;

import { useEffect, useRef, useState } from 'react';
import { fmtMB, fmtTime, MAX_TRACK_COUNT, useTracks } from '../../store/tracks';
import type { useAudioEngine } from '../../hooks/useAudioEngine';

type Eng = ReturnType<typeof useAudioEngine>;

function Peaks({ peaks, color }: { peaks: number[]; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, c.width, c.height);
    g.fillStyle = color;
    const w = c.width / peaks.length;
    peaks.forEach((p, i) => {
      const h = Math.max(2, p * c.height);
      g.fillRect(i * w, (c.height - h) / 2, Math.max(1, w - 1), h);
    });
  }, [peaks, color]);
  return <canvas ref={ref} width={260} height={80} className="w-full h-[80px] rounded bg-black border border-[#262626] pointer-events-none" />;
}

export default function TrackUploader({ eng }: { eng: Eng }) {
  const { tracks, error, addFiles, removeTrack, getBlob, usedBytes } = useTracks();
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadTo = async (trackId: string, name: string, d: 0 | 1) => {
    const blob = await getBlob(trackId);
    if (!blob) return;
    setBusy(`${trackId}-${d}`);
    try {
      await (eng as any).resume?.();
      await (eng as any).loadBlob(d, blob, name);
      if (navigator.vibrate) navigator.vibrate(10);
    } finally {
      setBusy(null);
    }
  };

  const pct = Math.round((usedBytes() / (MAX_TRACK_COUNT * 50 * 1048576)) * 100);

  return (
    <div className="rounded-xl border border-[#262626] bg-[#0a0a0a] p-3 space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-xs font-black tracking-widest text-[#ff6b00]">MIS TRACKS ({tracks.length}/{MAX_TRACK_COUNT})</p>
        <span className="text-[10px] text-neutral-500">{fmtMB(usedBytes())} · {pct}%</span>
        <button type="button" onClick={() => inputRef.current?.click()}
          className="ml-auto px-4 py-2 rounded-lg bg-[#ff6b00] text-black text-sm font-black touch-manipulation active:scale-95">📁 SUBIR TRACKS</button>
        <input ref={inputRef} type="file" accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a" multiple className="hidden"
          onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files) addFiles(e.dataTransfer.files); }}
        className={`rounded-lg border-2 border-dashed p-4 text-center text-sm transition-colors ${drag ? 'border-[#00d4ff] bg-[#00d4ff]/5 text-white' : 'border-[#262626] text-neutral-500'}`}
      >Arrastra tus tracks aquí — como un USB</div>

      {error && <p className="text-xs text-[#e10600] font-bold">{error}</p>}
      {tracks.length === 0 && (
        <p className="text-sm text-neutral-400 rounded-lg border border-[#ff6b00]/40 bg-[#ff6b00]/5 p-3 animate-pulse">☝ Sube un track para practicar TRIM/GAIN — suena en el deck con EQ + vúmetro vivo.</p>
      )}

      <div className="space-y-2 max-h-72 overflow-y-auto">
        {tracks.map((t, i) => (
          <div key={t.id} className="rounded-lg border border-[#262626] bg-black/40 p-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-bold truncate flex-1">{t.name}</span>
              <span className="text-[11px] text-neutral-500 font-mono">{fmtTime(t.duration)} · {fmtMB(t.size)}</span>
              <button type="button" aria-label={`Borrar ${t.name}`} onClick={() => removeTrack(t.id)}
                className="text-neutral-500 hover:text-[#e10600] px-2 py-1 touch-manipulation">✕</button>
            </div>
            <Peaks peaks={t.peaks} color={i % 2 ? '#ff6b00' : '#00d4ff'} />
            <div className="flex gap-2 mt-1.5">
              {([0, 1] as const).map((d) => (
                <button key={d} type="button" disabled={busy === `${t.id}-${d}`}
                  onClick={() => loadTo(t.id, t.name, d)}
                  className="flex-1 py-2 rounded-lg text-xs font-black border border-[#00B0FF] text-[#00B0FF] touch-manipulation active:scale-95 disabled:opacity-50"
                  style={{ boxShadow: '0 0 12px #00B0FF55' }}>
                  {busy === `${t.id}-${d}` ? '…CARGANDO' : `LOAD ${d + 1}`}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

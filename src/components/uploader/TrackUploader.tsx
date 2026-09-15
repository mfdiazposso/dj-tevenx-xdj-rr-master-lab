import { useRef, useState } from 'react';
import { fmtMB, fmtTime, MAX_TRACK_COUNT, useTracks } from '../../store/tracks';
import type { useAudioEngine } from '../../hooks/useAudioEngine';
import WavePeaks from './WavePeaks';

type Eng = ReturnType<typeof useAudioEngine>;

export default function TrackUploader({ eng }: { eng?: Eng }) {
  const { tracks, error, addFiles, removeTrack, getBlob, usedBytes } = useTracks();
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadTo = async (trackId: string, name: string, d: 0 | 1) => {
    if (!eng) return;
    const blob = await getBlob(trackId);
    if (!blob) return;
    setBusy(`${trackId}-${d}`);
    try {
      await (eng as any).resume?.(); // gesto = unlock iOS
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
          className="ml-auto px-4 py-3 min-h-[44px] rounded-full bg-[#ff6b00] text-black text-sm font-black touch-manipulation active:scale-95">📁 SUBIR TRACKS - WEB + APP</button>
        <input ref={inputRef} type="file" accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a" multiple className="hidden"
          onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files) addFiles(e.dataTransfer.files); }}
        className={`rounded-lg border-2 border-dashed p-4 text-center text-sm transition-colors ${drag ? 'border-[#00d4ff] bg-[#00d4ff]/5 text-white' : 'border-[#262626] text-neutral-500'}`}
      >Arrastra aquí como USB — MP3 / WAV / FLAC (máx 50MB)</div>

      {error && <p className="text-xs text-[#e10600] font-bold">{error}</p>}
      {tracks.length === 0 && (
        <p className="text-sm text-neutral-400 rounded-lg border border-[#ff6b00]/40 bg-[#ff6b00]/5 p-3 animate-pulse">☝ Sube un track para practicar TRIM/GAIN — suena en el deck con EQ + vúmetro vivo.</p>
      )}

      <div className="space-y-2 max-h-72 overflow-y-auto">
        {tracks.map((t) => (
          <div key={t.id} className="rounded-lg border border-[#262626] bg-black/40 p-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-bold truncate flex-1">{t.name}</span>
              <span className="text-[11px] text-neutral-500 font-mono">{fmtTime(t.duration)} · {fmtMB(t.size)}</span>
              <button type="button" aria-label={`Borrar ${t.name}`} onClick={() => removeTrack(t.id)}
                className="text-neutral-500 hover:text-[#e10600] px-2 py-1 touch-manipulation">✕</button>
            </div>
            <WavePeaks peaks={t.peaks} color="#ff6b00" height={80} />
            {eng ? (
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
            ) : (
              <p className="text-[11px] text-neutral-500 mt-1">Ve al SIMULADOR para cargarlo con LOAD 1 / LOAD 2.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

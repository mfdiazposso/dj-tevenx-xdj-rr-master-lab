import { useEffect, useMemo, useRef, useState } from 'react';
import { fmtMB, fmtTime, MAX_TRACK_COUNT, useTracks } from '../../store/tracks';
import type { useAudioEngine } from '../../hooks/useAudioEngine';
import WavePeaks from './WavePeaks';

type Eng = ReturnType<typeof useAudioEngine>;

const ACCEPT = 'audio/*,.mp3,.wav,.flac,.ogg,.m4a,.aac,.opus,.aiff,.aif,.webm';

export default function TrackUploader({ eng, autoOpen }: { eng?: Eng; autoOpen?: boolean }) {
  const { tracks, error, addFiles, removeTrack, getBlob, usedBytes } = useTracks();
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null); // REGLA #5: borrar con confirmación
  // FASE 3: navegador de biblioteca con búsqueda y orden
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'new' | 'name' | 'dur' | 'bpm'>('new');
  const inputRef = useRef<HTMLInputElement>(null);
  const autoRef = useRef(false);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = needle ? tracks.filter((t) => t.name.toLowerCase().includes(needle)) : [...tracks];
    if (sort === 'name') out.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    else if (sort === 'dur') out.sort((a, b) => a.duration - b.duration);
    else if (sort === 'bpm') out.sort((a, b) => (a.bpm ?? 0) - (b.bpm ?? 0));
    else out.reverse(); // 'new': las más recientes primero (se añaden al final)
    return out;
  }, [tracks, q, sort]);

  // "SUBIR TRACKS" del header → abre el selector directamente (una vez por token)
  useEffect(() => {
    if (!autoOpen || autoRef.current) return;
    autoRef.current = true;
    const id = window.setTimeout(() => inputRef.current?.click(), 60);
    return () => window.clearTimeout(id);
  }, [autoOpen]);

  const ingest = async (files: FileList | File[]) => {
    setWorking(true);
    try { await addFiles(files); } finally { setWorking(false); }
  };

  const loadTo = async (trackId: string, name: string, d: 0 | 1) => {
    if (!eng) return;
    setBusy(`${trackId}-${d}`);
    try {
      const blob = await getBlob(trackId);
      if (!blob) return;
      await (eng as any).resume?.();
      // BPM detectado al subir → alimenta cuantización, beat jump, sync y Beat FX
      const meta = useTracks.getState().tracks.find((t) => t.id === trackId);
      await (eng as any).loadBlob(d, blob, name, meta?.bpm);
      if (navigator.vibrate) navigator.vibrate(10);
    } catch {
      /* IndexedDB bloqueado/privado: el resto de la app sigue funcionando */
    } finally {
      setBusy(null);
    }
  };

  const pct = Math.round((usedBytes() / (MAX_TRACK_COUNT * 50 * 1048576)) * 100);

  return (
    <div className="rounded-xl border border-[#22222a] bg-[#070707] p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-black tracking-widest text-[#FF5C00]">MIS TRACKS ({tracks.length}/{MAX_TRACK_COUNT})</p>
        <span className="text-[10px] text-neutral-500 font-mono">{fmtMB(usedBytes())} · {pct}%</span>
        <button type="button" onClick={() => inputRef.current?.click()}
          className="btn-neon ml-auto px-4 min-h-[44px] rounded-full bg-[#FF5C00] text-black text-sm font-black touch-manipulation active:brightness-125">
          📁 ELEGIR ARCHIVOS
        </button>
        <input ref={inputRef} type="file" accept={ACCEPT} multiple className="hidden"
          onChange={(e) => { if (e.target.files) void ingest(e.target.files); e.target.value = ''; }} />
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files) void ingest(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`rounded-lg border-2 border-dashed p-5 text-center text-sm cursor-pointer transition-colors ${drag ? 'border-[#FF5C00] bg-[#FF5C00]/10 text-white' : 'border-[#22222a] text-neutral-500 hover:border-[#FF5C00]/60 hover:text-neutral-300'}`}
      >
        {working ? <span className="text-[#FF5C00] font-black animate-pulse">DECODIFICANDO…</span> : 'Arrastra aquí como USB — MP3 / WAV / FLAC / M4A (máx 50MB)'}
      </div>

      {error && <p className="text-xs text-[#ff4d4d] font-bold">{error}</p>}
      {tracks.length === 0 && !error && (
        <p className="text-sm text-neutral-400 rounded-lg border border-[#FF5C00]/40 bg-[#FF5C00]/5 p-3">☝ Sube un track para practicar TRIM/GAIN — suena en el deck con EQ + vúmetro vivo.</p>
      )}

      {/* Buscador + orden del navegador de biblioteca */}
      {tracks.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar track…"
            aria-label="Buscar en MIS TRACKS"
            className="flex-1 min-w-[140px] min-h-[44px] rounded-lg border border-[#22222a] bg-black px-3 text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-[#FF5C00] focus:outline-none" />
          <div className="flex gap-1" role="group" aria-label="Ordenar biblioteca">
            {([['new', 'NUEVO'], ['name', 'A-Z'], ['dur', 'DUR'], ['bpm', 'BPM']] as const).map(([k, l]) => (
              <button key={k} type="button" aria-label={`Ordenar por ${l}`} onClick={() => setSort(k)}
                className={`min-h-[44px] px-2.5 rounded-lg text-[11px] font-black border touch-manipulation ${sort === k ? 'border-[#FF5C00] bg-[#FF5C00] text-black' : 'border-[#22222a] text-neutral-400 hover:border-[#FF5C00] hover:text-[#FF5C00]'}`}>{l}</button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2 max-h-72 overflow-y-auto overscroll-contain pr-1">
        {list.length === 0 && tracks.length > 0 && (
          <p className="text-sm text-neutral-500 rounded-lg border border-[#22222a] bg-black/40 p-3">Sin resultados para “{q}”.</p>
        )}
        {list.map((t) => (
          <div key={t.id} className="rounded-lg border border-[#22222a] bg-black/40 p-2">
            <div className="flex items-center gap-2 text-sm">
              {/* v14 FASE B B1: min-w-0 + truncate — el nombre del archivo con nowrap
                  inflaba el min-content de la fila (overflow a 280px). */}
              <span className="font-bold truncate flex-1 min-w-0">{t.name}</span>
              <span className="shrink-0 text-[11px] text-neutral-500 font-mono">{fmtTime(t.duration)}{t.bpm ? ` · ${t.bpm} BPM` : ''} · {fmtMB(t.size)}</span>
              {confirmDel === t.id ? (
                <span className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] text-[#ff4d4d] font-black">¿BORRAR?</span>
                  <button type="button" aria-label={`Confirmar borrar ${t.name}`}
                    onClick={() => { void removeTrack(t.id); setConfirmDel(null); if (navigator.vibrate) navigator.vibrate([30, 40, 30]); }}
                    className="text-[#ff4d4d] hover:text-white text-xs font-black px-2 py-1 min-h-[44px] touch-manipulation rounded-lg border border-[#ff4d4d]/60">SÍ</button>
                  <button type="button" aria-label={`Cancelar borrar ${t.name}`} onClick={() => setConfirmDel(null)}
                    className="text-neutral-400 hover:text-white text-xs font-black px-2 py-1 min-h-[44px] touch-manipulation rounded-lg border border-[#22222a]">NO</button>
                </span>
              ) : (
                <button type="button" aria-label={`Borrar ${t.name}`} title="Borrar de la USB"
                  onClick={() => setConfirmDel(t.id)}
                  className="text-neutral-500 hover:text-[#ff4d4d] px-2 py-1 min-h-[44px] touch-manipulation">🗑</button>
              )}
            </div>
            <WavePeaks peaks={t.peaks} color="#FF8A00" height={72} />
            {eng ? (
              <div className="flex gap-2 mt-1.5">
                {([0, 1] as const).map((d) => (
                  <button key={d} type="button" disabled={busy === `${t.id}-${d}`}
                    onClick={() => loadTo(t.id, t.name, d)}
                    className="flex-1 min-h-[44px] rounded-lg text-xs font-black border border-[#FF5C00] text-[#FF5C00] touch-manipulation active:brightness-125 disabled:opacity-50 hover:bg-[#FF5C00]/15"
                    style={{ boxShadow: '0 0 12px #FF5C0055' }}>
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

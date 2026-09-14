import { useState } from 'react';
import { useTracks } from '../../store/tracks';

const POOL = ['Intro 124bpm', 'Groove 125bpm', 'Peak 126bpm', 'Break vocal', 'Drop 128bpm', 'Outro 124bpm'];
const CHECK = ['FAT32 MBR (ExFAT NO)', 'Analizada en rekordbox 6.8+', 'Hot cues A-H con colores', 'Playlists por energía', 'Backup idéntica USB2', 'Probada en RR antes del evento'];

// Simulador de export USB: arrastra tracks → genera estructura PIONEER virtual
export default function UsbExportSim() {
  const { tracks } = useTracks();
  const uploaded = tracks.map((t) => t.name);
  const pool = uploaded.length > 0 ? uploaded : POOL;
  const [sel, setSel] = useState<string[]>([]);
  const [check, setCheck] = useState<string[]>([]);
  const [exported, setExported] = useState(false);

  const toggleTrack = (t: string) => {
    setExported(false);
    setSel((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));
  };
  const toggleCheck = (c: string) => setCheck((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));
  const ready = sel.length >= 3 && check.length === CHECK.length;

  return (
    <div className="rounded-xl border border-[#262626] bg-[#141414] p-4">
      <p className="text-xs font-black tracking-widest text-[#ff6b00]">USB MASTER · SIMULADOR DE EXPORT</p>
      <p className="text-xs text-neutral-400 mt-1">Toca tracks para añadirlos + completa el checklist. Mínimo 3 tracks.</p>
      <div className="grid md:grid-cols-2 gap-3 mt-3">
        <div>
          <p className="text-[11px] font-bold text-neutral-400 mb-1">1 · COLLECTION (toca para añadir)</p>
          <div className="flex flex-wrap gap-1.5">
            {pool.map((t) => (
              <button key={t} type="button" onClick={() => toggleTrack(t)}
                className={`text-xs px-2 py-1.5 rounded-lg border touch-manipulation active:scale-95 ${sel.includes(t) ? 'bg-[#00d4ff] text-black border-[#00d4ff] font-bold' : 'border-[#262626] text-neutral-300'}`}>{sel.includes(t) ? '✓ ' : '+ '}{t}</button>
            ))}
          </div>
          <p className="text-[11px] font-bold text-neutral-400 mt-3 mb-1">2 · CHECKLIST PRE-EVENTO</p>
          <div className="space-y-1">
            {CHECK.map((c) => (
              <button key={c} type="button" onClick={() => toggleCheck(c)}
                className={`block w-full text-left text-xs px-2 py-1.5 rounded-lg border touch-manipulation ${check.includes(c) ? 'border-emerald-600 text-emerald-400' : 'border-[#262626] text-neutral-300'}`}>{check.includes(c) ? '✓ ' : '○ '}{c}</button>
            ))}
          </div>
          <button type="button" disabled={!ready} onClick={() => setExported(true)}
            className={`mt-3 px-4 py-2 rounded-lg text-sm font-black touch-manipulation ${ready ? 'bg-[#ff6b00] text-black active:scale-95' : 'bg-[#1a1a1a] text-neutral-600'}`}>
            ⬇ EXPORTAR A USB
          </button>
        </div>
        <div>
          <p className="text-[11px] font-bold text-neutral-400 mb-1">USB:/ <span className="text-neutral-600">(virtual)</span></p>
          <div className="rounded-lg bg-black border border-[#262626] p-3 font-mono text-xs min-h-[220px]">
            {exported ? (
              <div className="space-y-0.5">
                <p className="text-[#00d4ff]">USB:/</p>
                <p className="pl-3 text-neutral-300">└─ PIONEER/</p>
                <p className="pl-6 text-neutral-300">└─ rekordbox/ <span className="text-neutral-600">(DB + grids + cues)</span></p>
                <p className="pl-3 text-neutral-300">└─ Contents/</p>
                {sel.map((t) => <p key={t} className="pl-6 text-emerald-400">├─ {t}.mp3</p>)}
                <p className="pl-6 text-neutral-400">└─ setlist.m3u <span className="text-neutral-600">({sel.length} tracks)</span></p>
                <p className="pt-2 text-[#ff6b00]">✓ Lista para XDJ-RR · STOP 2s al expulsar</p>
              </div>
            ) : <p className="text-neutral-600">Arrastra (toca) tracks + checklist → EXPORTAR</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

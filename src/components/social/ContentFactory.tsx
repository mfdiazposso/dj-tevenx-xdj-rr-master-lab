import { useRef, useState } from 'react';

export const HOOKS = [
  'El botón TRIM que 90% de DJs de FLX4 no usan',
  'Cómo hacer wash out sin usar ECHO',
  'La XDJ-RR tiene un 3er canal escondido',
  'El roll que no descuadra jamás',
  'Edits que suenan humanos, no robots',
  'TAG LIST no es para tags',
  'Graba tu set sin saturar',
  'Alarga cualquier intro en vivo',
  'Cambia 8% el tempo sin desafinar la voz',
  'Olvida el crossfader en house',
  'Mezcla armónica sin pagar software',
  'El menú que nadie abre',
  'Cambia de USB sin cortar la música',
  'Navega 200 tracks en 5 segundos',
  'El echo infinito de la XDJ-RR',
  'Por qué tu BOOTH suena mejor que tu MASTER',
  'El QUANTIZE que te delata como novato',
  'FILTER vs COLOR: cuándo usar cada uno',
  'El jog de 206mm sí se siente: pruébalo así',
  'MASTER TEMPO siempre ON? Error',
  'El TAP que salva temas sin grid',
  'LOOP 1/2X: el build-up de 10 segundos',
  'REVERSE sin perder la frase con SLIP',
  'BEAT JUMP: el botón más infravalorado',
  'HEADPHONES MIX al centro o nada',
  'TRIM en rojo = limiter del club llorando',
  'HOT CUE A/B/C: prioriza como residente',
  'SHORTCUT antes de cada bolo',
  'USB sin analizar = set arruinado',
  'De FLX4 a XDJ-RR en 30 días',
];

export function ClipModal({ controlName, hook, body, onClose }: { controlName: string; hook: string; body: string; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hi, setHi] = useState(hook);

  const draw = () => {
    const c = canvasRef.current!;
    const g = c.getContext('2d')!;
    g.fillStyle = '#0a0a0a'; g.fillRect(0, 0, 1080, 1920);
    g.fillStyle = '#ff6b00'; g.fillRect(0, 0, 1080, 14);
    g.fillStyle = '#ff6b00'; g.font = '900 44px sans-serif';
    g.fillText('DJ TEVENX · XDJ-RR MASTER LAB', 60, 120);
    g.fillStyle = '#fff'; g.font = '900 84px sans-serif';
    const words = hi.split(' ');
    let line = '', y = 320;
    for (const w of words) {
      if ((line + ' ' + w).length > 22) { g.fillText(line, 60, y); y += 100; line = w; }
      else line = line ? line + ' ' + w : w;
    }
    g.fillText(line, 60, y);
    g.strokeStyle = '#00d4ff'; g.lineWidth = 4;
    g.strokeRect(60, y + 60, 960, 700);
    g.fillStyle = '#00d4ff'; g.font = '700 40px sans-serif';
    g.fillText('▶ ' + controlName, 90, y + 140);
    g.fillStyle = '#ccc'; g.font = '400 38px sans-serif';
    const bw = body.split(' ');
    let bl = '', by = y + 230;
    for (const w of bw) {
      if ((bl + ' ' + w).length > 40) { g.fillText(bl, 90, by); by += 56; bl = w; if (by > y + 700) break; }
      else bl = bl ? bl + ' ' + w : w;
    }
    g.fillText(bl, 90, by);
    g.fillStyle = '#ff6b00'; g.fillRect(0, 1780, 1080, 140);
    g.fillStyle = '#000'; g.font = '900 52px sans-serif';
    g.fillText('@djtevenx · link en bio', 60, 1865);
  };

  const exportPNG = () => {
    draw();
    canvasRef.current!.toBlob((b) => {
      if (!b) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = 'clip-9x16.png';
      a.click();
    }, 'image/png');
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/85 p-4 overflow-y-auto" onClick={onClose}>
      <div className="max-w-lg mx-auto rounded-xl border border-[#262626] bg-[#0a0a0a] p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs font-black tracking-widest text-[#ff6b00]">📱 CLIP 9:16 PARA REELS</p>
        <label className="block text-xs text-neutral-400">Hook editable
          <input value={hi} onChange={(e) => setHi(e.target.value)} className="mt-1 w-full rounded-lg bg-black border border-[#262626] px-3 py-2 text-sm text-white outline-none focus:border-[#ff6b00]" />
        </label>
        <canvas ref={canvasRef} width={1080} height={1920} className="w-full rounded-lg border border-[#262626]" />
        <div className="flex gap-2">
          <button type="button" onClick={draw} className="flex-1 px-3 py-2 rounded-lg border border-[#262626] text-sm font-bold touch-manipulation">Vista previa</button>
          <button type="button" onClick={exportPNG} className="flex-1 px-3 py-2 rounded-lg bg-[#ff6b00] text-black text-sm font-black touch-manipulation active:scale-95">⬇ Exportar PNG</button>
        </div>
        <button type="button" onClick={onClose} className="w-full text-xs text-neutral-500">Cerrar</button>
      </div>
    </div>
  );
}

export function copyTikTokScript(trick: { title: string; steps: string[]; hook: string }) {
  const s = `🎧 ${trick.hook}\n\n${trick.title}\n\n${trick.steps.map((x, i) => `${i + 1}. ${x}`).join('\n')}\n\nSígueme @djtevenx · XDJ-RR MASTER LAB (20s)`;
  navigator.clipboard?.writeText(s).catch(() => {});
}

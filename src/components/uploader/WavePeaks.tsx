import { useEffect, useRef } from 'react';

export default function WavePeaks({ peaks, color = '#ff6b00', height = 80 }: { peaks: number[]; color?: string; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c || !peaks.length) return;
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, c.width, c.height);
    g.fillStyle = color;
    const w = c.width / peaks.length;
    peaks.forEach((p, i) => {
      const h = Math.max(2, Math.min(1, p) * c.height);
      g.fillRect(i * w, (c.height - h) / 2, Math.max(1, w - 1), h);
    });
  }, [peaks, color]);
  return <canvas ref={ref} width={260} height={height} className="w-full rounded bg-black border border-[#262626] pointer-events-none" style={{ height }} />;
}

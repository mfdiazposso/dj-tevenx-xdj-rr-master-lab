// Genera public/grain.png: tile de ruido RGBA 64x64 (sustituye al SVG feTurbulence,
// que se rasteriza en el hilo principal y generaba long tasks de 1.5s).
import { deflateSync } from 'zlib';
import { writeFileSync } from 'fs';

const W = 64, H = 64;
// ruido pseudoaleatorio determinista (xorshift) para que el build sea reproducible
let seed = 0x9e3779b9;
const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return ((seed >>> 0) / 0xffffffff); };

const raw = Buffer.alloc((W * 4 + 1) * H);
let o = 0;
for (let y = 0; y < H; y++) {
  raw[o++] = 0; // filtro None
  for (let x = 0; x < W; x++) {
    const v = rnd();
    // ruido monocromo con alfa variable: se superpone como grano sutil
    raw[o++] = 255; raw[o++] = 255; raw[o++] = 255;
    raw[o++] = Math.round(v * 46); // alfa 0..46 (~18%)
  }
}

const crcTable = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8-bit RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);
writeFileSync('public/grain.png', png);
console.log(`public/grain.png · ${W}x${H} · ${(png.length / 1024).toFixed(1)} KB`);

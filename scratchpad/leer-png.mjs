/* Lector de PNG mínimo y OFFLINE (sólo `zlib`), para juzgar el canal alfa de lo que entrega el export sin
   depender de la propia aplicación que se está probando — el mismo principio por el que R100 usaba ffmpeg como
   juez externo. Soporta lo único que el export escribe: 8 bits, color type 6 (RGBA), no entrelazado.
   Uso:  node scratchpad/leer-png.mjs <archivo.png>      → imprime esquina, centro y % de píxeles opacos
   Como módulo:  import { leerPNG } from './leer-png.mjs' */
import fs from 'fs';
import zlib from 'zlib';

export function leerPNG(ruta) {
  const b = fs.readFileSync(ruta);
  if (b.readUInt32BE(0) !== 0x89504e47) throw new Error('no es un PNG: ' + ruta);
  let off = 8, w = 0, h = 0, prof = 0, tipo = -1, entrelazado = 0;
  const trozos = [];
  while (off < b.length) {
    const len = b.readUInt32BE(off), tag = b.toString('ascii', off + 4, off + 8);
    const dat = b.subarray(off + 8, off + 8 + len);
    if (tag === 'IHDR') { w = dat.readUInt32BE(0); h = dat.readUInt32BE(4); prof = dat[8]; tipo = dat[9]; entrelazado = dat[12]; }
    else if (tag === 'IDAT') trozos.push(dat);
    else if (tag === 'IEND') break;
    off += 12 + len;
  }
  if (prof !== 8 || tipo !== 6 || entrelazado !== 0)
    throw new Error(`sólo se soporta 8 bits RGBA no entrelazado — este es prof=${prof} tipo=${tipo} entrelazado=${entrelazado}`);
  const bruto = zlib.inflateSync(Buffer.concat(trozos));
  const bpp = 4, linea = w * bpp;
  const px = Buffer.alloc(h * linea);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const filtro = bruto[p++];
    const ent = bruto.subarray(p, p + linea); p += linea;
    const sal = px.subarray(y * linea, (y + 1) * linea);
    const arriba = y > 0 ? px.subarray((y - 1) * linea, y * linea) : null;
    for (let x = 0; x < linea; x++) {
      const a = x >= bpp ? sal[x - bpp] : 0;
      const c = arriba ? arriba[x] : 0;
      const d = (arriba && x >= bpp) ? arriba[x - bpp] : 0;
      let v = ent[x];
      switch (filtro) {
        case 0: break;
        case 1: v += a; break;
        case 2: v += c; break;
        case 3: v += (a + c) >> 1; break;
        case 4: { const q = a + c - d, pa = Math.abs(q - a), pb = Math.abs(q - c), pc = Math.abs(q - d);
                  v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? c : d); break; }
        default: throw new Error('filtro PNG desconocido: ' + filtro);
      }
      sal[x] = v & 255;
    }
  }
  const en = (x, y) => { const i = y * linea + x * bpp; return [px[i], px[i + 1], px[i + 2], px[i + 3]]; };
  let opacos = 0, transp = 0;
  for (let i = 3; i < px.length; i += 4) { if (px[i] === 255) opacos++; else if (px[i] === 0) transp++; }
  const n = w * h;
  return { w, h, en,
    esquina: en(2, 2), centro: en(w >> 1, h >> 1),
    pctOpaco: +(100 * opacos / n).toFixed(1), pctTransp: +(100 * transp / n).toFixed(1) };
}

if (process.argv[1] && process.argv[1].endsWith('leer-png.mjs')) {
  const f = process.argv[2];
  if (!f) { console.error('uso: node scratchpad/leer-png.mjs <archivo.png>'); process.exitCode = 2; }
  else { const r = leerPNG(f);
    console.log(JSON.stringify({ w: r.w, h: r.h, esquina: r.esquina, centro: r.centro, pctOpaco: r.pctOpaco, pctTransp: r.pctTransp })); }
}

// Where is our DXT1 losing 15 dB to ffmpeg's? Break the error down by region and by worst block.
import fs from 'fs'; import path from 'path';
const OUT = path.join(import.meta.dirname, 'out');
const W = 256, H = 192, N = W * H * 4;
const ref = fs.readFileSync(path.join(OUT, 'hap_c1.ref')).subarray(0, N);
const our = fs.readFileSync(path.join(OUT, 'hap_c1.dec.raw')).subarray(0, N);
const ff = fs.readFileSync(path.join(OUT, 'hap_c1.ff.raw')).subarray(0, N);

const at = (b, x, y, c) => b[(y * W + x) * 4 + c];
function regionMSE(buf, y0, y1) {
  let se = 0, n = 0;
  for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) for (let c = 0; c < 3; c++) { const d = at(buf, x, y, c) - at(ref, x, y, c); se += d * d; n++; }
  return se / n;
}
const dB = m => m === 0 ? 'lossless' : (10 * Math.log10(65025 / m)).toFixed(2);
const regions = [['gradient  y<96', 0, 96], ['bars      96..143', 96, 144], ['checker   144..191', 144, 192]];
console.log('region                 ours        ffmpeg');
for (const [nm, a, b] of regions) console.log(`  ${nm.padEnd(20)} ${dB(regionMSE(our, a, b)).padStart(6)} dB   ${dB(regionMSE(ff, a, b)).padStart(6)} dB`);

// worst blocks
const blocks = [];
for (let by = 0; by < H / 4; by++) for (let bx = 0; bx < W / 4; bx++) {
  let se = 0;
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) for (let c = 0; c < 3; c++) { const d = at(our, bx * 4 + i, by * 4 + j, c) - at(ref, bx * 4 + i, by * 4 + j, c); se += d * d; }
  blocks.push({ bx, by, mse: se / 48 });
}
blocks.sort((a, b) => b.mse - a.mse);
console.log('\nworst 6 blocks (ours):');
for (const b of blocks.slice(0, 6)) {
  console.log(`\n  block (${b.bx},${b.by}) px x=${b.bx * 4}..${b.bx * 4 + 3} y=${b.by * 4}..${b.by * 4 + 3}  MSE ${b.mse.toFixed(1)} (${dB(b.mse)} dB)`);
  for (let j = 0; j < 4; j++) {
    const row = [];
    for (let i = 0; i < 4; i++) { const x = b.bx * 4 + i, y = b.by * 4 + j;
      row.push(`src[${at(ref,x,y,0)},${at(ref,x,y,1)},${at(ref,x,y,2)}]→our[${at(our,x,y,0)},${at(our,x,y,1)},${at(our,x,y,2)}]/ff[${at(ff,x,y,0)},${at(ff,x,y,1)},${at(ff,x,y,2)}]`); }
    console.log('    ' + row.join('  '));
  }
}

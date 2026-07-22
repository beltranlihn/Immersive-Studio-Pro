// Measure the reference apps from native-resolution captures: the grey palette they actually ship,
// the L* distance between adjacent surfaces, and row pitch. No web source publishes these.
import { execFileSync } from 'child_process';
import fs from 'fs'; import path from 'path';
const OUT = path.join(import.meta.dirname, 'out');

// decode PNG -> raw RGBA via ffmpeg (no image deps needed)
function load(name) {
  const png = path.join(OUT, name + '.png');
  const j = JSON.parse(execFileSync('ffprobe', ['-v', 'quiet', '-print_format', 'json', '-show_streams', png]).toString());
  const W = j.streams[0].width, H = j.streams[0].height;
  const raw = path.join(OUT, name + '.raw');
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', png, '-f', 'rawvideo', '-pix_fmt', 'rgba', raw]);
  return { buf: fs.readFileSync(raw), W, H };
}
const px = (im, x, y) => { const i = (y * im.W + x) * 4; return [im.buf[i], im.buf[i + 1], im.buf[i + 2]]; };
const hex = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const Y = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const Lstar = c => { const y = Y(c); return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y; };
const CR = (a, b) => { const l1 = Y(a), l2 = Y(b); const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]; return (hi + 0.05) / (lo + 0.05); };
const isGrey = c => Math.max(...c) - Math.min(...c) <= 6;   // neutral only

// The grey ramp each app actually ships: histogram of neutral pixels, keep the peaks.
function greyRamp(im, minShare = 0.004) {
  const hist = new Map();
  let n = 0;
  for (let y = 0; y < im.H; y += 2) for (let x = 0; x < im.W; x += 2) {
    const c = px(im, x, y); if (!isGrey(c)) continue;
    const k = c[0] + ',' + c[1] + ',' + c[2];
    hist.set(k, (hist.get(k) || 0) + 1); n++;
  }
  const peaks = [...hist.entries()].filter(([, v]) => v / n >= minShare)
    .map(([k, v]) => ({ c: k.split(',').map(Number), share: v / n }))
    .sort((a, b) => Lstar(a.c) - Lstar(b.c));
  return { peaks, neutralPixels: n };
}

// Row pitch: strongest vertical repetition of horizontal edges in a column strip (autocorrelation).
function rowPitch(im, x0, x1, y0, y1) {
  const rows = [];
  for (let y = y0; y < y1; y++) {
    let d = 0;
    for (let x = x0; x < x1; x += 2) { const a = px(im, x, y), b = px(im, x, y - 1); d += Math.abs(Y(a) - Y(b)); }
    rows.push(d);
  }
  const mean = rows.reduce((s, v) => s + v, 0) / rows.length;
  const dev = rows.map(v => v - mean);
  let best = null;
  for (let lag = 8; lag <= 120; lag++) {
    let s = 0, n = 0;
    for (let i = 0; i + lag < dev.length; i++) { s += dev[i] * dev[i + lag]; n++; }
    const r = s / n;
    if (!best || r > best.r) best = { lag, r };
  }
  return best;
}

const APPS = [
  { name: 'ref-ableton', label: 'Ableton Live 12', track: [1536, 1830, 160, 500] },
  { name: 'ref-premiere', label: 'Premiere Pro 2025', track: null },
  { name: 'ref-blender', label: 'Blender 4.0', track: null },
  { name: 'ref-unreal', label: 'Unreal Editor 5.8', track: null },
  { name: 'ref-ours', label: '>>> NOSOTROS (Immersive Studio Pro)', track: null },
];

for (const a of APPS) {
  let im; try { im = load(a.name); } catch (e) { console.log('\n' + a.label + ': capture missing'); continue; }
  const { peaks, neutralPixels } = greyRamp(im);
  console.log('\n=== ' + a.label + '  (' + im.W + '×' + im.H + ')  neutral pixels sampled: ' + neutralPixels.toLocaleString());
  console.log('  grey ramp actually shipped (peaks ≥0.4% of neutral area):');
  let prev = null;
  for (const p of peaks) {
    const L = Lstar(p.c);
    let d = '';
    if (prev) d = '   ΔL*=' + (L - prev.L).toFixed(1).padStart(5) + '   contraste=' + CR(p.c, prev.c).toFixed(3);
    console.log('    ' + hex(p.c) + '  L*=' + L.toFixed(1).padStart(5) + '  ' + (p.share * 100).toFixed(1).padStart(5) + '% del área' + d);
    prev = { c: p.c, L };
  }
  if (peaks.length >= 2) {
    const Ls = peaks.map(p => Lstar(p.c));
    const deltas = Ls.slice(1).map((v, i) => v - Ls[i]).filter(d => d > 0.5);
    if (deltas.length) console.log('  ΔL* entre superficies contiguas: min ' + Math.min(...deltas).toFixed(1) + '  max ' + Math.max(...deltas).toFixed(1) + '  mediana ' + deltas.sort((x, y) => x - y)[Math.floor(deltas.length / 2)].toFixed(1));
  }
  if (a.track) { const p = rowPitch(im, a.track[0], a.track[1], a.track[2], a.track[3]); if (p) console.log('  paso de fila dominante (cabeceras de pista): ' + p.lag + 'px'); }
}

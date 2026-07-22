// Judge the .mov files we wrote using ffmpeg/ffprobe — an independent decoder. Checks container metadata,
// exact orientation/frame order via the markers, PSNR against the source, exact PCM, and finally compares
// our DXT quality against ffmpeg's OWN hap encoder so "it decodes" isn't mistaken for "it's good".
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const OUT = path.join(import.meta.dirname, 'out');
const FF = 'ffmpeg', FP = 'ffprobe';
const run = (bin, args) => execFileSync(bin, args, { maxBuffer: 1 << 30 });
const runQ = (bin, args) => execFileSync(bin, args, { maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'ignore'] });

const CASES = [
  { name: 'hap_c1',    tag: 'Hap1', W: 256, H: 192, audio: false },
  { name: 'hap_c4',    tag: 'Hap1', W: 256, H: 192, audio: false },
  { name: 'hapq_c1',   tag: 'HapY', W: 256, H: 192, audio: false },
  { name: 'hapq_c8',   tag: 'HapY', W: 256, H: 192, audio: false },
  // 254×190 exists to prove PADDING works, and it does (the added edge column measures 44 dB). Its PSNR
  // floor is low on purpose: at 254 the colour bars stop landing on 4-px boundaries, so blocks end up
  // holding up to four saturated colours at once — and DXT1 has four palette entries on a single LINE, so
  // it cannot represent that no matter who encodes it. ffmpeg's own hap encoder simply REFUSES non-
  // multiple-of-4 sizes, so there is no external baseline to compare against here.
  { name: 'hap_pad',   tag: 'Hap1', W: 254, H: 190, audio: false, floor: 20 },
  { name: 'hap_audio', tag: 'Hap1', W: 256, H: 192, audio: true  },
  { name: 'hapq_big',  tag: 'HapY', W: 1024, H: 1024, audio: false },
];
const NF = 4;
let fails = 0;
const bad = (m) => { console.log('    FAIL ' + m); fails++; };
const ok = (m) => console.log('    ok   ' + m);

function psnr(a, b, W, H, n) {
  let se = 0, cnt = 0;
  for (let i = 0; i < W * H * n; i++) { for (let c = 0; c < 3; c++) { const d = a[i * 4 + c] - b[i * 4 + c]; se += d * d; cnt++; } }
  const mse = se / cnt;
  return mse === 0 ? Infinity : 10 * Math.log10(255 * 255 / mse);
}
function pixel(buf, W, H, f, x, y) { const i = ((f * W * H) + y * W + x) * 4; return [buf[i], buf[i + 1], buf[i + 2]]; }
const near = (p, q, tol) => Math.abs(p[0] - q[0]) <= tol && Math.abs(p[1] - q[1]) <= tol && Math.abs(p[2] - q[2]) <= tol;

for (const c of CASES) {
  const mov = path.join(OUT, c.name + '.mov');
  console.log('\n' + c.name + '  (' + c.tag + ' ' + c.W + '×' + c.H + ')');
  if (!fs.existsSync(mov)) { bad('file missing'); continue; }

  // --- container metadata, straight from ffprobe ---
  let probe;
  try {
    probe = JSON.parse(runQ(FP, ['-v', 'quiet', '-print_format', 'json', '-show_streams', '-show_format', mov]).toString());
  } catch (e) { bad('ffprobe could not parse the file at all'); continue; }
  const v = probe.streams.find(s => s.codec_type === 'video');
  if (!v) { bad('no video stream'); continue; }
  if (v.codec_tag_string !== c.tag) bad(`fourcc is "${v.codec_tag_string}", expected "${c.tag}"`); else ok('fourcc ' + c.tag);
  if (v.width !== c.W || v.height !== c.H) bad(`size ${v.width}×${v.height}, expected ${c.W}×${c.H}`); else ok('size');
  if (v.r_frame_rate !== '30/1') bad('frame rate ' + v.r_frame_rate + ', expected 30/1'); else ok('30 fps');
  if (+v.nb_frames !== NF) bad('nb_frames ' + v.nb_frames + ', expected ' + NF); else ok(NF + ' frames');

  // --- decode and compare against the source ---
  const raw = path.join(OUT, c.name + '.dec.raw');
  try { runQ(FF, ['-y', '-v', 'error', '-i', mov, '-f', 'rawvideo', '-pix_fmt', 'rgba', raw]); }
  catch (e) { bad('ffmpeg failed to decode'); continue; }
  const dec = fs.readFileSync(raw), ref = fs.readFileSync(path.join(OUT, c.name + '.ref'));
  if (dec.length !== c.W * c.H * 4 * NF) { bad(`decoded ${dec.length} B, expected ${c.W * c.H * 4 * NF}`); continue; }
  if (ref.length !== dec.length) { bad('reference size mismatch'); continue; }

  // orientation: the three corner markers must come back. DXT1 reproduces a solid 4-aligned block exactly;
  // HapY cannot — a fully saturated primary is an extreme chroma that clamps against the format's ±0.5
  // Co/Cg range, so allow a few levels there rather than pretend it is lossless.
  const tol = c.tag === 'HapY' ? 8 : 2;
  let orient = true;
  for (let f = 0; f < NF; f++) {
    if (!near(pixel(dec, c.W, c.H, f, 4, 4), [255, 0, 0], tol)) { bad(`frame ${f}: top-left is not RED → vertical/horizontal flip (got ${pixel(dec, c.W, c.H, f, 4, 4)})`); orient = false; break; }
    if (!near(pixel(dec, c.W, c.H, f, c.W - 5, 4), [0, 255, 0], tol)) { bad(`frame ${f}: top-right is not GREEN → mirrored (got ${pixel(dec, c.W, c.H, f, c.W - 5, 4)})`); orient = false; break; }
    if (!near(pixel(dec, c.W, c.H, f, 4, c.H - 5), [0, 0, 255], tol)) { bad(`frame ${f}: bottom-left is not BLUE (got ${pixel(dec, c.W, c.H, f, 4, c.H - 5)})`); orient = false; break; }
  }
  if (orient) ok('orientation (3 corner markers exact, all frames)');

  // frame order: the white marker sits at x = 16+f*24 on row H/2
  let order = true;
  for (let f = 0; f < NF; f++) {
    const p = pixel(dec, c.W, c.H, f, 16 + f * 24 + 8, (c.H >> 1) + 2);
    if (!near(p, [255, 255, 255], 24)) { bad(`frame ${f}: moving marker not found where it belongs (got ${p}) → frames out of order`); order = false; break; }
  }
  if (order) ok('frame order (moving marker tracks the frame index)');

  // quality
  const q = psnr(dec, ref, c.W, c.H, NF);
  const floor = c.floor ?? (c.tag === 'HapY' ? 32 : 28);
  if (q < floor) bad(`PSNR ${q.toFixed(2)} dB is below the ${floor} dB floor for ${c.tag}`);
  else ok(`PSNR ${q.toFixed(2)} dB`);

  // --- audio must be bit-exact (PCM in, PCM out) ---
  if (c.audio) {
    const ap = probe.streams.find(s => s.codec_type === 'audio');
    if (!ap) bad('no audio stream');
    else {
      if (ap.codec_name !== 'pcm_s16le') bad('audio codec ' + ap.codec_name + ', expected pcm_s16le'); else ok('audio pcm_s16le');
      if (+ap.sample_rate !== 48000 || +ap.channels !== 2) bad(`audio ${ap.sample_rate} Hz / ${ap.channels}ch, expected 48000/2`); else ok('audio 48 kHz stereo');
      const araw = path.join(OUT, c.name + '.dec.pcm');
      runQ(FF, ['-y', '-v', 'error', '-i', mov, '-f', 's16le', '-acodec', 'pcm_s16le', araw]);
      const da = fs.readFileSync(araw), ra = fs.readFileSync(path.join(OUT, c.name + '.apcm'));
      if (da.length !== ra.length) bad(`audio ${da.length} B decoded vs ${ra.length} B written`);
      else if (!da.equals(ra)) bad('audio bytes differ (PCM must round-trip exactly)');
      else ok('audio bit-exact (' + da.length + ' B)');
    }
  }
}

// --- Is our DXT any GOOD? Compare against ffmpeg's own hap encoder on identical input. ---
console.log('\nDXT quality vs ffmpeg\'s own hap encoder (same source, 256×192):');
for (const [name, ffFormat, tag] of [['hap_c1', 'hap', 'Hap1'], ['hapq_c1', 'hap_q', 'HapY']]) {
  const ref = fs.readFileSync(path.join(OUT, name + '.ref'));
  const one = path.join(OUT, name + '.one.raw'); fs.writeFileSync(one, ref.subarray(0, 256 * 192 * 4));
  const ffm = path.join(OUT, name + '.ff.mov'), ffr = path.join(OUT, name + '.ff.raw');
  runQ(FF, ['-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', '256x192', '-i', one, '-c:v', 'hap', '-format', ffFormat, ffm]);
  runQ(FF, ['-y', '-v', 'error', '-i', ffm, '-f', 'rawvideo', '-pix_fmt', 'rgba', ffr]);
  const theirs = psnr(fs.readFileSync(ffr), ref, 256, 192, 1);
  const ours = psnr(fs.readFileSync(path.join(OUT, name + '.dec.raw')).subarray(0, 256 * 192 * 4), ref, 256, 192, 1);
  const delta = ours - theirs;
  const verdict = delta > -1.5 ? 'ok  ' : 'FAIL';
  if (delta <= -1.5) fails++;
  console.log(`    ${verdict} ${tag}: ours ${ours.toFixed(2)} dB vs ffmpeg ${theirs.toFixed(2)} dB  (${delta >= 0 ? '+' : ''}${delta.toFixed(2)} dB)`);
}

console.log(fails ? `\n${fails} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
process.exit(fails ? 1 : 0);

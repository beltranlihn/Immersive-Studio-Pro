// Prove the chunk count is REAL. ffmpeg decodes a 1-chunk and an 8-chunk frame identically, so a silently
// ignored setting would sail through the decode tests. This parses the actual HAP section out of the first
// video sample and reads the Decode Instructions back.
import { execFileSync } from 'child_process';
import fs from 'fs'; import path from 'path';
const OUT = path.join(import.meta.dirname, 'out');

const TYPE = { 0xAB: 'DXT1/none', 0xBB: 'DXT1/snappy', 0xCB: 'DXT1/chunked',
               0xAE: 'DXT5/none', 0xBE: 'DXT5/snappy', 0xCE: 'DXT5/chunked',
               0xAF: 'YCoCg/none', 0xBF: 'YCoCg/snappy', 0xCF: 'YCoCg/chunked' };
const COMP = { 0x0A: 'raw', 0x0B: 'snappy' };

function firstSample(mov) {
  const j = JSON.parse(execFileSync('ffprobe', ['-v', 'quiet', '-select_streams', 'v:0', '-show_packets', '-of', 'json', mov], { maxBuffer: 1 << 28 }).toString());
  const p = j.packets[0];
  const fd = fs.openSync(mov, 'r'); const b = Buffer.alloc(+p.size);
  fs.readSync(fd, b, 0, +p.size, +p.pos); fs.closeSync(fd);
  return b;
}
function readSection(b, off) {
  let size = b[off] | (b[off + 1] << 8) | (b[off + 2] << 16), type = b[off + 3], hdr = 4;
  if (size === 0) { size = b.readUInt32LE(off + 4); hdr = 8; }
  return { type, size, body: off + hdr, end: off + hdr + size };
}
function describe(mov) {
  const s = firstSample(mov);
  const top = readSection(s, 0);
  const out = { top: TYPE[top.type] || ('0x' + top.type.toString(16)), declared: top.size, sample: s.length, chunks: 1, comps: [] };
  if (top.end !== s.length) out.sizeMismatch = `section says ${top.end} bytes, sample is ${s.length}`;
  if ((top.type & 0xF0) === 0xC0) {                    // chunked → first inner section must be 0x01
    const di = readSection(s, top.body);
    if (di.type !== 0x01) { out.error = 'expected a Decode Instructions Container (0x01), got 0x' + di.type.toString(16); return out; }
    let o = di.body; const tabs = {};
    while (o < di.end) { const t = readSection(s, o); tabs[t.type] = t; o = t.end; }
    if (!tabs[0x02] || !tabs[0x03]) { out.error = 'a compressor table (0x02) must come with a size table (0x03)'; return out; }
    const n = tabs[0x02].size;
    out.chunks = n;
    for (let i = 0; i < n; i++) out.comps.push(COMP[s[tabs[0x02].body + i]] || '?');
    if (tabs[0x03].size !== n * 4) out.error = `size table holds ${tabs[0x03].size / 4} entries for ${n} chunks`;
    // the chunk sizes must exactly fill the rest of the section
    let sum = 0; for (let i = 0; i < n; i++) sum += s.readUInt32LE(tabs[0x03].body + i * 4);
    const avail = top.end - di.end;
    if (sum !== avail) out.error = `chunk sizes sum to ${sum} but ${avail} bytes follow the instructions`;
    out.chunkBytes = sum;
  }
  return out;
}

const EXPECT = [['hap_c1', 1, 'DXT1/snappy'], ['hap_c4', 4, 'DXT1/chunked'], ['hapq_c1', 1, 'YCoCg/snappy'],
                ['hapq_c8', 8, 'YCoCg/chunked'], ['hap_audio', 2, 'DXT1/chunked'], ['hapq_big', 4, 'YCoCg/chunked']];
let fails = 0;
for (const [name, wantChunks, wantTop] of EXPECT) {
  const d = describe(path.join(OUT, name + '.mov'));
  const bits = [];
  if (d.error) bits.push('ERROR ' + d.error);
  if (d.sizeMismatch) bits.push('ERROR ' + d.sizeMismatch);
  if (d.top !== wantTop) bits.push(`top section is ${d.top}, expected ${wantTop}`);
  if (d.chunks !== wantChunks) bits.push(`${d.chunks} chunk(s), expected ${wantChunks}`);
  if (bits.length) { fails++; console.log(`  FAIL ${name}: ${bits.join('; ')}`); }
  else console.log(`  ok   ${name}: ${d.top}, ${d.chunks} chunk(s) [${d.comps.join(',') || 'n/a'}], ${d.sample} B sample`);
}
console.log(fails ? `\n${fails} FAILED` : '\nchunk plumbing verified');
process.exit(fails ? 1 : 0);

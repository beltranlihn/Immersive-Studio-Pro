// Unit-test the Snappy encoder from app.js by round-tripping through an INDEPENDENT decompressor
// written straight from the format spec (so a shared misconception can't hide a bug).
import fs from 'fs';
const src = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const a = src.indexOf('function snappyCompress');
const b = src.indexOf('/* ---- DXT/BC compression');
if (a < 0 || b < 0 || b < a) { console.error('FAIL: could not slice the snappy functions out of app.js'); process.exit(1); }
const mod = src.slice(a, b);
const snappyCompress = eval(mod + '; snappyCompress');

// --- reference decompressor (spec: varint length, then literal/copy tags) ---
function snappyDecompress(inp) {
  let ip = 0, len = 0, shift = 0;
  for (;;) { const c = inp[ip++]; len |= (c & 127) << shift; shift += 7; if (!(c & 128)) break; }
  const out = new Uint8Array(len); let op = 0;
  while (ip < inp.length) {
    const tag = inp[ip++];
    if ((tag & 3) === 0) {                       // literal
      let l = tag >>> 2;
      if (l >= 60) { const nb = l - 59; l = 0; for (let i = 0; i < nb; i++) l |= inp[ip + i] << (8 * i); ip += nb; }
      l += 1;
      out.set(inp.subarray(ip, ip + l), op); ip += l; op += l;
    } else {
      let l, off;
      if ((tag & 3) === 1) { l = 4 + ((tag >>> 2) & 7); off = ((tag >>> 5) << 8) | inp[ip++]; }
      else if ((tag & 3) === 2) { l = (tag >>> 2) + 1; off = inp[ip] | (inp[ip + 1] << 8); ip += 2; }
      else { l = (tag >>> 2) + 1; off = (inp[ip] | (inp[ip + 1] << 8) | (inp[ip + 2] << 16) | (inp[ip + 3] << 24)) >>> 0; ip += 4; }
      if (off === 0 || off > op) throw new Error('bad copy offset ' + off + ' at op=' + op);
      for (let i = 0; i < l; i++) { out[op] = out[op - off]; op++; }   // byte-wise: overlapping copies are legal
    }
  }
  if (op !== len) throw new Error('decompressed ' + op + ' bytes, header said ' + len);
  return out;
}

const eq = (x, y) => x.length === y.length && x.every((v, i) => v === y[i]);
let pass = 0, fail = 0;
function check(name, data) {
  try {
    const c = snappyCompress(data);
    const d = snappyDecompress(c);
    if (!eq(data, d)) { console.log(`  FAIL ${name}: round-trip mismatch`); fail++; return; }
    const ratio = data.length ? (c.length / data.length) : 1;
    console.log(`  ok   ${name}  ${data.length} → ${c.length} B (${(ratio * 100).toFixed(1)}%)`);
    pass++;
  } catch (e) { console.log(`  FAIL ${name}: ${e.message}`); fail++; }
}

// deterministic PRNG so a failure is reproducible. xorshift32 via imul — a plain LCG with a big
// multiplier silently loses precision past 2^53 in JS and degenerates into patterns, which would
// quietly turn the "incompressible" case (the one that stresses the output bound) into a compressible one.
let seed = 12345;
const rnd = () => { seed ^= seed << 13; seed >>>= 0; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0; return seed / 4294967296; };

console.log('Snappy round-trip:');
check('empty', new Uint8Array(0));
check('1 byte', new Uint8Array([42]));
check('14 bytes (under the fragment margin)', new Uint8Array(14).map((_, i) => i));
check('15 bytes (at the margin)', new Uint8Array(15).map((_, i) => i));
check('64 zeros', new Uint8Array(64));
check('all zeros 1MB (max compressible)', new Uint8Array(1 << 20));
check('incompressible random 256KB', new Uint8Array(1 << 18).map(() => (rnd() * 256) | 0));
check('repeating 4-byte pattern 512KB', new Uint8Array(1 << 19).map((_, i) => [0xde, 0xad, 0xbe, 0xef][i & 3]));
check('exactly 65536 (one fragment)', new Uint8Array(65536).map((_, i) => (i * 7) & 255));
check('65537 (fragment boundary +1)', new Uint8Array(65537).map((_, i) => (i * 7) & 255));
check('196608 (3 whole fragments)', new Uint8Array(196608).map((_, i) => (i >> 8) & 255));
// DXT-like: long runs of identical blocks (a dome master is mostly black) with occasional detail
check('DXT-ish 2MB (mostly flat + noise islands)', new Uint8Array(2 << 20).map((_, i) =>
  ((i >> 10) % 8 === 0) ? ((rnd() * 256) | 0) : (i & 7)));
check('text-like 300KB', new TextEncoder().encode('the quick brown fox jumps over the lazy dog. '.repeat(6800)));

// long-match stress: a big block repeated verbatim exercises the >68 and >64 copy paths
const big = new Uint8Array(300000).map((_, i) => (i * 13) & 255);
const twice = new Uint8Array(600000); twice.set(big, 0); twice.set(big, 300000);
check('300KB repeated verbatim (long copies)', twice);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

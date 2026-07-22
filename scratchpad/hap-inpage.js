/* Runs INSIDE the app (via CDP). Renders a known pattern to the canvas, pushes it through the real
   HAP stack (dxtEncodeCanvas → hapFrame → movBuild) using the same streaming writer shape as runExport,
   and writes both the .mov and the reference RGBA so ffmpeg can judge the result from outside. */
(async () => {
  const OUT = String.raw`C:\Users\beltr\Desktop\Alma Digital Studio\Projects\Immersive Studio Pro\scratchpad\out`;
  await DSP.ensureDir(OUT);
  const NF = 4;

  // Pattern is authored TOP-DOWN. Three corner markers pin the orientation (a flip or a mirror can't
  // survive them), a moving white square pins frame ORDER, and gradients/bars/checker give DXT real work.
  const BARS = [[255,0,0],[0,255,0],[0,0,255],[255,255,0],[0,255,255],[255,0,255],[255,255,255],[0,0,0]];
  function makePattern(W, H, f) {
    const p = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let r, g, b;
      if (y < H / 2) { r = Math.round(x * 255 / (W - 1)); g = Math.round(y * 255 / (H / 2 - 1)); b = 128; }
      else { const c = BARS[Math.min(7, Math.floor(x / (W / 8)))]; r = c[0]; g = c[1]; b = c[2];
             if (y > H * 3 / 4 && (((x >> 2) + (y >> 2)) & 1)) { r = 255 - r; g = 255 - g; b = 255 - b; } }
      // moving marker (frame order)
      if (y >= (H >> 1) - 8 && y < (H >> 1) + 8 && x >= 16 + f * 24 && x < 32 + f * 24) { r = 255; g = 255; b = 255; }
      // corner markers (orientation) — solid, 4-aligned, so DXT reproduces them exactly
      if (y < 16 && x < 16) { r = 255; g = 0; b = 0; }                    // top-left    RED
      if (y < 16 && x >= W - 16) { r = 0; g = 255; b = 0; }               // top-right   GREEN
      if (y >= H - 16 && x < 16) { r = 0; g = 0; b = 255; }               // bottom-left BLUE
      const i = (y * W + x) * 4; p[i] = r; p[i + 1] = g; p[i + 2] = b; p[i + 3] = 255;
    }
    return p;
  }

  const PASS = ppCompile('#version 300 es\nprecision highp float; in vec2 v_uv; uniform sampler2D u_t; out vec4 o;\n' +
    'void main(){ o=texture(u_t, vec2(v_uv.x, 1.0-v_uv.y)); }'); // flip: our pattern is top-down, GL row 0 is the bottom
  const ptex = gl.createTexture();

  function drawPattern(pat, W, H) {
    glc.width = W; glc.height = H;
    gl.bindTexture(gl.TEXTURE_2D, ptex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, pat);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
    gl.useProgram(PASS); gl.bindVertexArray(_ppVAO);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, ptex);
    gl.uniform1i(gl.getUniformLocation(PASS, 'u_t'), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6); gl.bindVertexArray(null); gl.finish();
  }

  async function build(name, fmt, W, H, chunks, withAudio) {
    const F = HAP_FMT[fmt];
    const path = OUT + '\\' + name + '.mov';
    const fid = await DSP.fileOpen(path);
    if (fid == null) throw new Error('fileOpen failed for ' + path);
    let pos = 0; const wr = [];
    const put = u8 => { const at = pos; pos += u8.length;
      const buf = (u8.byteOffset === 0 && u8.byteLength === u8.buffer.byteLength) ? u8 : u8.slice();
      wr.push(DSP.fileWriteAt(fid, at, buf)); return at; };
    put(movFtyp());
    const mdatStart = pos;
    put(_bytes(16, (dv, b) => { dv.setUint32(0, 1); b.set(_fcc('mdat'), 4); }));

    let pcm = null, aSR = 48000, aCH = 2, aN = 0;
    if (withAudio) {
      const octx = new OfflineAudioContext(2, aSR, aSR);
      const ab = octx.createBuffer(2, Math.round(aSR * NF / 30), aSR); aN = ab.length;
      for (let c = 0; c < 2; c++) { const d = ab.getChannelData(c);
        for (let i = 0; i < aN; i++) d[i] = Math.sin(2 * Math.PI * (c ? 880 : 440) * i / aSR) * 0.5; }
      pcm = audioPCM16(ab);
    }
    const refs = []; const frames = [], aChunks = [];
    for (let f = 0; f < NF; f++) {
      const pat = makePattern(W, H, f); refs.push(pat);
      drawPattern(pat, W, H);
      const fr = hapFrame(dxtEncodeCanvas(F.tex, W, H), fmt, chunks);
      frames.push({ off: put(fr), size: fr.length });
      if (pcm) { const s0 = Math.floor(f * aSR / 30), s1 = Math.min(aN, Math.floor((f + 1) * aSR / 30));
        if (s1 > s0) aChunks.push({ off: put(pcm.slice(s0 * aCH * 2, s1 * aCH * 2)), samples: s1 - s0 }); }
    }
    await Promise.all(wr);
    const mdatSize = pos - mdatStart;
    await DSP.fileWriteAt(fid, mdatStart + 8, _bytes(8, dv => { dv.setUint32(0, Math.floor(mdatSize / 4294967296)); dv.setUint32(4, mdatSize >>> 0); }));
    put(movBuild({ fourcc: F.fourcc, w: W, h: H, depth: F.depth, fps: 30, frames,
      audio: (pcm && aChunks.length) ? { sr: aSR, ch: aCH, chunks: aChunks } : null }));
    await Promise.all(wr);
    await DSP.fileClose(fid);

    const ref = new Uint8Array(refs.reduce((s, r) => s + r.length, 0));
    refs.forEach((r, i) => ref.set(r, i * refs[0].length));
    await DSP.writeBinary(OUT + '\\' + name + '.ref', ref);
    if (pcm) await DSP.writeBinary(OUT + '\\' + name + '.apcm', pcm.slice(0, aChunks.reduce((s, c) => s + c.samples, 0) * aCH * 2));
    return { name, fmt, W, H, chunks, withAudio, nf: NF, bytes: pos, avgFrame: Math.round(frames.reduce((s, f) => s + f.size, 0) / NF) };
  }

  const out = [];
  out.push(await build('hap_c1',    'hap',  256, 192, 1, false));
  out.push(await build('hap_c4',    'hap',  256, 192, 4, false));
  out.push(await build('hapq_c1',   'hapq', 256, 192, 1, false));
  out.push(await build('hapq_c8',   'hapq', 256, 192, 8, false));
  out.push(await build('hap_pad',   'hap',  254, 190, 1, false));   // not a multiple of 4 → padded texture
  out.push(await build('hap_audio', 'hap',  256, 192, 2, true));
  out.push(await build('hapq_big',  'hapq', 1024, 1024, 4, false)); // exercises the 8-byte section header path
  gl.deleteTexture(ptex); gl.deleteProgram(PASS); dxtFree();
  try { resize(); scrubRender(); } catch (e) {}
  return JSON.stringify(out);
})()

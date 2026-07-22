/* [R104] El coste REAL del composite. Lo medí antes con medios sintéticos → escena vacía → 0.2ms a 4096²,
   que era mentira. Ahora con 3 clips de verdad desde disco, pintando de verdad (control por readPixels DENTRO
   del frame). Esto decide si "reproducir a resolución reducida" (el modelo de Premiere) nos sirve de algo. */
(async () => {
  const out = []; const w = (n = 400) => new Promise(r => setTimeout(r, n));
  const P = 'file:///C:/Users/beltr/Desktop/Rito Movie/Asset/RIto_Film_1080.mp4';
  const probe = document.createElement('video'); probe.src = P; probe.muted = true;
  await new Promise(res => { probe.onloadedmetadata = res; probe.onerror = res; setTimeout(res, 10000); });
  const m = { id: uid(), kind: 'video', name: 'RIto', srcUrl: P, tex: newTex(),
              w: probe.videoWidth || 1920, h: probe.videoHeight || 1080, dur: probe.duration || 3878,
              fps: 60, thumb: null, color: null, proxyReady: false };
  state.media.push(m); probe.src = '';
  state.clips = [];
  for (let i = 0; i < 3; i++) addClip(m, i, 0);
  renderTimeline(); await w(800);
  state.playhead = 300; play(); await w(4000);

  const medir = async (n = 40) => {
    const ts = [];
    for (let i = 0; i < n; i++) {
      await new Promise(r => requestAnimationFrame(r));
      const t0 = performance.now(); render(); gl.finish(); ts.push(performance.now() - t0);
    }
    ts.sort((a, b) => a - b); return { med: +ts[Math.floor(n / 2)].toFixed(2), p90: +ts[Math.floor(n * 0.9)].toFixed(2) };
  };
  // control: ¿pinta de verdad? readPixels DENTRO del frame (con preserveDrawingBuffer:false hay que leer sin ceder)
  const control = () => new Promise(res => requestAnimationFrame(() => {
    render();
    const W = Math.min(320, gl.drawingBufferWidth), H = Math.min(320, gl.drawingBufferHeight);
    const px = new Uint8Array(4 * W * H);
    try { gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px); } catch (_) {}
    let v = 0; for (let i = 0; i < px.length; i += 4) if (px[i] + px[i + 1] + px[i + 2] > 30) v++;
    res((100 * v / (W * H)).toFixed(1));
  }));

  out.push('── coste REAL del composite, 3 clips HEVC 1080p60 reproduciéndose');
  out.push('   presupuesto por frame a 60fps: 16.7ms · a 30fps: 33.3ms');
  const orig = (typeof compSize !== 'undefined') ? compSize : 2048;
  for (const s of [1024, 2048, 4096]) {
    if (typeof setCompSize !== 'function') { out.push('   setCompSize no existe'); break; }
    setCompSize(s); await w(500);
    const r = await medir();
    const c = await control();
    out.push('   COMP ' + String(s).padStart(4) + '² (' + (s * s / 1e6).toFixed(1).padStart(4) + ' Mpx): render ' +
             String(r.med).padStart(6) + 'ms · p90 ' + String(r.p90).padStart(6) + 'ms · canvas con contenido: ' + c + '%');
  }
  setCompSize(orig); pause();
  out.push('');
  out.push('   Si 4096² cuesta ≈ lo mismo que 1024², bajar la resolución al reproducir NO sirve: el composite no es el cuello.');
  return out.join('\n');
})()

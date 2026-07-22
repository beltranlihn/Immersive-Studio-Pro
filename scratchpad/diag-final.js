/* [R104] Medición definitiva y HONESTA.
   Error anterior: `fetch(file://…).blob()` → un File respaldado por 12.6 GB EN RAM. La app real recibe un File
   del disco y Chromium lo lee en streaming. Mi "1 fps con 2 clips" podía ser mi propio blob gigante.
   Aquí la fuente es una URL file:// directa (respaldada por disco), que es lo que ocurre de verdad, y se pasa
   por el camino real del motor (vinstEnsure/_vinstUrl usan m.srcUrl).
   Se mide: render() de LA APP + MI rAF en paralelo (distingue "no se llama" de "hilo bloqueado") + memoria. */
(async () => {
  const out = []; const w = (n = 500) => new Promise(r => setTimeout(r, n));
  const P = 'file:///C:/Users/beltr/Desktop/Rito Movie/Asset/RIto_Film_1080.mp4';
  const mem = () => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) + 'MB' : '?';

  // medio con fuente EN DISCO (sin blob en RAM). El resto del camino es el del motor.
  const probe = document.createElement('video'); probe.src = P; probe.muted = true;
  await new Promise((res, rej) => { probe.onloadedmetadata = res; probe.onerror = () => rej(new Error('no carga')); setTimeout(res, 10000); });
  const m = { id: uid(), kind: 'video', name: 'RIto_Film_1080.mp4', srcUrl: P, path: P.replace('file:///', ''),
              tex: newTex(), w: probe.videoWidth || 1920, h: probe.videoHeight || 1080, dur: probe.duration || 3878,
              fps: 60, thumb: null, color: null, proxyReady: false };
  state.media.push(m); probe.src = '';
  out.push('── fuente EN DISCO (sin blob de 12.6GB en RAM): ' + m.w + '×' + m.h + ' · ' + Math.round(m.dur) + 's · heap ' + mem());
  out.push('');

  const medir = async (ms = 5000) => {
    const orig = window.render; let pintados = 0;
    window.render = function (...a) { pintados++; return orig.apply(this, a); };
    let mios = 0, peor = 0, ult = performance.now(); const t0 = performance.now();
    await new Promise(res => { const tick = () => { const n = performance.now(); const g = n - ult; if (g > peor) peor = g; ult = n; mios++;
      if (n - t0 < ms) requestAnimationFrame(tick); else res(); }; requestAnimationFrame(tick); });
    window.render = orig;
    const seg = ms / 1000;
    const vt = [..._vinst.values()].map(v => v.vel ? +v.vel.currentTime.toFixed(1) : 0);
    return { render: Math.round(pintados / seg), miRaf: Math.round(mios / seg), peor: Math.round(peor), vt };
  };

  for (const T of [300, 2700]) {
    out.push('══ minuto ' + Math.round(T / 60) + '  (bitrate medido: ' + (T === 300 ? '24.1' : '22.8') + ' Mbps)');
    state.clips = [];
    for (const [cid, vi] of [..._vinst]) { try { vi.vel.pause(); vi.vel.src = ''; } catch (_) {} _vinst.delete(cid); }
    for (let n = 1; n <= 3; n++) {
      addClip(m, n - 1, 0);
      renderTimeline(); render(); await w(1000);
      state.playhead = T; play(); await w(5000);        // pasa el arranque: el fallo aparecía a los ~4s
      const r = await medir(5000);
      pause(); await w(400);
      const diag = (r.miRaf < 20 && r.render < 20) ? '⚠ HILO BLOQUEADO'
                 : (r.render < 20) ? '⚠ no se llama a render()'
                 : (r.render < 45) ? '⚠ va justo' : 'ok';
      out.push('  ' + n + ' clip(s): render ' + String(r.render).padStart(3) + 'fps · miRaf ' + String(r.miRaf).padStart(3) +
               'fps · peor hueco ' + String(r.peor).padStart(4) + 'ms · heap ' + mem() + ' → ' + diag);
    }
  }

  // upTex sobre HEVC 10-bit: nunca medido (el 0.5ms era H.264 8-bit)
  const vi = [..._vinst.values()][0];
  if (vi && vi.vel && vi.vel.videoWidth) {
    const v = vi.vel, tex = newTex();
    gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v);
    const ts = [];
    for (let i = 0; i < 60; i++) { await new Promise(r => requestAnimationFrame(r));
      gl.bindTexture(gl.TEXTURE_2D, tex); const t0 = performance.now();
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, v); gl.flush();
      ts.push(performance.now() - t0); }
    ts.sort((a, b) => a - b); gl.deleteTexture(tex);
    out.push('');
    out.push('── subir 1 frame HEVC 10-bit a textura: mediana ' + ts[30].toFixed(2) + 'ms · p90 ' + ts[54].toFixed(2) + 'ms · max ' + ts[59].toFixed(2) + 'ms');
    out.push('   (H.264 8-bit 2560×1440 medido ayer: 0.5ms · presupuesto TOTAL por frame a 60fps: 16.7ms)');
  }
  return out.join('\n');
})()

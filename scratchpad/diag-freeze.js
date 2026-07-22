/* [R104] Con 2+ clips del fichero HEVC, la app baja a 1 fps a los ~4s. Dos causas OPUESTAS:
   (a) no se LLAMA a render() → bug de lógica en el bucle;
   (b) el hilo principal está BLOQUEADO → mi propio rAF también morirá.
   Se miden ambos a la vez: es lo único que los distingue. Y se cronometra upTex sobre HEVC 10-bit, que nunca
   medí (el benchmark bueno usaba H.264 8-bit: 0.5ms). */
(async () => {
  const out = []; const w = (n = 500) => new Promise(r => setTimeout(r, n));
  const F = 'RIto_Film_1080.mp4';
  const file = new File([await (await fetch('file:///C:/Users/beltr/Desktop/Rito Movie/Asset/' + F)).blob()], F, { type: 'video/mp4' });
  importFiles([file]); await w(7000);
  const m = state.media.find(x => x.kind === 'video');
  if (!m) return 'no se importó';

  const medir = async (ms = 5000) => {
    const orig = window.render; let pintados = 0;
    window.render = function (...a) { pintados++; return orig.apply(this, a); };
    let mios = 0, peor = 0, ult = performance.now();
    const t0 = performance.now();
    await new Promise(res => {
      const tick = () => { const n = performance.now(); const gap = n - ult; if (gap > peor) peor = gap; ult = n; mios++;
        if (n - t0 < ms) requestAnimationFrame(tick); else res(); };
      requestAnimationFrame(tick);
    });
    window.render = orig;
    const seg = ms / 1000;
    return { render: Math.round(pintados / seg), miRaf: Math.round(mios / seg), peorHueco: Math.round(peor) };
  };

  out.push('── ¿no se llama a render(), o el hilo está bloqueado?');
  out.push('   miRaf = MI bucle rAF. Si muere conmigo → hilo bloqueado. Si yo voy a 60 y render a 1 → bug de lógica.');
  for (let n = 1; n <= 3; n++) {
    addClip(m, n - 1, 0);
    renderTimeline(); render(); await w(1200);
    state.playhead = 2700; play(); await w(5000);   // [R104] minuto 45: seek profundo en 12.5GB + tramo con mas detalle          // pasa el transitorio de arranque
    const r = await medir(5000);
    pause(); await w(400);
    const diag = (r.miRaf < 20 && r.render < 20) ? 'HILO BLOQUEADO' : (r.render < 20 ? 'no se llama a render()' : 'ok');
    out.push('   ' + n + ' clip(s): render ' + String(r.render).padStart(3) + ' fps · mi rAF ' + String(r.miRaf).padStart(3) +
             ' fps · peor hueco ' + String(r.peorHueco).padStart(5) + 'ms  → ' + diag);
  }

  // upTex sobre HEVC 10-bit: nunca lo medí. El bench bueno usaba H.264 8-bit (0.5ms).
  out.push('');
  out.push('── coste REAL de subir un frame HEVC 10-bit a textura (nunca lo medí):');
  const vi = [..._vinst.values()][0];
  if (vi && vi.vel) {
    const v = vi.vel; const tex = newTex();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v);
    const ts = [];
    for (let i = 0; i < 60; i++) {
      await new Promise(r => requestAnimationFrame(r));
      gl.bindTexture(gl.TEXTURE_2D, tex);
      const t0 = performance.now();
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, v);
      gl.flush();
      ts.push(performance.now() - t0);
    }
    ts.sort((a, b) => a - b);
    out.push('   HEVC 10-bit 1920×1080: mediana ' + ts[30].toFixed(2) + 'ms · p90 ' + ts[54].toFixed(2) + 'ms · max ' + ts[59].toFixed(2) + 'ms');
    out.push('   (referencia medida ayer con H.264 8-bit 2560×1440: 0.5ms · presupuesto total por frame a 60fps: 16.7ms)');
    gl.deleteTexture(tex);
  }
  return out.join('\n');
})()

/* [R104] LA pregunta que queda: mi medición usa `file://` y da 60fps con 3 clips. La app usa
   `URL.createObjectURL(file)` (addVideo, línea ~1237) aunque YA TIENE la ruta en disco (`path`).
   ¿Es el blob URL más lento que el file://? Es la única diferencia entre mi banco y tu sesión.
   Se compara con "Baile 3.mp4" (338MB, 1440p60, 136 Mbps) — grande para exigir, pequeño para que el blob en
   RAM no sea patológico y contamine la comparación como pasó con los 12.6GB. */
(async () => {
  const out = []; const w = (n = 500) => new Promise(r => setTimeout(r, n));
  const P = 'file:///C:/Users/beltr/Desktop/Rito Movie/Asset/Creation/Baile 3.mp4';

  const medir = async (etiqueta, url, nClips) => {
    state.clips = [];
    for (const [cid, vi] of [..._vinst]) { try { vi.vel.pause(); vi.vel.src = ''; } catch (_) {} _vinst.delete(cid); }
    state.media = state.media.filter(x => x.kind !== 'video');
    const probe = document.createElement('video'); probe.src = url; probe.muted = true;
    await new Promise(res => { probe.onloadedmetadata = res; probe.onerror = res; setTimeout(res, 12000); });
    const m = { id: uid(), kind: 'video', name: 'bench', srcUrl: url, tex: newTex(),
                w: probe.videoWidth || 2560, h: probe.videoHeight || 1440, dur: probe.duration || 19, fps: 60,
                thumb: null, color: null, proxyReady: false };
    state.media.push(m); probe.src = '';
    for (let i = 0; i < nClips; i++) addClip(m, i, 0);
    renderTimeline(); render(); await w(1000);
    state.playhead = 3; play(); await w(5000);            // pasa el arranque
    const orig = window.render; let n = 0;
    window.render = function (...a) { n++; return orig.apply(this, a); };
    let mios = 0, peor = 0, ult = performance.now(); const t0 = performance.now();
    await new Promise(res => { const tick = () => { const t = performance.now(); const g = t - ult; if (g > peor) peor = g; ult = t; mios++;
      if (t - t0 < 5000) requestAnimationFrame(tick); else res(); }; requestAnimationFrame(tick); });
    window.render = orig; pause(); await w(300);
    const heap = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : 0;
    out.push('  ' + etiqueta.padEnd(30) + nClips + ' clip(s): render ' + String(Math.round(n / 5)).padStart(3) +
             'fps · miRaf ' + String(Math.round(mios / 5)).padStart(3) + 'fps · peor ' + String(Math.round(peor)).padStart(4) + 'ms · heap ' + heap + 'MB');
    return Math.round(n / 5);
  };

  out.push('── file:// (ruta en disco)  vs  blob: (lo que hace addVideo hoy)');
  const r = {};
  for (const n of [1, 2, 3]) r['file' + n] = await medir('file:// disco', P, n);
  const blob = URL.createObjectURL(await (await fetch(P)).blob());   // 338MB: grande pero no patológico
  for (const n of [1, 2, 3]) r['blob' + n] = await medir('blob: (addVideo actual)', blob, n);
  URL.revokeObjectURL(blob);
  out.push('');
  const dif = [1, 2, 3].map(n => r['file' + n] - r['blob' + n]);
  const peorDif = Math.max(...dif);
  out.push('── diferencia file:// − blob: por nº de clips: ' + JSON.stringify(dif) + ' fps');
  out.push(peorDif >= 8 ? '   → el blob URL SÍ cuesta: merece la pena usar la ruta de disco que ya tenemos'
                        : '   → sin diferencia relevante: el blob URL NO es el problema. No tocar addVideo.');
  return out.join('\n');
})()

/* [R104] Medición HONESTA con el fichero REAL que tironea: RIto_Film_1080.mp4
   (HEVC Main10 10-bit, 1920×1080@60, 25.9 Mbps, 64 minutos, 12.5 GB), duplicado.
   Descartado ya: FLIP_Y (×1.3), techo de decodificadores (4×1440p60 → 62fps), HEVC por software (Chromium 148,
   powerEfficient=true), compartir <video> entre clips (la instancia va por clip).
   Se cuenta lo único que vale: llamadas de LA APP a render(), avance real, y SEEKS. */
(async () => {
  const out = []; const w = (n = 500) => new Promise(r => setTimeout(r, n));
  const F = 'RIto_Film_1080.mp4';
  const file = new File([await (await fetch('file:///C:/Users/beltr/Desktop/Rito Movie/Asset/' + F)).blob()], F, { type: 'video/mp4' });
  out.push('── ' + F + ': ' + (file.size / 1e9).toFixed(1) + ' GB leídos');
  importFiles([file]); await w(7000);
  const m = state.media.find(x => x.kind === 'video');
  if (!m) return 'no se importó';
  out.push('   importado: ' + m.w + '×' + m.h + ' dur=' + Math.round(m.dur) + 's proxy=' + (m.proxyReady ? 'SÍ' : 'no'));

  // instrumenta los SEEKS: la corrección de deriva puede entrar en bucle (seek → peor deriva → seek…)
  let seeks = 0; const seekLog = [];
  const hookSeeks = () => {
    for (const [cid, vi] of _vinst) {
      if (!vi.vel || vi.vel._hooked) continue;
      vi.vel._hooked = true;
      vi.vel.addEventListener('seeking', () => { seeks++; if (seekLog.length < 6) seekLog.push('clip' + cid + '@' + vi.vel.currentTime.toFixed(2)); });
    }
  };

  const medir = async (ms = 4000) => {
    const orig = window.render; let pintados = 0;
    window.render = function (...a) { pintados++; return orig.apply(this, a); };
    seeks = 0; seekLog.length = 0;
    const ph0 = state.playhead;
    const vt0 = [...(_vinst.values())].map(v => v.vel ? v.vel.currentTime : 0);
    await new Promise(r => setTimeout(r, ms));
    window.render = orig;
    const vt1 = [...(_vinst.values())].map(v => v.vel ? v.vel.currentTime : 0);
    const seg = ms / 1000;
    const vAv = vt1.map((t, i) => +(t - (vt0[i] || 0)).toFixed(2));
    return { fps: Math.round(pintados / seg), ph: +(state.playhead - ph0).toFixed(2), esperado: seg,
             video: vAv, seeks, ej: seekLog.slice(0, 3).join(' ') };
  };

  out.push('');
  out.push('── el caso que tironea: el MISMO clip duplicado');
  out.push('   fps = llamadas reales de la app a render() · cabezal/vídeo deberían avanzar ≈ los segundos medidos');
  for (let n = 1; n <= 3; n++) {
    addClip(m, n - 1, 0);
    renderTimeline(); render(); await w(1200);
    state.playhead = 5; play(); await w(4000); hookSeeks();   // [R104] calentamiento largo: separa el transitorio de arranque del estado ESTABLE
    const r = await medir(4000);
    pause(); await w(400);
    out.push('   ' + n + ' clip(s): ' + String(r.fps).padStart(3) + ' fps · cabezal +' + r.ph + 's/' + r.esperado + 's · vídeo ' + JSON.stringify(r.video) +
             ' · SEEKS: ' + r.seeks + (r.seeks > 5 ? ' ⚠ TORMENTA' : '') + (r.fps < 40 ? '  ⚠ TIRONES' : ''));
    if (r.seeks > 5) out.push('        ej: ' + r.ej);
  }

  /* control: ¿se pinta vídeo de verdad? OJO: con preserveDrawingBuffer:false (el defecto) hay que leer
     DENTRO del mismo frame, ANTES de devolver el control al navegador — si esperas a un rAF, el buffer ya se
     compuso y limpió, y readPixels devuelve negro. Mis dos controles anteriores decían "canvas vacío" por esto,
     no porque render() no dibujara. */
  const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
  const px = new Uint8Array(4 * W * H);
  await new Promise(res => requestAnimationFrame(() => {
    render();                                   // pinta y lee SIN ceder el hilo
    try { gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px); } catch (_) {}
    res();
  }));
  let vivos = 0; for (let i = 0; i < px.length; i += 4) if (px[i] + px[i + 1] + px[i + 2] > 30) vivos++;
  out.push('');
  out.push('── control: ' + (100 * vivos / (W * H)).toFixed(1) + '% del canvas con contenido  ' + (vivos > 5000 ? '✓ la medida vale' : '✗ canvas vacío: NO vale'));
  return out.join('\n');
})()

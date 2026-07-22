/* [R104] ¿render() está DIBUJANDO los clips, o mi benchmark midió una función que sale por la puerta de atrás?
   0.2ms con 4 clips a 4096² es sospechosamente bueno. Se comprueba antes de creérselo. */
(async () => {
  const out = []; const w = (n = 400) => new Promise(r => setTimeout(r, n));
  const SRC = 'file:///C:/Users/beltr/Desktop/Rito Movie/Asset/Creation/Baile 3.mp4';
  const v = document.createElement('video');
  v.src = SRC; v.muted = true; v.loop = true;
  await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error('no carga')); setTimeout(res, 8000); });
  await v.play().catch(() => {});
  await w(600);
  const m = { id: uid(), kind: 'video', name: 'probe', el: v, srcUrl: SRC, tex: newTex(), w: v.videoWidth, h: v.videoHeight, dur: v.duration || 20, fps: 60, thumb: null, color: null };
  state.media.push(m);
  state.clips = [{ id: uid(), mediaId: m.id, lane: 0, start: 0, dur: 18, inP: 0, name: 'probe', props: {} }];
  state.playhead = 2; renderTimeline(); await w(600);

  // 1. ¿el motor considera este clip "dibujable"?
  const drawn = collectDrawnVideoClips(state.clips, state.lanes, state.playhead, 0, []);
  out.push('1. collectDrawnVideoClips devuelve ' + drawn.length + ' clip(s)  ' + (drawn.length ? '✓' : '✗ ← render() no tiene nada que dibujar'));
  out.push('   vídeo: ' + v.videoWidth + '×' + v.videoHeight + ' readyState=' + v.readyState + ' currentTime=' + v.currentTime.toFixed(2) + ' paused=' + v.paused);

  // 2. ¿la textura del medio tiene datos? (si _w/_h no están, upTex nunca corrió)
  out.push('2. textura del medio: _w=' + m.tex._w + ' _h=' + m.tex._h + '  ' + (m.tex._w ? '✓ subida' : '✗ NUNCA se subió'));

  // 3. ¿el canvas visible tiene píxeles NO negros? (la prueba definitiva de que se pintó algo)
  render(); await new Promise(r => requestAnimationFrame(r));
  const cv = document.querySelector('canvas#glc') || document.querySelector('canvas');
  const px = new Uint8Array(4 * 64 * 64);
  try {
    gl.readPixels(Math.floor(gl.drawingBufferWidth / 2) - 32, Math.floor(gl.drawingBufferHeight / 2) - 32, 64, 64, gl.RGBA, gl.UNSIGNED_BYTE, px);
  } catch (e) { out.push('   readPixels falló: ' + e.message); }
  let noNegros = 0, sum = 0;
  for (let i = 0; i < px.length; i += 4) { const s = px[i] + px[i + 1] + px[i + 2]; sum += s; if (s > 24) noNegros++; }
  out.push('3. centro del canvas: ' + noNegros + '/4096 píxeles con contenido, brillo medio ' + (sum / 4096 / 3).toFixed(1) +
           '  ' + (noNegros > 100 ? '✓ se está pintando vídeo' : '✗ el canvas está NEGRO → render() no dibujó nada'));

  // 4. contar draw calls de verdad, envolviendo drawArrays
  const orig = gl.drawArrays.bind(gl); let calls = 0;
  gl.drawArrays = (...a) => { calls++; return orig(...a); };
  render();
  gl.drawArrays = orig;
  out.push('4. llamadas a drawArrays en un render(): ' + calls + '  ' + (calls > 0 ? '✓' : '✗ no dibuja nada'));

  // 5. Y el dato que importa: FPS REAL del bucle de reproducción, no de render() aislado
  const t0 = performance.now(); let n = 0;
  const before = state.playing;
  try { if (typeof play === 'function') play(); } catch (_) {}
  await new Promise(res => { const tick = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(tick); else res(); }; requestAnimationFrame(tick); });
  try { if (typeof pause === 'function') pause(); } catch (_) {}
  out.push('5. FPS real con 1 clip reproduciéndose: ' + Math.round(n / 2) + ' fps');

  try { v.pause(); v.src = ''; } catch (_) {}
  state.clips = []; state.media = state.media.filter(x => x !== m); renderTimeline();
  return out.join('\n');
})()

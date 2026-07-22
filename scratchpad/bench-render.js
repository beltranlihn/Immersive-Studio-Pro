/* [R104] ¿Dónde se va el frame? Ya sabemos que NO es decodificar (4×1440p60 a 62fps) ni subir texturas
   (0.5ms). Queda el composite: cada clip se deforma sobre un FBO de 2048² o 4096². Se mide render() real
   contra el número de clips, con vídeo REAL reproduciéndose. */
(async () => {
  const out = []; const w = (n = 300) => new Promise(r => setTimeout(r, n));
  const SRC = 'file:///C:/Users/beltr/Desktop/Rito Movie/Asset/Creation/Baile 3.mp4';
  const PRX = 'file:///C:/Users/beltr/Desktop/Rito Movie/Asset/Creation/Baile 3.dsp-proxy-1llepuo.mp4';

  const mkMedia = async (url, name) => {
    const v = document.createElement('video');
    v.src = url; v.muted = true; v.loop = true; v.playsInline = true;
    await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error('no carga')); setTimeout(() => rej(new Error('timeout')), 12000); });
    await v.play().catch(() => {});
    const m = { id: uid(), kind: 'video', name, el: v, srcUrl: url, tex: newTex(), w: v.videoWidth, h: v.videoHeight,
                dur: v.duration || 20, fps: 60, thumb: null, color: null };
    state.media.push(m); return m;
  };

  // mide el coste REAL de una llamada a render(): con gl.finish() para esperar a la GPU, no sólo al encolado
  const timeRender = async (n = 40) => {
    const ts = [];
    for (let i = 0; i < n; i++) {
      await new Promise(r => requestAnimationFrame(r));
      state.playhead = 1 + (i % 10) * 0.05;
      const t0 = performance.now();
      render();
      gl.finish();                       // sin esto se mide el encolado, no el trabajo de la GPU
      ts.push(performance.now() - t0);
    }
    ts.sort((a, b) => a - b);
    return { mediana: +ts[Math.floor(ts.length / 2)].toFixed(2), p90: +ts[Math.floor(ts.length * 0.9)].toFixed(2) };
  };

  const seq = activeSeq();
  out.push('── secuencia: ' + (seq ? seq.w + '×' + seq.h : '?') + '  modo=' + state.seqMode + '  COMP=' + (typeof compSize !== 'undefined' ? compSize : '?'));
  out.push('   presupuesto por frame a 60fps = 16.7ms · a 30fps = 33.3ms');
  out.push('');

  for (const [etiqueta, url] of [['FUENTE 2560×1440', SRC], ['PROXY 960×540', PRX]]) {
    state.clips = [];
    const medias = [];
    out.push('── ' + etiqueta);
    for (let n = 1; n <= 4; n++) {
      const m = await mkMedia(url, etiqueta + ' ' + n);
      medias.push(m);
      state.clips.push({ id: uid(), mediaId: m.id, lane: n - 1, start: 0, dur: 18, inP: 0, name: m.name, props: {} });
      state.lanes[n - 1] = state.lanes[n - 1] || { id: uid(), name: 'V' + n, tag: 'V' + n, kind: 'video' };
      renderTimeline(); await w(500);
      const r = await timeRender();
      const fps = r.mediana > 0 ? Math.min(60, Math.round(1000 / r.mediana)) : 60;
      out.push('   ' + n + ' clip(s): render ' + String(r.mediana).padStart(6) + 'ms  p90 ' + String(r.p90).padStart(6) + 'ms  →  ~' + fps + ' fps' + (r.mediana > 16.7 ? '   ⚠ NO llega a 60' : ''));
    }
    medias.forEach(m => { try { m.el.pause(); m.el.src = ''; } catch (_) {} });
    state.media = state.media.filter(m => !medias.includes(m));
    state.clips = [];
  }

  // ¿Cuánto cuesta el tamaño del composite? Mismo clip, distinto COMP.
  out.push('');
  out.push('── coste del composite por tamaño (1 clip fuente):');
  const m = await mkMedia(SRC, 'test');
  state.clips = [{ id: uid(), mediaId: m.id, lane: 0, start: 0, dur: 18, inP: 0, name: 'test', props: {} }];
  renderTimeline(); await w(500);
  for (const s of [1024, 2048, 4096]) {
    if (typeof setCompSize !== 'function') break;
    setCompSize(s); await w(250);
    const r = await timeRender(30);
    out.push('   COMP ' + String(s).padStart(4) + '²: render ' + String(r.mediana).padStart(6) + 'ms   (' + (s * s / 1e6).toFixed(1) + ' Mpx)');
  }
  try { m.el.pause(); m.el.src = ''; } catch (_) {}
  state.clips = []; state.media = state.media.filter(x => x !== m); renderTimeline();
  return out.join('\n');
})()

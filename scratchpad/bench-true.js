/* [R104] Medición HONESTA. Errores previos, todos míos:
   · medios sintéticos → la textura nunca se subía y render() medía una escena vacía (0.2ms).
   · fps() contaba MI bucle rAF, que corre a 60 haga lo que haga la app → "60fps" no significaba nada.
   · el control miraba el CENTRO del canvas, que en domo es el cénit: ahí no hay clips.
   Aquí se cuenta lo único que importa: cuántas veces pinta LA APP, y si el vídeo y el cabezal avanzan. */
(async () => {
  const out = []; const w = (n = 400) => new Promise(r => setTimeout(r, n));
  const DIR = 'file:///C:/Users/beltr/Desktop/Rito Movie/Asset/Creation/';
  const grab = async n => new File([await (await fetch(DIR + encodeURIComponent(n))).blob()], n, { type: 'video/mp4' });

  const files = [];
  for (const n of ['Baile 3.mp4', 'Baile 4.mp4', 'Baile 5.mp4']) { try { files.push(await grab(n)); } catch (_) {} }
  importFiles(files); await w(6500);
  const vids = state.media.filter(m => m.kind === 'video');
  out.push('── ' + vids.length + ' vídeos reales importados (' + (vids[0] ? vids[0].w + '×' + vids[0].h : '?') + ' H.264 60fps 136Mbps)');
  out.push('   modo=' + state.seqMode + ' · secuencia=' + (activeSeq() ? activeSeq().w + '²' : '?'));
  out.push('');

  const medir = async (ms = 3000) => {
    // 1) cuenta las llamadas REALES de la app a render()
    const orig = window.render; let pintados = 0;
    window.render = function (...a) { pintados++; return orig.apply(this, a); };
    // 2) muestrea el cabezal para ver saltos (jitter = tirones)
    const ph = []; const vt = [];
    const v0 = vids[0] && vids[0].el;
    const t0 = performance.now();
    const sampler = setInterval(() => { ph.push(state.playhead); if (v0) vt.push(v0.currentTime); }, 50);
    await new Promise(r => setTimeout(r, ms));
    clearInterval(sampler); window.render = orig;
    const seg = ms / 1000;
    // avance del cabezal: ¿constante o a tirones?
    const d = []; for (let i = 1; i < ph.length; i++) d.push(ph[i] - ph[i - 1]);
    const med = d.slice().sort((a, b) => a - b)[Math.floor(d.length / 2)] || 0;
    const saltos = d.filter(x => x > med * 2.5).length;                 // pausas: el cabezal salta de golpe
    const vAvance = (vt.length > 1) ? (vt[vt.length - 1] - vt[0]) : 0;
    return { fpsApp: Math.round(pintados / seg), phAvance: +((ph[ph.length - 1] - ph[0]) || 0).toFixed(2),
             vAvance: +vAvance.toFixed(2), saltos, esperado: +seg.toFixed(1) };
  };

  out.push('── FPS REAL de la app (llamadas a render() por segundo), apilando clips:');
  out.push('   referencia: 60 = fluido · <40 se nota · <25 inusable. "saltos" = tirones del cabezal.');
  for (let n = 1; n <= vids.length; n++) {
    addClip(vids[n - 1], n - 1, 0);
    renderTimeline(); await w(800);
    state.playhead = 1; play(); await w(800);
    const r = await medir(3000);
    pause(); await w(300);
    out.push('   ' + n + ' clip(s): ' + String(r.fpsApp).padStart(3) + ' fps app · cabezal +' + r.phAvance + 's de ' + r.esperado + 's esperados · vídeo +' + r.vAvance + 's · saltos: ' + r.saltos +
             (r.fpsApp < 40 ? '   ⚠ TIRONES' : ''));
  }

  // control honesto: ¿hay vídeo pintado en ALGUNA parte del canvas?
  render(); await new Promise(r => requestAnimationFrame(r));
  const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
  const px = new Uint8Array(4 * W * H);
  try { gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px); } catch (e) { out.push('readPixels: ' + e.message); }
  let vivos = 0; for (let i = 0; i < px.length; i += 4) if (px[i] + px[i + 1] + px[i + 2] > 30) vivos++;
  const pct = (100 * vivos / (W * H)).toFixed(1);
  out.push('');
  out.push('── control: ' + pct + '% del canvas tiene contenido  ' + (vivos > 5000 ? '✓ se está pintando vídeo: la medida vale' : '✗ canvas vacío: la medida NO vale'));
  return out.join('\n');
})()

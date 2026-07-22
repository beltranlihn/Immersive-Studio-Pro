/* [R104] Perfilado por el CAMINO REAL. La versión anterior fabricaba objetos de medio a mano: la textura nunca
   se subía, el canvas salía negro y render() medía 0.2ms dibujando una escena vacía. Lección repetida hoy:
   medir por el camino del usuario o no medir.
   Aquí se importa con importFiles() —lo mismo que hace un arrastre de fichero— y se reproduce de verdad. */
(async () => {
  const out = []; const w = (n = 400) => new Promise(r => setTimeout(r, n));
  const DIR = 'file:///C:/Users/beltr/Desktop/Rito Movie/Asset/Creation/';
  const grab = async (name) => { const r = await fetch(DIR + encodeURIComponent(name)); const b = await r.blob(); return new File([b], name, { type: 'video/mp4' }); };

  const fps = async (ms = 2000) => { const t0 = performance.now(); let n = 0;
    await new Promise(res => { const tick = () => { n++; if (performance.now() - t0 < ms) requestAnimationFrame(tick); else res(); }; requestAnimationFrame(tick); });
    return Math.round(n / (ms / 1000)); };

  // importa 4 vídeos DISTINTOS por el camino real
  const nombres = ['Baile 3.mp4', 'Baile 4.mp4', 'Baile 5.mp4', 'Baile 6.mp4'];
  const files = [];
  for (const n of nombres) { try { files.push(await grab(n)); } catch (e) { out.push('no pude leer ' + n); } }
  out.push('── importando ' + files.length + ' vídeos por el camino real (importFiles)…');
  importFiles(files);
  await w(6000);                                   // deja que decodifique metadatos, fps y miniaturas
  const vids = state.media.filter(m => m.kind === 'video');
  out.push('   medios de vídeo importados: ' + vids.length + '  ' + vids.map(m => m.w + '×' + m.h).join(' · '));
  if (!vids.length) return out.join('\n');

  state.clips = [];
  out.push('');
  out.push('── FPS reproduciendo, apilando clips (cada uno en su pista):');
  out.push('   presupuesto: 60fps = fluido · <40 = se nota · <25 = inusable');
  for (let n = 1; n <= Math.min(4, vids.length); n++) {
    const m = vids[n - 1];
    addClip(m, n - 1, 0);          // la funcion REAL del motor; las 4 pistas de video ya existen por defecto
    renderTimeline(); render(); await w(900);
    state.playhead = 1; play(); await w(700);       // deja arrancar
    const f = await fps(2500);
    // ¿la textura se está subiendo de verdad?
    const subidas = state.media.filter(x => x.tex && x.tex._w).length;
    pause(); await w(300);
    out.push('   ' + n + ' clip(s): ' + String(f).padStart(3) + ' fps   · texturas vivas: ' + subidas + '/' + n + (f < 40 ? '   ⚠' : ''));
  }

  // el canvas tiene contenido de verdad?
  render(); await new Promise(r => requestAnimationFrame(r));
  const px = new Uint8Array(4 * 32 * 32);
  try { gl.readPixels(Math.floor(gl.drawingBufferWidth / 2) - 16, Math.floor(gl.drawingBufferHeight / 2) - 16, 32, 32, gl.RGBA, gl.UNSIGNED_BYTE, px); } catch (_) {}
  let vivos = 0; for (let i = 0; i < px.length; i += 4) if (px[i] + px[i + 1] + px[i + 2] > 24) vivos++;
  out.push('');
  out.push('── control: ' + vivos + '/1024 píxeles con contenido en el centro  ' + (vivos > 50 ? '✓ se está pintando vídeo de verdad' : '✗ canvas negro: la medida NO vale'));
  return out.join('\n');
})()

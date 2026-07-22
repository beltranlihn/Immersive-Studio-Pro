/* [R104] Micro-benchmark del camino real de reproducción: <video> → texImage2D.
   Hipótesis: `UNPACK_FLIP_Y_WEBGL=true` rompe el camino rápido de Chromium y fuerza una copia GPU→CPU→GPU por
   frame y por clip. Se mide, no se supone. Se usan los vídeos REALES del proyecto RITO (2560×1440 H264 60fps
   136 Mbps) y sus proxies (960×540 12.6 Mbps). */
(async () => {
  const out = [];
  const F = {
    src: 'file:///C:/Users/beltr/Desktop/Rito Movie/Asset/Creation/Baile 3.mp4',
    proxy: 'file:///C:/Users/beltr/Desktop/Rito Movie/Asset/Creation/Baile 3.dsp-proxy-1llepuo.mp4',
  };
  const mkVideo = url => new Promise((res, rej) => {
    const v = document.createElement('video');
    v.src = url; v.muted = true; v.loop = true; v.playsInline = true;
    v.onloadeddata = () => v.play().then(() => res(v)).catch(e => rej(e));
    v.onerror = () => rej(new Error('no carga: ' + url));
    setTimeout(() => rej(new Error('timeout')), 12000);
  });
  const bench = async (v, flipY, n = 90) => {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v);   // primera: define tamaño
    const ts = [];
    for (let i = 0; i < n; i++) {
      await new Promise(r => requestAnimationFrame(r));
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY);
      const t0 = performance.now();
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, v);
      gl.flush();                       // fuerza el envío; sin esto se mide sólo el encolado
      const t1 = performance.now();
      ts.push(t1 - t0);
    }
    gl.deleteTexture(tex);
    ts.sort((a, b) => a - b);
    return { mediana: +ts[Math.floor(ts.length / 2)].toFixed(3), p90: +ts[Math.floor(ts.length * 0.9)].toFixed(3), max: +ts[ts.length - 1].toFixed(3) };
  };

  for (const [name, url] of Object.entries(F)) {
    let v; try { v = await mkVideo(url); } catch (e) { out.push(name + ': ' + e.message); continue; }
    const dim = v.videoWidth + '×' + v.videoHeight;
    const conFlip = await bench(v, true);
    const sinFlip = await bench(v, false);
    out.push('── ' + name + '  ' + dim);
    out.push('   FLIP_Y=true  (lo que hacemos hoy): mediana ' + conFlip.mediana + 'ms  p90 ' + conFlip.p90 + '  max ' + conFlip.max);
    out.push('   FLIP_Y=false (camino rápido)     : mediana ' + sinFlip.mediana + 'ms  p90 ' + sinFlip.p90 + '  max ' + sinFlip.max);
    const factor = sinFlip.mediana > 0 ? (conFlip.mediana / sinFlip.mediana) : 0;
    out.push('   → FLIP_Y cuesta ×' + factor.toFixed(1) + '   (presupuesto por frame a 60fps = 16.7ms TOTAL)');
    v.pause(); v.src = '';
  }

  // ¿Cuántos decodificadores hardware simultáneos aguanta Chromium antes de caer a software?
  out.push('');
  out.push('── decodificadores simultáneos (mismo fichero 2560×1440):');
  const vids = [];
  for (let n = 1; n <= 4; n++) {
    try { vids.push(await mkVideo(F.src)); } catch (e) { out.push('   no pudo abrir el nº' + n + ': ' + e.message); break; }
    await new Promise(r => setTimeout(r, 700));
    // mide FPS real de reproducción de todos a la vez
    const t0 = performance.now(); let frames = 0;
    await new Promise(res => { const tick = () => { frames++; if (performance.now() - t0 < 1000) requestAnimationFrame(tick); else res(); }; requestAnimationFrame(tick); });
    // ¿avanzan de verdad los vídeos, o se congelan?
    const a = vids.map(v => v.currentTime);
    await new Promise(r => setTimeout(r, 500));
    const b = vids.map(v => v.currentTime);
    const avanzan = b.filter((t, i) => t - a[i] > 0.2).length;
    out.push('   ' + n + ' vídeo(s): rAF ' + frames + ' fps · avanzan ' + avanzan + '/' + n);
  }
  vids.forEach(v => { v.pause(); v.src = ''; });
  return out.join('\n');
})()

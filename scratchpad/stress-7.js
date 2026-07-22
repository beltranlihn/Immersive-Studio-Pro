/* [R103] Referencias cruzadas: cosas que apuntan a otras cosas que el usuario puede borrar.
   Es donde viven los bugs silenciosos — no revientan, devuelven basura. */
(async () => {
  const out = []; const w = (n = 140) => new Promise(r => setTimeout(r, n));
  const ok = (n, c, d) => out.push((c ? 'ok   ' : 'FAIL ') + n + (d ? '  → ' + d : ''));

  // ── 1. AUTOMATION ITEM borrado mientras un clip lo enlaza (R95·D2: c.kfLink[param]=itemId)
  let crash = null, res = null;
  try {
    const c = state.clips[0];
    if (c && state.autoItems) {
      const iid = 'it_' + uid();
      state.autoItems[iid] = { id: iid, name: 'prueba', kf: [{ t: 0, v: 0 }, { t: 2, v: 1 }], loop: false, rel: false };
      c.kfLink = c.kfLink || {}; c.kfLink.opacity = iid;
      c.kf = c.kf || {}; c.kf.opacity = [{ t: 0, v: 0 }, { t: 2, v: 1 }];
      renderTimeline(); render(); await w();
      delete state.autoItems[iid];                    // el usuario borra el item de la biblioteca
      renderTimeline(); render(); renderInspector();
      res = evalP(c, 'opacity', c.start + 1);
      out.push('--   kfLink apunta a un item borrado → evalP devuelve ' + res);
      delete c.kfLink.opacity; delete c.kf.opacity;
    } else out.push('--   (sin autoItems: no aplica)');
  } catch (e) { crash = e.message; }
  ok('1 borrar un Automation Item enlazado no revienta ni devuelve basura',
     !crash && (res == null || isFinite(res)), crash || 'evalP=' + res);

  // ── 2. Borrar una SECUENCIA que está colocada como clip en otra
  crash = null;
  try {
    const seq = state.media.find(m => m.kind === 'nest');
    if (seq) {
      const c = { id: uid(), mediaId: seq.id, lane: 0, start: 8, dur: 3, inP: 0, name: seq.name, props: {} };
      state.clips.push(c);
      renderTimeline(); render(); await w();
      state.media = state.media.filter(m => m.id !== seq.id);   // la secuencia se borra de la biblioteca
      state.openSeqs = (state.openSeqs || []).filter(id => id !== seq.id);
      renderTimeline(); render(); renderMedia();
      const el = document.querySelector('.clip[data-clip="' + c.id + '"]');
      out.push('--   el clip de la secuencia borrada ' + (el ? 'sigue en la timeline' : 'desapareció'));
      state.clips = state.clips.filter(x => x.id !== c.id);
      renderTimeline();
    } else out.push('--   (sin secuencias)');
  } catch (e) { crash = e.message; }
  ok('2 borrar una secuencia colocada como clip no revienta', !crash, crash || 'sin excepción');

  // ── 3. MODULACIÓN sobre un parámetro cuyo efecto se va (pila de modulación de R95·C1)
  crash = null; let mv = null;
  try {
    const c = state.clips[0];
    if (c) {
      c.mod = c.mod || {};
      c.mod.opacity = [{ id: uid(), src: 'audio', band: 'bass', blend: 'add', amt: 0.5, on: true }];
      renderTimeline(); render();
      mv = evalR(c, 'opacity', c.start + 0.5);
      out.push('--   evalR con modulador de audio (sin audio cargado) = ' + mv);
      c.mod.opacity[0].src = 'zzz-inexistente';               // fuente de modulación desconocida
      const mv2 = evalR(c, 'opacity', c.start + 0.5);
      out.push('--   evalR con una fuente de modulación desconocida = ' + mv2);
      ok('3 una fuente de modulación desconocida no produce NaN', isFinite(mv2), 'valor=' + mv2);
      delete c.mod.opacity;
    }
  } catch (e) { crash = e.message; ok('3 fuente de modulación desconocida', false, crash); }
  if (!crash && mv !== null) ok('3b evalR con audio ausente sigue siendo finito', isFinite(mv), 'valor=' + mv);

  // ── 4. Un clip en una PISTA que ya no existe (borrar la pista de debajo)
  crash = null;
  try {
    const c = state.clips[0];
    if (c) { const orig = c.lane; c.lane = 999; renderTimeline(); render(); c.lane = orig; renderTimeline(); render(); }
  } catch (e) { crash = e.message; }
  ok('4 un clip que apunta a una pista inexistente no revienta', !crash, crash || 'sin excepción');

  // ── 5. fps = 0 o negativo (proyecto corrupto / import raro): divisiones por fps en todo el motor
  crash = null;
  try { const f = state.fps; state.fps = 0; renderTimeline(); drawRuler(); render(); state.fps = f; renderTimeline(); drawRuler(); render(); }
  catch (e) { crash = e.message; }
  ok('5 fps=0 no revienta la regla ni el render', !crash, crash || 'sin excepción');
  return out.join('\n');
})()

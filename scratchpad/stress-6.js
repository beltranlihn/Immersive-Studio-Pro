/* [R103] Segunda tanda. Zonas que la guarda del overlay no cubre y que stress-4 no tocó:
   gestos interrumpidos, keyframes fuera del clip tras recortar, y los tres modos de secuencia. */
(async () => {
  const out = []; const w = (n = 140) => new Promise(r => setTimeout(r, n));
  const ok = (n, c, d) => out.push((c ? 'ok   ' : 'FAIL ') + n + (d ? '  → ' + d : ''));
  const key = (k, o = {}) => window.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true, cancelable: true }, o)));

  // ── 1. ARRASTRE INTERRUMPIDO: empiezo a mover un clip y borro / deshago a media gesto.
  //    Los handlers de pointermove viven en window: si el clip muere bajo ellos, ¿siguen tocándolo?
  let crash = null;
  try {
    const cd = document.querySelector('.clip');
    if (cd) {
      const c = clipById(+cd.dataset.clip);
      state.selId = c.id; state.selIds = [c.id];
      const r = cd.getBoundingClientRect();
      const tt = cd.querySelector('.tt') || cd;
      tt.dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientX: r.left + 20, clientY: r.top + 5, bubbles: true }));
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + 60, clientY: r.top + 5, bubbles: true }));
      await w(60);
      state.clips = state.clips.filter(x => x.id !== c.id);   // el clip desaparece A MEDIO ARRASTRE
      renderTimeline();
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + 120, clientY: r.top + 5, bubbles: true }));
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      await w(80);
      render();
    }
  } catch (e) { crash = e.message; }
  ok('1 borrar un clip a MEDIO arrastre no revienta', !crash, crash || 'sin excepción');
  try { key('z', { ctrlKey: true }); await w(); } catch (_) {}

  // ── 2. UNDO a medio arrastre (undo REEMPLAZA los objetos clip que el gesto tiene capturados)
  crash = null;
  try {
    const cd = document.querySelector('.clip');
    if (cd) {
      const r = cd.getBoundingClientRect();
      const tt = cd.querySelector('.tt') || cd;
      tt.dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientX: r.left + 20, clientY: r.top + 5, bubbles: true }));
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + 70, clientY: r.top + 5, bubbles: true }));
      await w(60);
      key('z', { ctrlKey: true }); await w(80);            // deshacer con el ratón aún abajo
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + 140, clientY: r.top + 5, bubbles: true }));
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      await w(80); render();
    }
  } catch (e) { crash = e.message; }
  ok('2 deshacer a MEDIO arrastre no revienta', !crash, crash || 'sin excepción');

  // ── 3. KEYFRAMES QUE QUEDAN FUERA DEL CLIP al recortarlo. ¿Se evalúan? ¿revienta evalP?
  crash = null; let val = null;
  try {
    const c = state.clips[0];
    if (c) {
      c.kf = c.kf || {};
      c.kf.opacity = [{ t: 0, v: 0 }, { t: 3.5, v: 1 }];    // keyframe a t=3.5s
      c.dur = 1.0;                                          // ...y ahora el clip dura 1s: el kf queda FUERA
      renderTimeline(); render();
      val = evalP(c, 'opacity', c.start + 0.5);
      const end = evalP(c, 'opacity', c.start + c.dur);
      out.push('--   opacity a mitad=' + val + '  al final=' + end + '  (keyframe huérfano en t=3.5 con dur=1.0)');
      delete c.kf.opacity; c.dur = 4;
    }
  } catch (e) { crash = e.message; }
  ok('3 keyframes fuera del clip recortado no revientan evalP', !crash && val != null && isFinite(val), crash || 'valor=' + val);

  // ── 4. LOS TRES MODOS DE SECUENCIA: dome / flat / room. Cambiar en caliente.
  const modos = ['dome', 'flat', 'room'];
  const malos = [];
  for (const md of modos) {
    try { state.seqMode = md; if (typeof updModeUI === 'function') updModeUI(); renderTimeline(); render(); await w(70); }
    catch (e) { malos.push(md + ': ' + e.message); }
  }
  ok('4 cambiar entre dome/flat/room en caliente no revienta', !malos.length, malos.join(' | ') || modos.join(' → '));
  state.seqMode = 'dome'; try { updModeUI(); } catch (_) {} render();

  // ── 5. CLIP DE DURACIÓN CERO (recortar hasta nada) — divisiones por dur en todo el motor
  crash = null;
  try {
    const c = state.clips[0];
    if (c) { const d = c.dur; c.dur = 0; renderTimeline(); render(); if (typeof evalP === 'function') evalP(c, 'opacity', c.start); c.dur = d; renderTimeline(); render(); }
  } catch (e) { crash = e.message; }
  ok('5 un clip de duración 0 no revienta el render', !crash, crash || 'sin excepción');
  return out.join('\n');
})()

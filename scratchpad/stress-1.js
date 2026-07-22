/* [R103] Auditoría adversarial: qué se rompe en una sesión REAL de edición.
   Hipótesis a batir: el bug del export (doble apertura → modal muerto) no es único; es una CLASE.
   14 sitios crean overlays y sólo openExport se protege. Aquí se prueba lo que un editor hace de verdad:
   pulsar dos veces, mezclar herramientas, borrar lo que otra cosa está usando. */
(async () => {
  const out = []; const w = (n = 200) => new Promise(r => setTimeout(r, n));
  const ok = (n, c, d) => out.push((c ? 'ok   ' : 'FAIL ') + n + (d ? '  → ' + d : ''));
  const clean = () => document.querySelectorAll('.overlay,.menu').forEach(o => o.remove());

  // ── 1. DOBLE APERTURA con teclado (el overlay tapa el ratón, NO el teclado)
  clean();
  if (typeof openPalette === 'function') {
    openPalette(); await w(); openPalette(); await w();
    const pals = document.querySelectorAll('.overlay').length;
    ok('Ctrl+K dos veces no duplica la paleta de comandos', pals <= 1, pals + ' overlays');
    clean();
  }
  if (typeof openPrefs === 'function') {
    openPrefs(); await w(); openPrefs(); await w();
    const n = document.querySelectorAll('.overlay').length;
    ok('Preferencias dos veces no duplica', n <= 1, n + ' overlays');
    clean();
  }
  // dos diálogos DISTINTOS a la vez: ¿se pisan?
  if (typeof openPalette === 'function') {
    openPalette(); await w(); openExport(); await w();
    const n = document.querySelectorAll('.overlay').length;
    ok('paleta + export a la vez no dejan dos modales apilados', n <= 1, n + ' overlays apilados');
    clean();
  }

  // ── 2. BORRAR ALGO QUE OTRA COSA ESTÁ USANDO
  // 2a. borrar el fx que la pista está automatizando
  const c = state.clips[0];
  if (c) {
    state.selId = c.id; state.selIds = [c.id];
    c.fx = c.fx || [];
    const fxId = uid();
    c.fx.push({ id: fxId, type: 'blur', on: true, p: { amount: 0.5 } });
    const li = c.lane;
    state.lanes[li]._autoP = 'fxt:blur:amount';
    c.kf = c.kf || {}; c.kf['fxt:blur:amount'] = [{ t: 0, v: 0 }, { t: 1, v: 1 }];
    renderTimeline(); await w();
    c.fx = c.fx.filter(f => f.id !== fxId);          // el editor quita el efecto
    let crashed = null;
    try { renderTimeline(); render(); renderInspector(); } catch (e) { crashed = e.message; }
    ok('quitar un efecto que la pista automatiza no revienta', !crashed, crashed || 'sin excepción');
    const resolved = (typeof laneAutoP === 'function') ? laneAutoP(state.lanes[li], li) : '?';
    ok('...y la automatización huérfana se resuelve a otro parámetro', resolved !== 'fxt:blur:amount', 'ahora=' + resolved);
    delete c.kf['fxt:blur:amount'];
  }

  // 2b. borrar el MEDIO de un clip que está en la línea de tiempo
  const c2 = state.clips[1];
  if (c2) {
    const mid = c2.mediaId;
    const before = state.media.length;
    state.media = state.media.filter(m => m.id !== mid);
    let crashed = null;
    try { renderTimeline(); render(); renderInspector(); } catch (e) { crashed = e.message; }
    ok('borrar el medio de un clip vivo no revienta el render', !crashed, crashed || 'sin excepción');
    const el = document.querySelector('.clip[data-clip="' + c2.id + '"]');
    ok('...y el clip huérfano se sigue pintando (no desaparece en silencio)', !!el, el ? 'presente' : 'DESAPARECIÓ');
    ok('...y clipTint aguanta un medio inexistente', !!clipTint(c2, mediaById(mid)), clipTint(c2, mediaById(mid)));
  }

  // ── 3. HERRAMIENTAS: ¿se pisan los modos?
  const tools = ['select', 'hand', 'trim', 'razor', 'zoom'];
  let toolBad = [];
  for (const t of tools) {
    state.tl.tool = t;
    try { applyToolCursor(); } catch (e) { toolBad.push(t + ':' + e.message); }
  }
  ok('cambiar entre las 5 herramientas no revienta', !toolBad.length, toolBad.join(' | ') || tools.join(' → '));
  state.tl.tool = 'select'; applyToolCursor();

  // ── 4. AUTOMATIZACIÓN + CAMBIO DE SECUENCIA (el comentario avisa: shapeBox lleva refs vivas a keyframes)
  state.inlineCurves = true; syncAutoUI();
  ok('shapeBox se limpia al entrar en modo automatización', !state.shapeBox, String(state.shapeBox));
  return out.join('\n');
})()

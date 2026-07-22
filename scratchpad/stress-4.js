/* [R103] La guarda del overlay protege todo lo modal. Aquí se prueba lo que NO cubre: edición real sin modales.
   Escenarios que un editor hace sin pensar y que suelen romper NLEs. */
(async () => {
  const out = []; const w = (n = 160) => new Promise(r => setTimeout(r, n));
  const ok = (n, c, d) => out.push((c ? 'ok   ' : 'FAIL ') + n + (d ? '  → ' + d : ''));
  const key = (k, o = {}) => window.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true, cancelable: true }, o)));

  // ── 1. RECURSIÓN: meter una secuencia DENTRO DE SÍ MISMA. Clásico de cuelgue en NLEs.
  const seqM = state.media.find(m => m.kind === 'nest' || (typeof isSeqMedia === 'function' && isSeqMedia(m)));
  if (seqM) {
    const active = (typeof activeSeq === 'function') ? activeSeq() : null;
    out.push('--   secuencia activa: ' + (active ? active.name : 'ninguna') + ' · nest disponible: ' + seqM.name);
    if (active && active.id === seqM.id) {
      let crashed = null, hung = false;
      const t0 = Date.now();
      try {
        // arrastrar la secuencia activa dentro de sí misma
        const c = { id: uid(), mediaId: seqM.id, lane: 0, start: 0, dur: 4, inP: 0, name: seqM.name, props: {} };
        state.clips.push(c);
        renderTimeline(); render();
        if (Date.now() - t0 > 3000) hung = true;
        state.clips = state.clips.filter(x => x.id !== c.id);
        renderTimeline(); render();
      } catch (e) { crashed = e.message; state.clips = state.clips.filter(x => x.mediaId !== seqM.id || x.id !== undefined); }
      ok('1 meter la secuencia activa dentro de sí misma no cuelga ni revienta',
         !crashed && !hung, (crashed || (hung ? 'TARDÓ >3s' : 'ok en ' + (Date.now() - t0) + 'ms')));
    } else out.push('--   (la secuencia activa no es un nest: no se puede probar la auto-recursión aquí)');
  } else out.push('--   (no hay medios de tipo secuencia)');

  // ── 2. BORRAR MIENTRAS SE REPRODUCE
  const nAntes = state.clips.length;
  let crash2 = null;
  try {
    if (typeof play === 'function') play(); else state.playing = true;
    await w(180);
    const c = state.clips[0];
    if (c) { state.selId = c.id; state.selIds = [c.id]; key('Delete'); }
    await w(180);
    if (typeof pause === 'function') pause(); else state.playing = false;
    await w(80);
  } catch (e) { crash2 = e.message; try { pause(); } catch (_) {} }
  ok('2 borrar el clip que se está reproduciendo no revienta', !crash2, crash2 || (nAntes + ' → ' + state.clips.length + ' clips'));

  // ── 3. UNDO MIENTRAS SE REPRODUCE (undo reemplaza los objetos clip bajo el motor)
  let crash3 = null;
  try {
    if (typeof play === 'function') play(); else state.playing = true;
    await w(150);
    key('z', { ctrlKey: true }); await w(150);
    key('z', { ctrlKey: true }); await w(150);
    if (typeof pause === 'function') pause(); else state.playing = false;
    await w(80);
    render();
  } catch (e) { crash3 = e.message; try { pause(); } catch (_) {} }
  ok('3 deshacer mientras se reproduce no revienta', !crash3, crash3 || 'sin excepción');

  // ── 4. COLISIÓN DE ATAJOS: B = razor, Shift+B = shape box (R97 ya pilló uno de estos)
  const pares = [['b', { shiftKey: true }, 'Shift+B'], ['t', {}, 'T'], ['v', {}, 'V'], ['z', {}, 'Z'], ['h', {}, 'H']];
  let colisiones = [];
  for (const [k, mods, label] of pares) {
    const antes = state.tl.tool, sb = !!state.shapeBox;
    key(k, mods); await w(60);
    if (label === 'Shift+B' && state.tl.tool === 'razor' && !state.shapeBox) colisiones.push('Shift+B disparó el razor');
  }
  ok('4 Shift+B no dispara el razor (la colisión de R97 sigue arreglada)', !colisiones.length, colisiones.join(' | ') || 'herramienta=' + state.tl.tool);
  state.tl.tool = 'select'; applyToolCursor();

  // ── 5. TRIM sobre un clip cuyo vecino desaparece a mitad
  let crash5 = null;
  try {
    if (state.clips.length >= 2 && typeof trimZone === 'function') {
      const c = state.clips[0];
      state.selId = c.id; state.selIds = [c.id]; state.tl.tool = 'trim';
      const z = trimZone(c, 5, 200, false);
      state.clips.splice(1, 1);                 // el vecino se va mientras el trim está "armado"
      if (typeof trimNudge === 'function') { trimNudge(1, 1); trimNudge(-1, 1); }
      renderTimeline();
    }
  } catch (e) { crash5 = e.message; }
  ok('5 trim con el vecino borrado a mitad no revienta', !crash5, crash5 || 'sin excepción');
  state.tl.tool = 'select'; applyToolCursor();
  return out.join('\n');
})()

/* [R102·D-T2] Estado DERIVADO ≠ estado AFIRMADO. Un clip resaltado porque su grupo está seleccionado no lo
   elegiste tú. Ableton lo separa con `ImplicitArm`. La distinción tiene que ser de FORMA (discontinuo), no
   sólo de color: si sólo cambia el tono, se pierde en escala de grises y con daltonismo — y encima competía
   con el borde de la selección propia. */
(async () => {
  const out = []; const ok = (n, c, d) => out.push((c ? 'ok   ' : 'FAIL ') + n + (d ? '  → ' + d : ''));
  const w = () => new Promise(r => setTimeout(r, 70));
  const lum = s => { const m = String(s).match(/(\d+),\s*(\d+),\s*(\d+)/); return m ? (+m[1] + +m[2] + +m[3]) / 3 : -1; };

  // agrupa dos clips y selecciona el grupo → quedan 'gsel' (derivado), no 'sel'
  const a = state.clips[0], b = state.clips[1];
  if (!a || !b) { out.push('--   (hacen falta 2 clips)'); return out.join('\n'); }
  const gid = 1; a.groupId = gid; b.groupId = gid;
  state.selGroupId = gid; state.selIds = [a.id]; state.selId = a.id;
  renderTimeline(); await w();

  const gselEl = [...document.querySelectorAll('.clip.gsel')].find(e => !e.classList.contains('sel'));
  const selEl = document.querySelector('.clip.sel');
  ok('hay un clip derivado (gsel sin sel) y uno afirmado (sel)', !!gselEl && !!selEl,
     'gsel=' + document.querySelectorAll('.clip.gsel').length + ' sel=' + document.querySelectorAll('.clip.sel').length);
  if (!gselEl || !selEl) { a.groupId = null; b.groupId = null; state.selGroupId = null; renderTimeline(); return out.join('\n'); }

  const gs = getComputedStyle(gselEl), ss = getComputedStyle(selEl);
  // LA CLAVE: se distinguen por FORMA, no sólo por color
  ok('el derivado es DISCONTINUO (forma, no sólo color)', gs.outlineStyle === 'dashed', 'outline-style=' + gs.outlineStyle);
  ok('el afirmado es MACIZO', ss.borderTopStyle === 'solid', 'border-style=' + ss.borderTopStyle);
  ok('formas distintas entre derivado y afirmado', gs.outlineStyle !== ss.borderTopStyle, gs.outlineStyle + ' vs ' + ss.borderTopStyle);

  // ...y lo derivado NO debe gritar más que lo afirmado (antes gsel usaba --ink-2 y sel-standby --ink-3)
  const lg = lum(gs.outlineColor), lsAf = lum(ss.borderTopColor);
  ok('lo derivado no pesa más que lo afirmado', lg <= lsAf + 1, 'derivado=' + lg.toFixed(0) + ' afirmado=' + lsAf.toFixed(0));

  // el derivado sigue siendo visible (está agrupado: hay que poder verlo)
  ok('el derivado se ve contra el fondo', lg > 77, 'lum=' + lg.toFixed(0) + ' vs fondo=17');

  a.groupId = null; b.groupId = null; state.selGroupId = null; renderTimeline();
  return out.join('\n');
})()

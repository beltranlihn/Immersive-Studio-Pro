/* [R102·D-T2] Selección en dos niveles. La señal sólo vale si (a) los dos niveles se distinguen de verdad,
   (b) el nivel pleno sigue al panel que tiene el foco, y (c) standby NO es invisible: sigue estando
   seleccionado, sólo que no es el destinatario. Un standby que no se ve sería peor que no tener niveles. */
(async () => {
  const out = []; const ok = (n, c, d) => out.push((c ? 'ok   ' : 'FAIL ') + n + (d ? '  → ' + d : ''));
  const w = () => new Promise(r => setTimeout(r, 60));
  const down = el => el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  const alpha = s => { const m = String(s).match(/rgba?\([^)]*?([\d.]+)\)/); return m ? parseFloat(m[1]) : 1; };

  // selecciona un clip y deja el foco en la línea de tiempo
  const c = state.clips[0];
  state.selId = c.id; state.selIds = [c.id]; renderTimeline(); await w();
  const tl = document.querySelector('#tracks');
  down(tl); await w();
  ok('el clic en la línea de tiempo pone el foco ahí', document.body.classList.contains('fp-timeline'), [...document.body.classList].filter(x => x.startsWith('fp-')).join(','));

  /* Se mide el BORDE DEL CLIP, no el contorno del título: `body.simpleclips` anula ese contorno a propósito
     (en modo simple el título deja de ser el asa) y el modo simple viene activado por defecto. Medir el título
     daría "standby: none" y me haría 'arreglar' algo que no está roto — cosa que casi hago. */
  const selEl = document.querySelector('.clip.sel');
  if (!selEl) { out.push('FAIL no hay clip seleccionado en el DOM'); return out.join('\n'); }
  const lum = el => { const m = String(getComputedStyle(el).borderTopColor).match(/(\d+),\s*(\d+),\s*(\d+)/); return m ? (+m[1] + +m[2] + +m[3]) / 3 : -1; };
  const focused = lum(selEl);

  // mueve el foco al panel de medios: el clip SIGUE seleccionado, pero en standby
  const mp = document.getElementById('mediaPane');
  down(mp); await w();
  ok('el clic en medios mueve el foco', document.body.classList.contains('fp-media'), [...document.body.classList].filter(x => x.startsWith('fp-')).join(','));
  const standby = lum(document.querySelector('.clip.sel'));

  ok('selección con foco ≠ standby', focused !== standby, 'borde con foco=' + focused.toFixed(0) + '  standby=' + standby.toFixed(0));
  ok('standby es MÁS TENUE que el foco', standby < focused, standby.toFixed(0) + ' < ' + focused.toFixed(0));
  // ...pero NO invisible: sigue seleccionado, sólo que no es el destinatario del teclado
  const bg = 17; // s0 #111111
  ok('standby sigue siendo VISIBLE contra el fondo (no desaparece)', standby > bg + 60, 'borde=' + standby.toFixed(0) + ' vs fondo=' + bg);

  // el clip NO se deseleccionó por cambiar de panel: sólo cambió quién manda
  ok('cambiar de panel NO deselecciona', state.selIds.includes(c.id), 'selIds=' + JSON.stringify(state.selIds));

  // el header de pista respeta el mismo contrato
  state.selLane = 0; renderTimeline(); await w();
  down(document.getElementById('tracks')); await w();
  const lh = document.querySelector('.lanehdr.sel');
  if (lh) {
    const f2 = getComputedStyle(lh).boxShadow;
    down(mp); await w();
    const s2 = getComputedStyle(document.querySelector('.lanehdr.sel')).boxShadow;
    ok('el header de pista también tiene dos niveles', f2 !== s2, 'distintos');
  }
  // vuelve el foco a la línea de tiempo para no dejar el estado raro
  down(document.getElementById('tracks'));
  return out.join('\n');
})()

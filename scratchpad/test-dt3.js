/* [R102·D-T2b/D-T3] Tres reglas: (1) un valor arrastrable se lee como CAMPO, no como botón; (2) el estado
   nunca lo lleva sólo el color; (3) el editor de curvas invierte la polaridad respecto al campo del timeline. */
(async () => {
  const out = []; const ok = (n, c, d) => out.push((c ? 'ok   ' : 'FAIL ') + n + (d ? '  → ' + d : ''));
  const cs = getComputedStyle(document.documentElement), g = n => cs.getPropertyValue(n).trim();
  const hex = h => { h = String(h).replace('#', ''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); };
  const rgb = s => { const m = String(s).match(/(\d+),\s*(\d+),\s*(\d+)/); return m ? [+m[1], +m[2], +m[3]] : null; };
  const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const Y = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const L = c => { const y = Y(c); return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y; };

  // 1. El campo de valor arrastrable debe ser MÁS OSCURO que el panel (campo), no más claro (botón).
  //    Antes era s2 = idéntico a un botón: mismo aspecto, comportamiento distinto.
  const box = document.querySelector('.prow .box');
  if (box) {
    const bg = rgb(getComputedStyle(box).backgroundColor);
    const s1 = L(hex(g('--s1'))), s2 = L(hex(g('--s2')));
    ok('el valor arrastrable se lee como CAMPO (más oscuro que el panel), no como botón',
       bg && L(bg) < s1, 'box L*=' + (bg ? L(bg).toFixed(1) : '?') + '  panel s1=' + s1.toFixed(1) + '  botón s2=' + s2.toFixed(1));
    const cur = getComputedStyle(box.closest('.field') || box).cursor;
    ok('y anuncia el gesto con el cursor', /resize/.test(cur), cur);
  } else out.push('--   (no había .prow .box a mano — abre el inspector con un clip)');

  // 2. Estado nunca sólo por color: el clip deshabilitado necesita una TRAMA (forma), no sólo opacidad.
  const anyClip = document.querySelector('.clip');
  if (anyClip) {
    const c = clipById(+anyClip.dataset.clip);
    if (c) {
      c.disabled = true; renderTimeline(); await new Promise(r => setTimeout(r, 80));
      const el = document.querySelector('.clip.off');
      ok('el clip deshabilitado recibe la clase .off', !!el);
      if (el) {
        const after = getComputedStyle(el, '::after');
        ok('...y lleva trama diagonal (forma, no sólo color)', /gradient/.test(after.backgroundImage), after.backgroundImage.slice(0, 46));
        ok('...además de atenuarse', parseFloat(getComputedStyle(el).opacity) < 0.6, getComputedStyle(el).opacity);
      }
      c.disabled = false; renderTimeline();
    }
  }

  // 3. Polaridad invertida: la banda de automatización debe ser MÁS CLARA que el campo del timeline.
  const al = document.querySelector('.autolane');
  const tl = document.querySelector('#tracks');
  if (al) {
    const a = rgb(getComputedStyle(al).backgroundColor), t = rgb(getComputedStyle(tl).backgroundColor) || hex(g('--s0'));
    ok('la banda de curvas es MÁS CLARA que el campo del timeline', a && L(a) > L(t) + 2,
       'autolane L*=' + (a ? L(a).toFixed(1) : '?') + '  timeline L*=' + L(t).toFixed(1));
  } else out.push('--   (no había .autolane a mano — activa el modo automatización)');
  return out.join('\n');
})()

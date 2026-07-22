/* [R102·D-T2] ¿Tenemos el problema que resuelven los tiers de Resolve? Su regla: "The number of clips is
   listed, BUT ONLY IF the track is tall enough". O sea: el contenido de la cabecera es función de su altura,
   con tiers explícitos (Micro/Mini/Medium/Large/XL) en vez de recortar un único layout.
   Antes de inventar tiers hay que saber si algo se recorta de verdad. Alturas: collapsed 20 · min 34 · def 82. */
(async () => {
  const out = []; const w = () => new Promise(r => setTimeout(r, 90));
  const ok = (n, c, d) => out.push((c ? 'ok   ' : 'FAIL ') + n + (d ? '  → ' + d : ''));
  const clipped = () => {
    const bad = [];
    for (const h of document.querySelectorAll('#laneHeaders .lanehdr, #audioHeadZone .lanehdr')) {
      for (const el of h.querySelectorAll('*')) {
        const r = el.getBoundingClientRect(); if (r.width <= 0) continue;
        const hr = h.getBoundingClientRect();
        if (r.bottom > hr.bottom + 1 || r.top < hr.top - 1) bad.push((el.className || el.tagName) + ' se sale');
        if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).textOverflow !== 'ellipsis' && el.clientWidth > 0)
          bad.push((el.className || el.tagName) + ' desborda a lo ancho');
      }
    }
    return [...new Set(bad)];
  };
  const sizes = [];
  for (const [name, apply] of [
    ['colapsada (20px)', () => { state.lanes[0].collapsed = true; }],
    ['mínima (34px)', () => { state.lanes[0].collapsed = false; state.lanes[0].h = 34; }],
    ['por defecto (82px)', () => { state.lanes[0].h = 82; }],
    ['máxima (260px)', () => { state.lanes[0].h = 260; }],
  ]) {
    apply(); renderTimeline(); await w();
    // OJO: los headers se pintan en orden INVERSO (V6 arriba), asi que [0] NO es la pista 0.
    // La primera version muto la pista 0 y midio la de V6 -> daba 82px en los cuatro casos.
    const hdr = document.querySelector('#laneHeaders .lanehdr[data-lane="0"]');
    const c = clipped();
    const contentH = hdr ? [...hdr.children].reduce((s, e) => Math.max(s, e.getBoundingClientRect().height), 0) : 0;
    sizes.push({ name, altura: hdr ? Math.round(hdr.getBoundingClientRect().height) : 0, contenido: Math.round(contentH) });
    ok('sin recortes a altura ' + name, c.length === 0, c.join(' | ') || 'limpio');
  }
  state.lanes[0].collapsed = false; state.lanes[0].h = 82; renderTimeline();
  out.push('--   altura de cabecera vs alto real del contenido:');
  for (const s of sizes) out.push('     ' + s.name.padEnd(20) + 'cabecera=' + String(s.altura).padStart(3) + 'px   contenido=' + String(s.contenido).padStart(3) + 'px   sobra=' + String(s.altura - s.contenido).padStart(3) + 'px');
  return out.join('\n');
})()

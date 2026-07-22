/* [R102·D-T3] Dianas. La norma NO es 44×44: eso es WCAG AAA (SC 2.5.5) y además es guía TÁCTIL (una yema mide
   ~10mm; el punto caliente de un cursor es 1px). La norma AA es SC 2.5.8 = 24×24 CSS px, CON una excepción de
   espaciado textual: un control menor cumple si un círculo de 24px centrado en su caja no interseca el de otro
   — es decir, **≥24px de centro a centro**. Así se construye una herramienta densa, y lo dice el W3C.
   Blender envía 20px en toda la app con paso de 22px. Fitts: los layouts densos reducen la DISTANCIA más
   rápido de lo que reducen el TAMAÑO — inflar todo a 44px es contraproducente. */
(() => {
  const out = []; const ok = (n, c, d) => out.push((c ? 'ok   ' : 'FAIL ') + n + (d ? '  → ' + d : ''));
  /* Un rectángulo NO es una diana. Los controles que quedan detrás del módulo de audio fijado siguen teniendo
     getBoundingClientRect, y la primera versión de este test los comparaba: daba "8px de paso" entre botones
     que nadie puede pulsar porque están tapados. Medido a mano, M y S están a 21px. Así que sólo cuenta lo que
     de verdad recibe el clic: hit-test en el centro. */
  const hittable = el => {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0 || getComputedStyle(el).visibility === 'hidden') return false;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) return false;
    const top = document.elementFromPoint(cx, cy);
    return !!top && (top === el || el.contains(top) || top.contains(el));
  };
  const targets = [...document.querySelectorAll('button,[role="button"],input[type="checkbox"],select,.ms,.abt,.lcol')].filter(hittable);

  const hs = [...new Set(targets.map(t => Math.round(t.getBoundingClientRect().height)))].sort((a, b) => a - b);
  out.push('--   alturas de control en uso: ' + hs.join(', '));

  // pares que se solapan en Y (misma fila) y son adyacentes en X -> mide paso centro-a-centro
  const bad = [];
  for (let i = 0; i < targets.length; i++) {
    const a = targets[i].getBoundingClientRect();
    if (Math.min(a.width, a.height) >= 24) continue;          // ya cumple por tamaño
    let nearest = null;
    for (let j = 0; j < targets.length; j++) {
      if (i === j) continue;
      const b = targets[j].getBoundingClientRect();
      const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      if (overlapY <= 0 && overlapX <= 0) continue;            // ni misma fila ni misma columna
      const d = Math.hypot((a.left + a.width / 2) - (b.left + b.width / 2), (a.top + a.height / 2) - (b.top + b.height / 2));
      if (!nearest || d < nearest.d) nearest = { d, el: targets[j] };
    }
    if (nearest && nearest.d < 24) {
      const id = targets[i].id || String(targets[i].className).split(' ')[0] || targets[i].tagName;
      bad.push(id + ' ' + Math.round(a.width) + '×' + Math.round(a.height) + ' paso=' + nearest.d.toFixed(1) + 'px');
    }
  }
  const uniq = [...new Set(bad)];
  ok('todo control <24px tiene ≥24px de centro a centro (SC 2.5.8 AA)', uniq.length === 0,
     uniq.length ? uniq.length + ' incumplen: ' + uniq.slice(0, 8).join(' | ') : targets.length + ' dianas revisadas');

  // controles anclados al borde: margen exterior 0 (el borde tiene anchura infinita — Farris et al. 2001:
  // los objetivos al borde se adquieren más rápido que a 1px hacia dentro)
  const edge = [];
  for (const t of targets) {
    const r = t.getBoundingClientRect();
    const dL = r.left, dR = innerWidth - r.right, dB = innerHeight - r.bottom, dT = r.top;
    for (const [n, d] of [['izq', dL], ['der', dR], ['abajo', dB], ['arriba', dT]])
      if (d > 0 && d <= 3) edge.push((t.id || String(t.className).split(' ')[0]) + ' a ' + d.toFixed(0) + 'px del borde ' + n);
  }
  const ue = [...new Set(edge)];
  out.push((ue.length ? '--   ' : 'ok   ') + 'controles casi-pegados al borde (deberían estar a 0 para ganar anchura infinita)' +
    (ue.length ? '  → ' + ue.slice(0, 5).join(' | ') : ''));
  return out.join('\n');
})()

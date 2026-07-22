/* [R102·D-T1] Aserciones del sistema de diseño. Existen porque colapsar --surface-3 sobre s2 dejó el hover
   IDÉNTICO al botón en reposo y las comprobaciones de tokens/tamaños/desbordes no lo vieron: todas pasaban.
   Un estado que no se distingue de su reposo es un control que miente. */
(() => {
  const out = []; const ok = (n, c, d) => out.push((c ? 'ok   ' : 'FAIL ') + n + (d ? '  → ' + d : ''));
  const cs = getComputedStyle(document.documentElement), g = n => cs.getPropertyValue(n).trim();
  const hex = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); };
  const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const Y = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const L = h => { const y = Y(hex(h)); return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y; };

  // 1. tokens presentes (un typo daría canvas transparente en silencio)
  const need = ['--s0','--s1','--s2','--state-on','--state-hover','--ink','--ink-2','--ink-3','--ink-dim','--line','--line-soft','--line-strong','--auto-live','--auto-ovr'];
  const missing = need.filter(t => !g(t));
  ok('todos los tokens resuelven', !missing.length, missing.join(',') || need.length + ' tokens');

  // 2. las 3 superficies separadas por 4-5 L* (Spectrum envía ΔL* 2.8-4.9; medir en L*, NO en contraste)
  const d1 = L(g('--s1')) - L(g('--s0')), d2 = L(g('--s2')) - L(g('--s1'));
  ok('paso s0→s1 entre 3 y 6 L*', d1 >= 3 && d1 <= 6, 'ΔL*=' + d1.toFixed(1));
  ok('paso s1→s2 entre 3 y 6 L*', d2 >= 3 && d2 <= 6, 'ΔL*=' + d2.toFixed(1));

  // 3. LA QUE FALTABA: ningún estado puede verse igual que su reposo
  const pairs = [['--surface-2 (botón)', '--surface-3 (hover)'], ['--s2 (botón)', '--state-hover'], ['--s2 (botón)', '--state-on']];
  for (const [a, b] of pairs) {
    const ca = g(a.split(' ')[0]), cb = g(b.split(' ')[0]);
    const dL = Math.abs(L(ca) - L(cb));
    ok('estado distinguible: ' + a + ' vs ' + b, dL >= 2.5, ca + ' vs ' + cb + '  ΔL*=' + dL.toFixed(1));
  }

  // 4. la affordance es la DIRECCIÓN del contraste (Blender): botón MÁS CLARO que el panel, campo MÁS OSCURO
  ok('botón (s2) más claro que el panel (s1)', L(g('--s2')) > L(g('--s1')), 'L* ' + L(g('--s2')).toFixed(1) + ' > ' + L(g('--s1')).toFixed(1));
  ok('campo editable (s0) más oscuro que el panel (s1)', L(g('--s0')) < L(g('--s1')), 'L* ' + L(g('--s0')).toFixed(1) + ' < ' + L(g('--s1')).toFixed(1));

  // 5. hover REAL en el DOM, no solo en los tokens
  const btn = document.querySelector('.ibtn') || document.querySelector('button');
  if (btn) {
    const rest = getComputedStyle(btn).backgroundColor;
    const rule = [...document.styleSheets].flatMap(s => { try { return [...s.cssRules]; } catch (e) { return []; } })
      .filter(r => r.selectorText && /\.ibtn:hover/.test(r.selectorText));
    ok('existe una regla :hover para .ibtn', rule.length > 0, rule.length + ' reglas; reposo=' + rest);
  }

  // 6. escala tipográfica cerrada: nada fuera de {11,13,16,20}
  const allowed = new Set(['11px', '13px', '16px', '20px']);
  const bad = {};
  for (const el of document.querySelectorAll('*')) {
    if (!el.firstChild || el.firstChild.nodeType !== 3 || !el.textContent.trim()) continue;
    if (el.getBoundingClientRect().width <= 0) continue;
    const s = getComputedStyle(el).fontSize;
    if (!allowed.has(s)) bad[s] = (bad[s] || 0) + 1;
  }
  ok('ningún tamaño fuera de {11,13,16,20}', !Object.keys(bad).length, Object.entries(bad).map(x => x.join('×')).join(' ') || 'limpio');

  // 7. 9px erradicado (nadie lo envía; Geist a 9px da x-height 4.77px, bajo el suelo de renderizado)
  let nine = 0;
  for (const el of document.querySelectorAll('*')) { const s = getComputedStyle(el).fontSize; if (parseFloat(s) < 11) nine++; }
  ok('ningún texto por debajo de 11px', nine === 0, nine + ' elementos');

  // 8. paleta de espaciado CERRADA. El mecanismo de Spectrum/Primer/Atlassian no es "redondear a 4": es que
  //    la paleta NO tiene escotilla. Sin esta aserción, el siguiente `gap:7px` entra sin que nadie lo note —
  //    que es exactamente como llegamos a tener 11 valores distintos.
  const PAL = new Set(['2px', '4px', '6px', '8px', '12px', '16px', '20px', '24px', '32px']);
  const gaps = {};
  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect(); if (r.width <= 0) continue;
    const c2 = getComputedStyle(el);
    if (!/flex|grid/.test(c2.display)) continue;
    for (const g2 of [c2.rowGap, c2.columnGap]) {
      if (!g2 || g2 === 'normal' || g2 === '0px') continue;
      if (!PAL.has(g2)) gaps[g2] = (gaps[g2] || 0) + 1;
    }
  }
  ok('ningún espaciado fuera de la paleta cerrada', !Object.keys(gaps).length,
     Object.entries(gaps).map(x => x.join('×')).join(' ') || 'limpio');

  // 9. nada de texto recortado por subir 9→11px
  let clip = 0;
  for (const el of document.querySelectorAll('*')) {
    if (!el.firstChild || el.firstChild.nodeType !== 3 || !el.textContent.trim()) continue;
    const c2 = getComputedStyle(el), h = el.clientHeight; if (!h) continue;
    if (el.scrollHeight > h + 1 && c2.overflowY !== 'auto' && c2.overflowY !== 'scroll') clip++;
  }
  ok('ningún texto recortado verticalmente', clip === 0, clip + ' elementos');

  return out.join('\n');
})()

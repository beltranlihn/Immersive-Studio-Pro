/* [R102·D-T4] La Info View sirve para algo solo si cumple tres cosas: es instantánea, NO tapa, y cuando el
   control está bloqueado dice POR QUÉ. Si falla cualquiera de las tres, es un tooltip peor colocado. */
(async () => {
  const out = []; const ok = (n, c, d) => out.push((c ? 'ok   ' : 'FAIL ') + n + (d ? '  → ' + d : ''));
  const bar = document.getElementById('statInfo');
  ok('existe la barra Info', !!bar);
  if (!bar) return out.join('\n');
  const hov = el => el.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
  const w = () => new Promise(r => setTimeout(r, 50));

  // 1. instantánea: el tooltip flotante tarda 1s; la barra no puede esperar
  const any = document.querySelector('[data-tip],[title]');
  bar.textContent = ''; hov(any); await w();
  ok('instantánea (sin esperar al tooltip de 1s)', bar.textContent.length > 0, JSON.stringify(bar.textContent.slice(0, 44)));

  // 2. nombre y atajo separados: "Select (V)" no debe leerse como una frase
  const sel = [...document.querySelectorAll('[title],[data-tip]')]
    .find(e => /\((?:V|B|T|H|Z)\)/.test(e.getAttribute('title') || e.getAttribute('data-tip') || ''));
  if (sel) { hov(sel); await w();
    ok('separa nombre y atajo', !!bar.querySelector('.k') && !!bar.querySelector('.sc'),
       JSON.stringify(bar.textContent) + '  atajo=' + (bar.querySelector('.sc') || {}).textContent); }
  else out.push('--   (ningún control con atajo entre paréntesis a mano)');

  // 3. nombre + descripción larga: debe partir por el guión
  const long = [...document.querySelectorAll('[title],[data-tip]')]
    .find(e => ((e.getAttribute('title') || e.getAttribute('data-tip') || '').length > 40));
  if (long) { hov(long); await w();
    ok('nombre destacado + descripción', !!bar.querySelector('.k'), JSON.stringify(bar.textContent.slice(0, 70))); }

  // 4. LA CLAVE: no tapa nada. Un tooltip flotante sobre una timeline oculta justo lo que miras.
  const r1 = bar.getBoundingClientRect();
  const vp = document.getElementById('glc') || document.querySelector('canvas');
  const tl = document.getElementById('tlscroll');
  ok('no solapa el viewport', !vp || r1.top >= vp.getBoundingClientRect().bottom - 1,
     vp ? 'info.top=' + Math.round(r1.top) + '  viewport.bottom=' + Math.round(vp.getBoundingClientRect().bottom) : 'sin canvas');
  ok('no solapa la línea de tiempo', !tl || r1.top >= tl.getBoundingClientRect().bottom - 1,
     tl ? 'info.top=' + Math.round(r1.top) + '  timeline.bottom=' + Math.round(tl.getBoundingClientRect().bottom) : 'sin timeline');

  // 5. bloqueado CON motivo → ámbar + el motivo (única superficie donde el usuario mira cuando quiere aprender)
  const why = [...document.querySelectorAll('[data-why]')][0];
  if (why) { hov(why); await w();
    ok('bloqueado con motivo: ámbar + el motivo', bar.classList.contains('why') && bar.textContent === why.dataset.why,
       JSON.stringify(bar.textContent.slice(0, 64))); }
  else out.push('--   (ningún control con data-why a mano)');

  // 6. bloqueado SIN motivo → NUNCA ámbar. Antes pintaba la etiqueta normal en ámbar ("Previous locator · ,"),
  //    afirmando una causa que nadie le había dado.
  const disNoWhy = [...document.querySelectorAll('.dis,[aria-disabled="true"]')]
    .find(e => !e.dataset.why && (e.getAttribute('title') || e.getAttribute('data-tip')));
  if (disNoWhy) { hov(disNoWhy); await w();
    ok('bloqueado sin motivo NO finge una causa', !bar.classList.contains('why'), JSON.stringify(bar.textContent.slice(0, 48))); }

  // 6. se limpia al salir (si no, miente sobre lo que hay bajo el puntero)
  document.dispatchEvent(new PointerEvent('pointerout', { bubbles: true }));
  await w();
  ok('se limpia al salir', bar.textContent === '', JSON.stringify(bar.textContent));

  return out.join('\n');
})()

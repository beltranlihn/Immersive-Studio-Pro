/* [R105] Motivos de deshabilitado. El mecanismo existía desde R102·D-T4 y sólo lo usaba 1 control.
   Lo que hay que verificar no es "hay texto": es que (a) el motivo llegue a la Info View EN ÁMBAR, y
   (b) al habilitarse, el botón recupere su etiqueta normal y DEJE de estar en ámbar (si data-why se queda
   pegado, el control mentiría diciendo que está bloqueado cuando ya funciona). */
(async () => {
  const out = []; const w = (n = 120) => new Promise(r => setTimeout(r, n));
  const ok = (n, c, d) => out.push((c ? 'ok   ' : 'FAIL ') + n + (d ? '  → ' + d : ''));
  const bar = document.getElementById('statInfo');
  const hov = el => el.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));

  // proyecto vacío: sin clips, sin medios, sin localizadores → todo bloqueado
  state.clips = []; state.media = []; state.markers = [];
  updEnable(); await w();

  const casos = [['#prevMk', 'localizador anterior'], ['#nextMk', 'localizador siguiente'],
                 ['#exportBtn', 'exportar'], ['#ringBtn', 'composición'], ['#adjLayerBtn', 'capa de ajuste']];
  let conMotivo = 0;
  for (const [sel, nombre] of casos) {
    const el = document.querySelector(sel); if (!el) { out.push('--   no existe ' + sel); continue; }
    const why = el.dataset.why;
    if (why) conMotivo++;
    ok(nombre + ' bloqueado explica el motivo', !!why, why || 'SIN MOTIVO');
  }
  ok('los ' + casos.length + ' controles bloqueados tienen motivo', conMotivo === casos.length, conMotivo + '/' + casos.length);

  // el motivo llega a la Info View EN ÁMBAR
  const ex = document.querySelector('#exportBtn');
  hov(ex); await w();
  ok('el motivo se pinta en la barra, en ámbar', bar.classList.contains('why') && bar.textContent === ex.dataset.why,
     JSON.stringify(bar.textContent.slice(0, 50)) + ' ámbar=' + bar.classList.contains('why'));

  // y el motivo ENSEÑA: el de localizadores lleva su atajo
  const pm = document.querySelector('#prevMk');
  ok('el motivo enseña el atajo que falta', /\bM\b/.test(pm.dataset.why || ''), pm.dataset.why);

  // al habilitarse: recupera etiqueta normal y NO se queda pegado en ámbar
  state.markers = [{ id: uid(), time: 1, color: '#B8B8B8' }];
  state.clips = [{ id: uid(), mediaId: 0, lane: 0, start: 0, dur: 4, inP: 0, name: 'x', props: {} }];
  updEnable(); await w();
  ok('habilitado: se borra data-why', !document.querySelector('#prevMk').dataset.why && !document.querySelector('#exportBtn').dataset.why,
     'prevMk=' + document.querySelector('#prevMk').dataset.why + ' export=' + document.querySelector('#exportBtn').dataset.why);
  const pm2 = document.querySelector('#prevMk');
  hov(pm2); await w();
  ok('habilitado: la barra ya NO va en ámbar', !bar.classList.contains('why'), JSON.stringify(bar.textContent.slice(0, 40)));
  ok('habilitado: recupera su etiqueta normal', /Previous locator|Localizador anterior/.test(pm2.getAttribute('title') || pm2.getAttribute('data-tip') || ''),
     (pm2.getAttribute('title') || pm2.getAttribute('data-tip') || '').slice(0, 40));

  state.clips = []; state.markers = []; updEnable();
  return out.join('\n');
})()

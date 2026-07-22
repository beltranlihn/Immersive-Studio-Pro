/* [R102·rev] Los 5 hallazgos de la revisión de código. Existen porque las 55 aserciones anteriores
   verificaban que lo construido hacía lo prometido, pero NINGUNA preguntaba "¿y si lo abre dos veces?".
   Eso sólo lo encuentra una lectura adversarial — y estos tests la fijan. */
(async () => {
  const out = []; const ok = (n, c, d) => out.push((c ? 'ok   ' : 'FAIL ') + n + (d ? '  → ' + d : ''));
  const w = (n = 320) => new Promise(r => setTimeout(r, n));

  // ── F1: abrir el export dos veces dejaba el diálogo VISIBLE sin handlers
  document.querySelectorAll('#exOv').forEach(o => o.remove());
  openExport(); await w();
  openExport(); await w();                       // Ctrl+Shift+E llega aunque el overlay esté delante
  const n = document.querySelectorAll('#exOv').length;
  ok('F1 abrir el export dos veces NO duplica el modal', n === 1, n + ' overlay(s)');
  const go = document.querySelector('#exOv #exGo');
  ok('F1 el botón Export del modal visible SÍ tiene handler', !!go && typeof go.onclick === 'function',
     go ? 'onclick=' + typeof go.onclick : 'sin botón');

  // ── F4: la preferencia de export sobrevive al reinicio (no sólo a la sesión)
  const cod = document.querySelector('#exCodec');
  if (cod && cod.options.length > 1) {
    const other = [...cod.options].find(o => o.value !== cod.value).value;
    cod.value = other; cod.dispatchEvent(new Event('change', { bubbles: true })); await w(60);
    let stored = null; try { stored = JSON.parse(localStorage.getItem('dspLastExport')); } catch (_) {}
    ok('F4 la elección de export se persiste en disco', !!stored && stored.codec === other,
       'localStorage.codec=' + (stored && stored.codec) + ' esperado=' + other);
    // simula reinicio: la memoria se vacía, localStorage no
    state.lastExport = null;
    const back = lastExportGet();
    ok('F4 tras un reinicio se recupera', !!back && back.codec === other, 'recuperado=' + (back && back.codec));
  }
  document.querySelectorAll('#exOv').forEach(o => o.remove());

  // ── F2: el parser de tooltips. Las dos convenciones del código + el caso que salía mutilado.
  const bar = document.getElementById('statInfo');
  /* Elemento NUEVO por caso: el sistema de tooltips hace `if(el===curEl)return`, así que reutilizar el mismo
     botón hacía que el 2º hover en adelante se ignorara y todos los casos devolvieran el resultado del 1º.
     (Falso fallo de mi test, no del parser.) */
  const probes = [];
  const show = t => { const p = document.createElement('button'); p.style.cssText = 'position:fixed;left:-999px;';
    p.setAttribute('title', t); document.body.appendChild(p); probes.push(p);
    p.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    return { txt: bar.textContent, name: (bar.querySelector('.k') || {}).textContent, sc: (bar.querySelector('.sc') || {}).textContent }; };

  let r = show('Trim (T) — the cursor picks it: edge = ripple · over a cut = roll');
  ok('F2 "Nombre (ATAJO) — descripción" no se mutila', r.name === 'Trim' && r.sc === 'T' && !/\)/.test(r.txt),
     JSON.stringify(r));
  r = show('Select (V)');
  ok('F2 "Nombre (ATAJO)" sigue funcionando', r.name === 'Select' && r.sc === 'V', JSON.stringify(r));
  r = show('Undo · Ctrl+Z');
  ok('F2 la 2ª convención "Nombre · Ctrl+Z" ahora se entiende', r.name === 'Undo' && r.sc === 'Ctrl+Z', JSON.stringify(r));
  r = show('Create an adjustment layer — its Reactive FX affect everything below it');
  ok('F2 "Nombre — descripción" sin atajo', r.name === 'Create an adjustment layer' && !r.sc, JSON.stringify(r).slice(0, 78));
  r = show('Drag moves · click removes · Alt+drag curves both sides');
  ok('F2 un tooltip sin nombre/atajo no se rompe', r.name === 'Drag moves · click removes · Alt+drag curves both sides', JSON.stringify(r).slice(0, 70));
  probes.forEach(p=>p.remove());

  // ── F3: laneTint muerto, borrado
  ok('F3 laneTint ya no existe', typeof laneTint === 'undefined', typeof laneTint);

  // ── F5: la paleta del canvas se puede refrescar si :root cambia en runtime
  ok('F5 existe refreshUI()', typeof refreshUI === 'function', typeof refreshUI);
  const prev = UI.s0;
  document.documentElement.style.setProperty('--s0', '#ABCDEF');
  refreshUI();
  const changed = UI.s0.toUpperCase() === '#ABCDEF';
  document.documentElement.style.removeProperty('--s0'); refreshUI();
  ok('F5 refreshUI() re-lee :root y el canvas seguiría al tema', changed, prev + ' → #ABCDEF → ' + UI.s0);
  ok('F5 y vuelve al valor original al revertir', UI.s0 === prev, UI.s0);
  return out.join('\n');
})()

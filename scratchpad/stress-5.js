/* [R103] Fall-through de modificadores en los atajos de herramienta.
   `if(e.key==='b'||e.key==='B')setTool('razor')` no mira modificadores — el propio comentario del código lo
   admite ("the bare-B razor below, which ignores modifiers"). Consecuencia: cualquier Shift+letra o Ctrl+letra
   que no tenga handler propio ARMA UNA HERRAMIENTA en silencio. Con el razor, el siguiente clic CORTA.
   Se prueba la matriz completa: cada letra de herramienta × sin modificador / Shift / Ctrl / Ctrl+Shift. */
(async () => {
  const out = []; const w = () => new Promise(r => setTimeout(r, 45));
  const key = (k, o = {}) => window.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true, cancelable: true }, o)));
  const letras = ['v', 'h', 'b', 'z', 'c', 't'];
  const mods = [
    ['—', {}],
    ['Shift', { shiftKey: true }],
    ['Ctrl', { ctrlKey: true }],
    ['Ctrl+Shift', { ctrlKey: true, shiftKey: true }],
  ];
  state.autoSel = null;                       // sin selección de keyframes: es el caso que destapa el fall-through
  const filas = [];
  for (const l of letras) {
    const fila = { tecla: l.toUpperCase() };
    for (const [nm, o] of mods) {
      state.tl.tool = 'select'; applyToolCursor(); await w();
      const antes = state.tl.tool;
      // Shift produce la MAYÚSCULA en e.key, igual que un teclado real
      key(o.shiftKey ? l.toUpperCase() : l, o); await w();
      fila[nm] = (state.tl.tool !== antes) ? state.tl.tool : '·';
    }
    filas.push(fila);
  }
  state.tl.tool = 'select'; applyToolCursor();
  out.push('herramienta armada por cada combinación (· = no hace nada):');
  out.push('  tecla   sin mod      Shift        Ctrl         Ctrl+Shift');
  for (const f of filas)
    out.push('  ' + f.tecla.padEnd(7) + String(f['—']).padEnd(12) + String(f.Shift).padEnd(12) + String(f.Ctrl).padEnd(12) + String(f['Ctrl+Shift']));
  const malas = [];
  for (const f of filas) for (const nm of ['Shift', 'Ctrl', 'Ctrl+Shift'])
    if (f[nm] !== '·') malas.push(nm + '+' + f.tecla + '→' + f[nm]);
  out.push('');
  out.push((malas.length ? 'FAIL ' : 'ok   ') + 'ningún modificador arma una herramienta por accidente' +
           (malas.length ? '  → ' + malas.length + ' casos: ' + malas.join(' · ') : ''));
  out.push('--   el peligroso es el razor: se arma sin aviso y el siguiente clic corta un clip.');
  return out.join('\n');
})()

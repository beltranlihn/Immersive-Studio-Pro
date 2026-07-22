/* [R103] ¿Los hallazgos de stress-1/2 son ALCANZABLES por un usuario, o sólo llamando a las funciones a mano?
   El manejador global tiene `if(document.querySelector('.overlay'))return;` ANTES de los atajos. Mis tests
   llamaban openExport()/openPrefs() directamente y se saltaban esa guarda. Esto lo prueba con teclas REALES,
   por el mismo camino que el usuario. Si la guarda funciona, mi informe exageró y hay que decirlo. */
(async () => {
  const out = []; const w = (n = 260) => new Promise(r => setTimeout(r, n));
  const ok = (n, c, d) => out.push((c ? 'ok   ' : 'FAIL ') + n + (d ? '  → ' + d : ''));
  const clean = () => document.querySelectorAll('.overlay,.menu').forEach(o => o.remove());
  // tecla REAL sobre window, que es donde escucha la app
  const key = (k, o = {}) => window.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true, cancelable: true }, o)));

  // ── 1. ¿Ctrl+Shift+E dos veces abre dos exports? (por teclado, como un editor)
  clean(); await w(80);
  key('e', { ctrlKey: true, shiftKey: true }); await w();
  const n1 = document.querySelectorAll('.overlay').length;
  out.push('--   overlays tras el 1er Ctrl+Shift+E: ' + n1 + (n1 ? '  (activeElement=' + (document.activeElement.id || document.activeElement.tagName) + ')' : ''));
  key('e', { ctrlKey: true, shiftKey: true }); await w();
  const n2 = document.querySelectorAll('.overlay').length;
  ok('1 Ctrl+Shift+E x2 por TECLADO no duplica el export', n2 <= 1, n1 + ' → ' + n2 + ' overlays');
  out.push('--   (si aquí sale 1→1, la guarda global ya lo impedía y mi F1 no era alcanzable por teclado)');
  clean(); await w(80);

  // ── 2. ¿Ctrl+, dos veces abre dos preferencias?
  key(',', { ctrlKey: true }); await w();
  const p1 = document.querySelectorAll('.overlay').length;
  key(',', { ctrlKey: true }); await w();
  const p2 = document.querySelectorAll('.overlay').length;
  ok('2 Ctrl+, x2 por TECLADO no duplica preferencias', p2 <= 1, p1 + ' → ' + p2 + ' overlays');
  clean(); await w(80);

  // ── 3. ¿Ctrl+K y luego Ctrl+Shift+E apilan paleta + export?
  key('k', { ctrlKey: true }); await w();
  const k1 = document.querySelectorAll('.overlay').length;
  const foco1 = document.activeElement.id || document.activeElement.tagName;
  key('e', { ctrlKey: true, shiftKey: true }); await w();
  const k2 = document.querySelectorAll('.overlay').length;
  ok('3 con la paleta abierta, Ctrl+Shift+E NO abre el export encima', k2 <= k1, k1 + ' → ' + k2 + ' overlays  (foco tras Ctrl+K: ' + foco1 + ')');
  clean(); await w(80);

  // ── 4. Y la pregunta de fondo: ¿la guarda depende del FOCO o del overlay?
  //     Si el foco está en un <input> del modal, el handler sale por la 1ª guarda (tag==='input').
  //     Si NO hay input enfocado, tiene que salvarlo la guarda del overlay. Se fuerza ese caso.
  key(',', { ctrlKey: true }); await w();
  const ov = document.querySelector('.overlay');
  if (ov) {
    document.body.focus();                                   // saca el foco de cualquier input del modal
    const tag = (document.activeElement.tagName || '').toLowerCase();
    out.push('--   foco forzado fuera del modal: activeElement=' + tag);
    const antes = document.querySelectorAll('.overlay').length;
    key(',', { ctrlKey: true }); await w();
    const desp = document.querySelectorAll('.overlay').length;
    ok('4 con el foco FUERA de un input, la guarda del overlay aguanta', desp <= antes, antes + ' → ' + desp);
    // y un atajo de timeline no debe tocar el proyecto con un modal delante
    const nClips = state.clips.length;
    key('Delete'); await w(80);
    ok('4 Suprimir con un modal abierto no borra clips', state.clips.length === nClips, nClips + ' → ' + state.clips.length);
  }
  clean();
  return out.join('\n');
})()

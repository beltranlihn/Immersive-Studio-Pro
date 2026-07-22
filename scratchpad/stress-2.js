/* [R103] ¿Los dos hallazgos de stress-1 son cosméticos o rompen algo? */
(async () => {
  const out = []; const w = (n = 250) => new Promise(r => setTimeout(r, n));
  const ok = (n, c, d) => out.push((c ? 'ok   ' : 'FAIL ') + n + (d ? '  → ' + d : ''));
  const clean = () => document.querySelectorAll('.overlay,.menu').forEach(o => o.remove());

  // ── A. Preferencias x2: ¿el modal VISIBLE queda sin handlers, como pasaba con el export?
  clean(); openPrefs(); await w(); openPrefs(); await w();
  const ovs = [...document.querySelectorAll('.overlay')];
  out.push('--   overlays de preferencias tras 2 aperturas: ' + ovs.length);
  if (ovs.length > 1) {
    const visible = ovs[ovs.length - 1];               // el de arriba es el que ve el usuario
    // busca cualquier botón con id dentro y comprueba a cuál apunta $()
    const withId = [...visible.querySelectorAll('[id]')].filter(e => e.id)[0];
    if (withId) {
      const wired = document.getElementById(withId.id);
      ok('A el cableado apunta al modal VISIBLE (no al viejo)', wired === withId,
         'id=' + withId.id + ' → ' + (wired === withId ? 'visible' : 'AL VIEJO/OCULTO'));
    }
    const btns = [...visible.querySelectorAll('button')];
    const dead = btns.filter(b => !b.onclick && !b.getAttribute('onclick'));
    ok('A los botones del modal visible tienen handler', dead.length < btns.length,
       (btns.length - dead.length) + '/' + btns.length + ' con handler');
  }
  clean();

  // ── B. Apilar dos diálogos DISTINTOS: paleta + export.
  //     Lo grave no sería el apilado, sino que el de abajo siga capturando el teclado:
  //     escribir un nombre de fichero en el export no puede navegar la paleta.
  clean(); openPalette(); await w();
  const palInput = document.querySelector('.overlay input');
  openExport(); await w();
  const nOv = document.querySelectorAll('.overlay').length;
  out.push('--   overlays con paleta + export: ' + nOv);
  if (nOv > 1) {
    const palStill = !!(palInput && palInput.isConnected);
    ok('B la paleta se cierra al abrir el export', !palStill, palStill ? 'SIGUE VIVA debajo' : 'cerrada');
    if (palStill) {
      // ¿el foco/el teclado se lo queda la paleta que está DEBAJO?
      const active = document.activeElement;
      const focusEnPaleta = !!(palInput && active === palInput);
      ok('B el foco NO se queda en la paleta oculta', !focusEnPaleta,
         'activeElement=' + (active ? (active.id || active.className || active.tagName) : 'null'));
      // simula escribir: ¿la paleta reacciona a teclas mientras el export está delante?
      const before = palInput.value;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
      await w(60);
      ok('B teclear con el export delante no alimenta la paleta oculta', palInput.value === before,
         'valor paleta: "' + before + '" → "' + palInput.value + '"');
    }
  }
  clean();

  // ── C. Escape: ¿cierra sólo el de arriba o los dos? Un editor pulsa Esc por reflejo.
  clean(); openPalette(); await w(); openExport(); await w();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await w();
  const tras = document.querySelectorAll('.overlay').length;
  out.push('--   overlays tras un Escape: ' + tras + ' (empezando desde ' + nOv + ')');
  ok('C Escape deja la app sin modales colgados o cierra de uno en uno', tras < nOv || tras === 0, tras + ' restantes');
  clean();
  return out.join('\n');
})()

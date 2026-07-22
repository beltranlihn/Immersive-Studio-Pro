(async () => {
  const w = () => new Promise(r => setTimeout(r, 350));
  document.querySelectorAll('#exOv').forEach(o => o.remove());
  openExport(); await w();
  const n1 = document.querySelectorAll('#exOv').length;
  // Ctrl+Shift+E llega aunque el overlay este delante: el overlay tapa el raton, no el teclado
  openExport(); await w();
  const n2 = document.querySelectorAll('#exOv').length;
  const ovs = [...document.querySelectorAll('#exOv')];
  let visibleEsElSegundo = null, wiringApuntaAlPrimero = null, botonVisibleMuerto = null;
  if (ovs.length > 1) {
    const last = ovs[ovs.length - 1];
    // el que ve el usuario es el ultimo del DOM (esta encima)
    const r = last.getBoundingClientRect();
    visibleEsElSegundo = r.width > 0;
    // $ = querySelector = PRIMER match -> a que modal apunta el cableado?
    const wired = document.querySelector('#exCodec');
    wiringApuntaAlPrimero = ovs[0].contains(wired);
    // el boton Go del modal VISIBLE, tiene handler?
    const goVisible = last.querySelector('#exGo');
    botonVisibleMuerto = !!goVisible && !goVisible.onclick;
  }
  document.querySelectorAll('#exOv').forEach(o => o.remove());
  return JSON.stringify({ tras1: n1, tras2: n2, visibleEsElSegundo, wiringApuntaAlPrimero, botonExportVisibleSinHandler: botonVisibleMuerto }, null, 1);
})()

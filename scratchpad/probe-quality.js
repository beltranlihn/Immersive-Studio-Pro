/* [R105] ¿El bug de previewQuality que reporté existe de verdad?
   Afirmé: "abrir un proyecto revierte la calidad a Full y el botón sigue marcando ¼".
   Pero setCompSize sólo se llama desde el handler del botón. Antes de "arreglar", comprobar — es justo el
   error que cometí con el doble-export (verifiqué el síntoma, no la alcanzabilidad). */
(async () => {
  const out = []; const w = (n = 300) => new Promise(r => setTimeout(r, n));
  const btnOn = () => { const b = document.querySelector('#qualitySeg button.on'); return b ? b.textContent.trim() : 'ninguno'; };
  const estado = () => 'compSize=' + compSize + ' · previewQuality=' + state.previewQuality + ' · botón=' + btnOn();

  out.push('inicio:            ' + estado());
  // pulsa ¼ como el usuario
  const q = [...document.querySelectorAll('#qualitySeg button')].find(b => b.dataset.q === '0.25');
  if (!q) return 'no hay botón ¼';
  q.click(); await w();
  out.push('tras pulsar ¼:     ' + estado());
  const compTrasClic = compSize;

  // 1) ¿un proyecto NUEVO lo revierte?
  const bak = state.media.slice();
  try { newProject(); } catch (e) { out.push('newProject lanzó: ' + e.message); }
  await w(600);
  out.push('tras newProject:   ' + estado());
  const coherente1 = (compSize === compTrasClic) === (btnOn() === '¼');
  out.push('  → ' + (coherente1 ? 'ok: el botón dice la verdad' : 'FAIL: el botón y el composite NO coinciden'));

  // 2) ¿y cambiar de secuencia / modo?
  const antes = compSize;
  try { state.seqMode = 'flat'; updModeUI(); render(); } catch (_) {}
  await w(300);
  try { state.seqMode = 'dome'; updModeUI(); render(); } catch (_) {}
  await w(300);
  out.push('tras cambiar modo: ' + estado());
  out.push('  → ' + (compSize === antes ? 'ok: no lo pisa' : 'FAIL: el modo revierte el composite'));

  // 3) el hueco REAL que sí sospecho: ¿sobrevive la elección a un reinicio de la app?
  out.push('');
  out.push('¿se persiste la elección?  serProject().tl = ' + JSON.stringify((serProject().tl || {})));
  const enProyecto = JSON.stringify(serProject()).includes('previewQuality');
  let enLocal = null; try { enLocal = localStorage.getItem('dspPreviewQuality'); } catch (_) {}
  out.push('  previewQuality en el .isp: ' + enProyecto + ' · en localStorage: ' + (enLocal !== null));
  out.push('  → ' + (enProyecto || enLocal !== null ? 'sobrevive al reinicio' : 'NO sobrevive: al reabrir la app vuelve a Full'));
  state.media = bak;
  return out.join('\n');
})()

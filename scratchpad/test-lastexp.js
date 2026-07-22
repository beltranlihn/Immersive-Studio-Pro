/* [R102·D-T4] La mitad defendible de "Operate → Adjust": aunque el export SÍ necesita diálogo (ver PLAN.md),
   el diálogo debe abrirse con LO ÚLTIMO QUE USASTE, no con valores de fábrica. Si cada export te obliga a
   reelegir códec y resolución, la herramienta no te está recordando: te está interrogando. */
(async () => {
  const out = []; const ok = (n, c, d) => out.push((c ? 'ok   ' : 'FAIL ') + n + (d ? '  → ' + d : ''));
  const w = () => new Promise(r => setTimeout(r, 400));
  const F = ['exCodec', 'exRes', 'exFps', 'exBitrate'];
  openExport(); await w();
  const first = {}; for (const f of F) { const e = document.getElementById(f); if (e) first[f] = e.value; }
  ok('el diálogo de export abre', Object.keys(first).length > 0, JSON.stringify(first));

  // cambia los ajustes, cierra SIN exportar, reabre
  const changed = {};
  for (const f of F) {
    const e = document.getElementById(f); if (!e) continue;
    if (e.tagName === 'SELECT' && e.options.length > 1) {
      const other = [...e.options].find(o => o.value !== e.value);
      if (other) { e.value = other.value; e.dispatchEvent(new Event('change', { bubbles: true })); changed[f] = other.value; }
    }
  }
  await w();
  const cl = document.getElementById('exClose') || document.querySelector('#exportModal .close');
  if (cl) cl.click(); await w();
  openExport(); await w();
  const after = {}; for (const f of F) { const e = document.getElementById(f); if (e) after[f] = e.value; }

  const kept = Object.keys(changed).filter(k => after[k] === changed[k]);
  const lost = Object.keys(changed).filter(k => after[k] !== changed[k]);
  ok('reabrir conserva lo último elegido', lost.length === 0,
     'conservados: ' + (kept.join(',') || 'ninguno') + (lost.length ? '   PERDIDOS: ' + lost.map(k => k + ' (' + changed[k] + '→' + after[k] + ')').join(', ') : ''));
  const c2 = document.getElementById('exClose'); if (c2) c2.click();
  return out.join('\n');
})()

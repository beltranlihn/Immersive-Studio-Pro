(async () => {
  const out = []; const w = n => new Promise(r => setTimeout(r, n));
  const ok = (n, c, d) => out.push((c ? 'ok   ' : 'FAIL ') + n + (d ? '  → ' + d : ''));
  const hit = el => { const r = el.getBoundingClientRect(); if (r.width <= 0) return false;
    const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!t && (t === el || el.contains(t) || t.contains(el)); };

  // 1) 21px erradicado
  const h21 = [...document.querySelectorAll('button,.ms,.abt,.lcol,.seqtab')].filter(hit).filter(e => Math.round(e.getBoundingClientRect().height) === 21).length;
  ok('ningún control a 21px', h21 === 0, h21 + ' restantes');
  const sa = document.querySelector('.seqadd');
  if (sa) out.push('   botón "+" de secuencia: ' + Math.round(sa.getBoundingClientRect().height) + 'px (esperado 20)');

  // 2) previewQuality persiste
  const q = [...document.querySelectorAll('#qualitySeg button')].find(b => b.dataset.q === '0.5');
  q.click(); await w(200);
  ok('la calidad ½ se persiste en localStorage', localStorage.getItem('dspPreviewQuality') === '0.5', localStorage.getItem('dspPreviewQuality'));
  // simula reinicio
  state.previewQuality = 1; applyPreviewQuality(localStorage.getItem('dspPreviewQuality') || 1);
  ok('tras reiniciar recupera ½', state.previewQuality === 0.5, 'compSize=' + compSize + ' botón=' + ((document.querySelector('#qualitySeg button.on') || {}).textContent || '').trim());
  ok('el botón ½ queda marcado tras restaurar', (document.querySelector('#qualitySeg button.on') || {}).dataset.q === '0.5');
  [...document.querySelectorAll('#qualitySeg button')].find(b => b.dataset.q === '1').click();
  try { localStorage.removeItem('dspPreviewQuality'); } catch (_) {}
  return out.join('\n');
})()

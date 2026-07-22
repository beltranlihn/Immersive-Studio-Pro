(() => {
  const bar = document.getElementById('statInfo');
  const btn = document.querySelector('[data-t="trim"]');
  if (!btn) return 'no hay boton trim';
  const raw = btn.getAttribute('title') || btn.getAttribute('data-tip');
  btn.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
  const shown = bar.textContent;
  const name = bar.querySelector('.k') ? bar.querySelector('.k').textContent : null;
  const sc = bar.querySelector('.sc') ? bar.querySelector('.sc').textContent : null;
  // el mismo regex, aplicado a mano, para ver que decide
  const m = raw.match(/^(.+?)\s*(?:—|–| - |\()(.*)$/);
  return JSON.stringify({
    tooltipOriginal: raw,
    barraMuestra: shown,
    nombreDetectado: name,
    atajoDetectado: sc,
    regexGrupo1: m ? m[1] : null,
    regexGrupo2: m ? m[2].slice(0, 60) : null,
    parentesisHuerfano: /\)/.test(shown) && !/\(/.test(shown),
  }, null, 1);
})()

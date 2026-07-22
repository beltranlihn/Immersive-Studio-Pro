(() => {
  const hit = el => { const r = el.getBoundingClientRect(); if (r.width <= 0) return false;
    const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!t && (t === el || el.contains(t) || t.contains(el)); };
  const ts = [...document.querySelectorAll('button,.ms,.abt,.lcol')].filter(hit);
  const res = [], seen = new Set();
  for (let i = 0; i < ts.length; i++) {
    const a = ts[i].getBoundingClientRect();
    if (Math.min(a.width, a.height) >= 24) continue;
    let nb = null;
    for (let j = 0; j < ts.length; j++) {
      if (i === j) continue;
      const b = ts[j].getBoundingClientRect();
      if ((Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) <= 0 && (Math.min(a.right, b.right) - Math.max(a.left, b.left)) <= 0) continue;
      const d = Math.hypot((a.left + a.width / 2) - (b.left + b.width / 2), (a.top + a.height / 2) - (b.top + b.height / 2));
      if (!nb || d < nb.d) nb = { d, el: ts[j] };
    }
    if (nb && nb.d < 24) {
      const yo = (ts[i].id || String(ts[i].className) || ts[i].tagName) + ' "' + (ts[i].textContent || '').trim().slice(0, 5) + '"';
      const padre = ts[i].parentElement ? String(ts[i].parentElement.className).split(' ')[0] : '?';
      const k = yo + padre;
      if (seen.has(k)) continue; seen.add(k);
      res.push({ yo, padre, size: Math.round(a.width) + 'x' + Math.round(a.height), paso: +nb.d.toFixed(1),
                 vecino: (nb.el.id || String(nb.el.className) || nb.el.tagName) + ' "' + (nb.el.textContent || '').trim().slice(0, 5) + '"' });
    }
  }
  const h21 = [...document.querySelectorAll('*')].filter(e => { const r = e.getBoundingClientRect(); return r.height > 0 && Math.round(r.height) === 21 && hit(e); })
    .slice(0, 4).map(e => (e.id || String(e.className) || e.tagName));
  return JSON.stringify({ incumplen: res.sort((a, b) => a.paso - b.paso), altura21: h21 }, null, 1);
})()

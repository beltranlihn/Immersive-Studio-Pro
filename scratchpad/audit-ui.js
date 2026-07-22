(() => {
  const R = {};
  const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };

  // Every clickable thing: how big is it really, and how many different sizes are there?
  const btns = [...document.querySelectorAll('button')].filter(vis);
  const sizes = {};
  for (const b of btns) { const r = b.getBoundingClientRect(); const k = Math.round(r.width) + '×' + Math.round(r.height); sizes[k] = (sizes[k] || 0) + 1; }
  R.buttonCount = btns.length;
  R.buttonSizes = Object.entries(sizes).sort((a, b) => b[1] - a[1]);
  R.distinctButtonSizes = Object.keys(sizes).length;
  const hs = btns.map(b => Math.round(b.getBoundingClientRect().height));
  R.buttonHeights = [...new Set(hs)].sort((a, b) => a - b);
  R.smallestButton = Math.min(...btns.map(b => { const r = b.getBoundingClientRect(); return Math.min(r.width, r.height); }));
  R.buttonsUnder16px = btns.filter(b => { const r = b.getBoundingClientRect(); return Math.min(r.width, r.height) < 16; }).length;

  // Type: what is ACTUALLY rendered, across the whole app
  const fs = {}, ff = {}, fw = {};
  for (const el of document.querySelectorAll('*')) {
    if (!el.firstChild || el.firstChild.nodeType !== 3 || !el.textContent.trim()) continue;
    if (!vis(el)) continue;
    const c = getComputedStyle(el);
    fs[c.fontSize] = (fs[c.fontSize] || 0) + 1;
    ff[c.fontFamily.split(',')[0].replace(/"/g, '')] = 1;
    fw[c.fontWeight] = (fw[c.fontWeight] || 0) + 1;
  }
  R.renderedFontSizes = Object.entries(fs).sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]));
  R.fontFamilies = Object.keys(ff);
  R.fontWeights = Object.entries(fw).sort((a, b) => b[1] - a[1]);

  // Tabular numerals: numbers that jitter while playing are a classic pro-tool tell
  const nums = [...document.querySelectorAll('*')].filter(el => el.firstChild && el.firstChild.nodeType === 3 && /^[\d:.,\-\s]+$/.test(el.textContent.trim()) && el.textContent.trim().length > 2 && vis(el));
  R.numericElements = nums.length;
  R.numericWithoutTabular = nums.filter(el => !/tabular-nums/.test(getComputedStyle(el).fontVariantNumeric)).map(el => (el.id || el.className || el.tagName) + '="' + el.textContent.trim().slice(0, 12) + '"').slice(0, 10);

  // Spacing rhythm: does anything sit on a 4px grid?
  const gaps = {};
  for (const el of document.querySelectorAll('*')) {
    if (!vis(el)) continue; const c = getComputedStyle(el);
    if (c.display.includes('flex') || c.display.includes('grid')) { const g = c.gap || c.columnGap; if (g && g !== 'normal' && g !== '0px') gaps[g] = (gaps[g] || 0) + 1; }
  }
  R.liveGaps = Object.entries(gaps).sort((a, b) => b[1] - a[1]);
  R.gapsOffGrid = Object.keys(gaps).filter(g => parseFloat(g) % 4 !== 0);

  // Radii
  const rad = {};
  for (const el of document.querySelectorAll('*')) { if (!vis(el)) continue; const r = getComputedStyle(el).borderRadius; if (r && r !== '0px') rad[r] = (rad[r] || 0) + 1; }
  R.liveRadii = Object.entries(rad).sort((a, b) => b[1] - a[1]).slice(0, 8);

  // Track row height — the single most-repeated measurement in the app
  const lane = document.querySelector('#tracks .lane'), lh = document.querySelector('#laneHeaders .lanehdr');
  R.trackRowHeight = lane ? Math.round(lane.getBoundingClientRect().height) : null;
  R.trackHeaderWidth = lh ? Math.round(lh.getBoundingClientRect().width) : null;
  R.rulerHeight = document.querySelector('.ruler') ? Math.round(document.querySelector('.ruler').getBoundingClientRect().height) : null;

  return JSON.stringify(R, null, 1);
})()

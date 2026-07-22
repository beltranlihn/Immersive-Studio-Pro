(async () => {
  const wait = () => new Promise(r => setTimeout(r, 60));
  // Reset first: this drives the live UI, so leftover state from an earlier test in the same page
  // (a scrolled module, a different audioH) silently changes the numbers and fakes a failure.
  const _sc = document.getElementById('tlscroll');
  _sc.scrollTop = 0; _sc.dispatchEvent(new Event('scroll'));
  state.tl.audioH = 91; state.tl._audioScroll = 0; renderTimeline();
  await new Promise(r => setTimeout(r, 120));
  const dv = document.querySelector('#audioHeadZone .trackdivider') || document.querySelector('#tracks .audiozone .trackdivider');
  if (!dv) return 'no divider';
  const r0 = dv.getBoundingClientRect();
  const log = [];
  const snap = tag => {
    const az = document.querySelector('#tracks .audiozone'), ah = document.getElementById('audioHeadZone');
    log.push({ tag, audioH: Math.round(state.tl.audioH), azH: Math.round(az.getBoundingClientRect().height),
               ahH: Math.round(ah.getBoundingClientRect().height), azTop: Math.round(az.getBoundingClientRect().top) });
  };
  snap('start');
  let y = r0.top + r0.height / 2;
  dv.dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientY: y, bubbles: true }));
  // drag UP in 40px steps (grow the module) well past its limit
  for (let i = 1; i <= 8; i++) { window.dispatchEvent(new PointerEvent('pointermove', { clientY: y - i * 40, bubbles: true })); await wait(); snap('up ' + (i * 40)); }
  // now drag back DOWN — a well-behaved control starts shrinking IMMEDIATELY
  for (let i = 1; i <= 8; i++) { window.dispatchEvent(new PointerEvent('pointermove', { clientY: y - 320 + i * 40, bubbles: true })); await wait(); snap('down ' + (i * 40)); }
  window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  await wait();
  snap('end');
  return JSON.stringify(log, null, 0);
})()

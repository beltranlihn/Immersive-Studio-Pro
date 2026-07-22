(async () => {
  const wait = (n = 80) => new Promise(r => setTimeout(r, n));
  const out = []; const ok = (n, c, d) => out.push((c ? 'ok   ' : 'FAIL ') + n + (d ? '  → ' + d : ''));
  const sc = document.getElementById('tlscroll'), th = document.getElementById('trackHdr');
  const AZ = () => document.querySelector('#tracks .audiozone');
  const ah = document.getElementById('audioHeadZone');
  state.tl.audioH = 150; renderTimeline(); await wait();

  // 1. the two columns must be geometrically identical, or they cannot scroll together
  ok('columns have the same client height', sc.clientHeight === th.clientHeight, sc.clientHeight + ' vs ' + th.clientHeight);
  ok('columns have the same scroll travel', (sc.scrollHeight - sc.clientHeight) === (th.scrollHeight - th.clientHeight),
     (sc.scrollHeight - sc.clientHeight) + ' vs ' + (th.scrollHeight - th.clientHeight));

  // 2. track names must stay glued to their rows at EVERY scroll position (this is what broke)
  let worst = 0, worstAt = 0;
  const max = sc.scrollHeight - sc.clientHeight;
  for (let t = 0; t <= max; t += Math.max(1, Math.floor(max / 12))) {
    sc.scrollTop = t; sc.dispatchEvent(new Event('scroll')); await wait(20);
    const d = Math.abs(sc.scrollTop - th.scrollTop);
    if (d > worst) { worst = d; worstAt = sc.scrollTop; }
  }
  sc.scrollTop = max; sc.dispatchEvent(new Event('scroll')); await wait(20);
  const dEnd = Math.abs(sc.scrollTop - th.scrollTop);
  ok('no drift between names and rows, anywhere', worst === 0 && dEnd === 0, 'worst ' + worst + 'px at scrollTop=' + worstAt + ', bottom ' + dEnd + 'px');

  // 3. the audio module pins identically in both columns
  const a = AZ().getBoundingClientRect(), b = ah.getBoundingClientRect();
  ok('audio module lines up across columns', Math.abs(a.top - b.top) < 0.5 && Math.abs(a.bottom - b.bottom) < 0.5,
     'top Δ' + (b.top - a.top).toFixed(1) + ', bottom Δ' + (b.bottom - a.bottom).toFixed(1));

  // 4. video must never be able to scroll past the module and get stranded behind it
  sc.scrollTop = max; sc.dispatchEvent(new Event('scroll')); await wait(40);
  const lastVid = [...document.querySelectorAll('#tracks .lane')].filter(l => state.lanes[+l.dataset.lane] && state.lanes[+l.dataset.lane].kind === 'video').pop();
  ok('last video row is not buried under the module at max scroll',
     !lastVid || lastVid.getBoundingClientRect().bottom <= AZ().getBoundingClientRect().top + 1,
     lastVid ? 'row bottom ' + lastVid.getBoundingClientRect().bottom.toFixed(0) + ' vs module top ' + AZ().getBoundingClientRect().top.toFixed(0) : 'n/a');

  // 5. the two spaces stay independent: a wheel in one must not move the other
  const whl = (el, y) => el.dispatchEvent(new WheelEvent('wheel', { deltaY: y, bubbles: true, cancelable: true }));
  sc.scrollTop = 40; sc.dispatchEvent(new Event('scroll')); AZ().scrollTop = 0; state.tl._audioScroll = 0; await wait();
  let v0 = sc.scrollTop, a0 = AZ().scrollTop;
  whl(AZ(), 60); await wait();
  ok('wheel over audio scrolls audio only', AZ().scrollTop > a0 && sc.scrollTop === v0,
     'audio ' + a0 + '→' + AZ().scrollTop + ', video ' + v0 + '→' + sc.scrollTop);

  v0 = sc.scrollTop; a0 = AZ().scrollTop;
  const vidLane = document.querySelector('#tracks .lane');
  whl(vidLane, 60); await wait();
  ok('wheel over video leaves audio alone', AZ().scrollTop === a0, 'audio ' + a0 + '→' + AZ().scrollTop);

  // 6. wheel over the audio HEADERS drives the module too (both columns are one surface)
  AZ().scrollTop = 0; state.tl._audioScroll = 0; ah.scrollTop = 0; await wait();
  whl(ah, 60); await wait();
  ok('wheel over audio headers scrolls the module', AZ().scrollTop > 0, 'module scrollTop ' + AZ().scrollTop);
  ok('audio headers and audio rows scroll as one', Math.abs(AZ().scrollTop - ah.scrollTop) < 1, AZ().scrollTop + ' vs ' + ah.scrollTop);

  return out.join('\n');
})()

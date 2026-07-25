// Verifica la barra de V-zoom lateral: existe, el thumb se posiciona por altura media, y arrastrarlo escala las pistas.
import { targets } from './cdp.mjs';
import fs from 'fs';
const page = (await targets(9222)).find(t => t.type === 'page' && t.webSocketDebuggerUrl);
if (!page) { console.log('no page'); process.exit(1); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error('threw: ' + JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result.value; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const errors = [];
await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data); if (x.method === 'Runtime.consoleAPICalled' && x.params.type === 'error') errors.push((x.params.args || []).map(a => a.value || a.description || '').join(' ')); });

await send('Page.reload', { ignoreCache: true });
await wait(1400);
for (let i = 0; i < 50; i++) { try { if (await evl('typeof state!=="undefined" && typeof renderTimeline!=="undefined" && typeof render!=="undefined" && !!document.getElementById("tracks")')) break; } catch (e) {} await wait(400); }
await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false, screenWidth: 1920, screenHeight: 1080 });
await evl(`(()=>{ try{localStorage.setItem('dspOnboardV1','1')}catch(e){} document.querySelectorAll('.overlay,#splashOv,#tourOv').forEach(o=>{try{if(o._stopLogo)o._stopLogo();}catch(e){}o.remove();}); document.body.classList.remove('preboot'); try{resize();}catch(e){} render(); return 1; })()`);
await wait(400);
await evl(`(async()=>{ state.dirty=false; await buildDemoProject(); render(); renderTimeline(); return 1; })()`);
await wait(500);

const info = await evl(`(()=>{
  const bar=document.getElementById('tlVZoom'), th=document.getElementById('tlVZoomThumb');
  if(!bar||!th) return {error:'vzoom missing'};
  const r=bar.getBoundingClientRect(), t0=th.getBoundingClientRect();
  const heights0=state.lanes.map(l=>l.h||(l.kind==='audio'?AUDIO_LANE_H:LANE_DEF_H));
  return { barWidth:Math.round(r.width), barVisible:r.width>0&&r.height>0,
           thumbTop:Math.round(t0.top-r.top), thumbH:Math.round(t0.height),
           heightsBefore:heights0, thumbCenter:{x:Math.round(r.x+r.width/2), y:Math.round(t0.top+t0.height/2)} };
})()`);
console.log('VZOOM:', JSON.stringify(info, null, 2));

if (!info.error) {
  // arrastrar el thumb 90px hacia abajo → pistas más altas
  const { x, y } = info.thumbCenter;
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y: y + 45, button: 'left' });
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y: y + 90, button: 'left' });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y: y + 90, button: 'left' });
  await wait(400);
  const after = await evl(`(()=>{
    const th=document.getElementById('tlVZoomThumb'), bar=document.getElementById('tlVZoom');
    const r=bar.getBoundingClientRect(), t=th.getBoundingClientRect();
    return { heightsAfter: state.lanes.map(l=>l.h||(l.kind==='audio'?AUDIO_LANE_H:LANE_DEF_H)),
             thumbTopAfter: Math.round(t.top-r.top),
             laneHeightsRendered: [...document.querySelectorAll('#tracks .lane')].map(e=>Math.round(e.getBoundingClientRect().height)) };
  })()`);
  console.log('AFTER DRAG DOWN 90px:', JSON.stringify(after, null, 2));
  const grew = after.heightsAfter.every((h, i) => h >= info.heightsBefore[i]) && after.heightsAfter.some((h, i) => h > info.heightsBefore[i]);
  console.log('tracks got TALLER:', grew);
}

const rect = await evl(`(()=>[Math.round(document.querySelector('.timeline').getBoundingClientRect().y)])()`);
const cap = await send('Page.captureScreenshot', { format: 'png', clip: { x: 1560, y: rect[0], width: 360, height: Math.min(1080 - rect[0], 400), scale: 1 } });
fs.writeFileSync('scratchpad/verify-vzoom.png', Buffer.from(cap.data, 'base64'));
console.log('  → scratchpad/verify-vzoom.png');
console.log('ERRORS:', errors.length ? errors : 'none');
ws.close();

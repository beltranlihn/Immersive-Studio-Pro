// Verifica el well Simple·Auto·Grid·Fit del transport + la lógica nueva de Grid y Fit.
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

const out = await evl(`(()=>{
  const seg=document.getElementById('tlEditSeg');
  const btns=[...seg.querySelectorAll('button')].map(b=>({id:b.id, txt:b.textContent.trim(), on:b.classList.contains('on')}));
  const grid=document.getElementById('tlGridBtn'), fit=document.getElementById('fitAllBtn');
  const tracks=document.getElementById('tracks');
  // GRID: estado inicial (on) → clic apaga → clic enciende
  const bg0=getComputedStyle(tracks).backgroundImage!=='none';
  grid.click();
  const bg1=getComputedStyle(tracks).backgroundImage!=='none';
  grid.click();
  const bg2=getComputedStyle(tracks).backgroundImage!=='none';
  // FIT: zoom absurdo → Fit debe encajar la duración en el ancho visible
  state.tl.pxPerSec=900; renderTimeline();
  const ppsBefore=state.tl.pxPerSec;
  fit.click();
  const sc=document.getElementById('tlscroll');
  const ppsAfter=state.tl.pxPerSec, vw=sc.clientWidth, d=duration();
  const contentW=d*ppsAfter;
  return { buttons:btns, gridInitialOn:bg0, gridAfterOff:bg1, gridAfterOn:bg2,
    fit:{ ppsBefore, ppsAfter:Math.round(ppsAfter*100)/100, viewportW:vw, durationSec:Math.round(d*100)/100,
          contentW:Math.round(contentW), fitsInView: contentW<=vw+1, usesMostOfView: contentW>vw*0.8, scrollLeft:sc.scrollLeft } };
})()`);
console.log(JSON.stringify(out, null, 2));

const rect = await evl(`(()=>[Math.round(document.querySelector('.transport').getBoundingClientRect().y)])()`);
const cap = await send('Page.captureScreenshot', { format: 'png', clip: { x: 900, y: Math.max(0, rect[0] - 3), width: 1020, height: 36, scale: 1 } });
fs.writeFileSync('scratchpad/verify-editseg.png', Buffer.from(cap.data, 'base64'));
console.log('  → scratchpad/verify-editseg.png');
console.log('ERRORS:', errors.length ? errors : 'none');
ws.close();

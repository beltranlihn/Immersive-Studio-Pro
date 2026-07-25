// Captura el editor de DOMO (2D master + 3D) a 1920x1080 con el rediseño aplicado — clips de referencia + automatización.
import { targets } from './cdp.mjs';
import fs from 'fs';
const page = (await targets(9222)).find(t => t.type === 'page' && t.webSocketDebuggerUrl);
if (!page) { console.log('no page'); process.exit(1); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error('threw: ' + JSON.stringify(r.exceptionDetails).slice(0, 200)); return r.result.value; };
const shot = async n => { const r = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 1 } }); fs.writeFileSync('scratchpad/' + n, Buffer.from(r.data, 'base64')); console.log('  →', n); };
const wait = ms => new Promise(r => setTimeout(r, ms));

for (let i = 0; i < 40; i++) { try { if (await evl('typeof state!=="undefined" && !!document.getElementById("tfRows")')) break; } catch (e) {} await wait(400); }
await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false, screenWidth: 1920, screenHeight: 1080 });
await evl(`(()=>{ try{localStorage.setItem('dspOnboardV1','1')}catch(e){} document.querySelectorAll('.overlay,#splashOv,#tourOv').forEach(o=>{try{if(o._stopLogo)o._stopLogo();}catch(e){}o.remove();}); document.body.classList.remove('preboot'); try{resize();}catch(e){} render(); return 1; })()`);
await wait(500);

const AUTOSETUP = `
  function _kf(c,p,vals){ c.kf=c.kf||{}; c.kf[p]=vals.map(v=>({t:v[0],v:v[1],e:'both'})); }
  function _armAuto(){ const cs=state.clips.filter(c=>!isAudioClip(c)); cs.slice(0,3).forEach((c,i)=>{ const p=['size','az','el'][i%3]; const d=Math.max(3,c.dur); _kf(c,p,[[0,i%2?40:55],[d*0.4,70],[d*0.8,45]]); try{openAuto(c,p);}catch(e){} }); state.inlineCurves=true; try{syncAutoUI();}catch(e){} const cb=document.getElementById('curvesBtn'); if(cb)cb.classList.add('on'); renderTimeline(); render(); }
`;

console.log('Domo — build + automatización');
await evl(`(async()=>{ ${AUTOSETUP} state.dirty=false; await buildDemoProject(); _armAuto(); state.playhead=2; render(); renderTimeline(); return 1; })()`);
await wait(700);

console.log('Domo 2D (Dome Master)');
await evl(`(()=>{ const b=document.querySelector('#viewModeSeg button[data-v="2d"]'); if(b)b.click(); render(); return 1; })()`);
await wait(500);
await shot('now-domo-2d.png');

console.log('Domo 3D');
await evl(`(()=>{ const b=document.querySelector('#viewModeSeg button[data-v="3d"]'); if(b)b.click(); render(); return 1; })()`);
await wait(700);
await shot('now-domo-3d.png');

// también con un clip seleccionado para mostrar el inspector con faders coloreados
console.log('Domo 3D + clip seleccionado (inspector color por parámetro)');
await evl(`(()=>{ const c=state.clips.find(x=>{const m=mediaById(x.mediaId);return m&&m.kind==='shape';})||state.clips[0]; state.selId=c.id; state.selIds=[c.id]; const secM=document.getElementById('secMaster'), im=document.getElementById('insMaster'); if(secM&&im&&!im.classList.contains('collapsed'))secM.click(); renderInspector(); render(); return 1; })()`);
await wait(400);
await shot('now-domo-3d-inspector.png');

ws.close();
console.log('listo');

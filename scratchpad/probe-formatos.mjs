// Etapa 7 · qué muestra la app en la barra del visor en cada formato, contra lo que piden los tres handoffs.
import { targets } from './cdp.mjs';
const wait = ms => new Promise(r => setTimeout(r, ms));
let idx = null;
for (let i = 0; i < 150; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(200); }
if (!idx) { console.log('sin editor'); process.exit(1); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 300) }; return r.result.value; };
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false, screenWidth: 1600, screenHeight: 900 });
await send('Page.reload', { ignoreCache: true }); await wait(2400);
for (let i = 0; i < 80; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await evl(`(()=>{try{localStorage.setItem('dspOnboardV1','1')}catch(e){}document.querySelectorAll('.overlay,#tourOv,#landingOv').forEach(o=>o.remove());document.body.classList.remove('preboot');try{resize()}catch(e){}return 1})()`);
await evl(`(async()=>{state.dirty=false;await buildDemoProject();return 1})()`); await wait(700);

const LEER = `(()=>{
  const vis=el=>!!(el&&el.getBoundingClientRect().width>0);
  const txt=el=>el?(el.textContent||'').replace(/\\s+/g,' ').trim():null;
  const seg=document.getElementById('viewModeSeg');
  const botones=seg?[...seg.querySelectorAll('button')].map(b=>({txt:txt(b), visible:vis(b), title:b.title||''})):[];
  const overlays=[...document.querySelectorAll('#viewCtl button')].filter(b=>vis(b)).map(b=>txt(b)).filter(Boolean);
  return { modo:state.seqMode, vista:state.view.mode, segmento:botones,
    overlaysVisibles:overlays, chip:txt(document.getElementById('fmtChip')) }; })()`;

for (const [nombre, montar] of [
  ['DOMO', `state.dirty=false; await newProject('dome',4096,4096,60,180);`],
  ['2D FLAT', `state.dirty=false; await newProject('flat',1920,1080,60,180);`],
  ['SALA 360', `state.dirty=false; await newRoomProject({fps:60, floor:{wcm:500,dcm:400,pxW:1920,pxH:1080},
      walls:[{role:'Front',order:1,wcm:500,hcm:300,pxW:1920,pxH:1080},{role:'Right',order:2,wcm:400,hcm:300,pxW:1536,pxH:1080},
             {role:'Back',order:3,wcm:500,hcm:300,pxW:1920,pxH:1080},{role:'Left',order:4,wcm:400,hcm:300,pxW:1536,pxH:1080}]});`],
]) {
  await evl(`(async()=>{ ${montar} try{updModeUI();}catch(e){} try{updViewCtl();}catch(e){} render(); return 1; })()`);
  await wait(900);
  console.log('— ' + nombre + ' —');
  console.log('  ' + JSON.stringify(await evl(LEER)));
}
ws.close();

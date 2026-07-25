// Capturas 1920x1080 del software: Domo 3D, diálogo de creación de sala, Sala 3D — con clips de referencia + modo automatización.
import { targets } from './cdp.mjs';
import fs from 'fs';

const PORT = 9222;
const list = await targets(PORT);
const page = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
if (!page) { console.log('no page — ¿está corriendo el .exe? matalo y relanzá npx electron .'); process.exit(1); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws fail')); });
let _id = 0;
const send = (method, params) => new Promise((res, rej) => {
  const id = ++_id;
  const h = ev => { const m = JSON.parse(ev.data); if (m.id !== id) return; ws.removeEventListener('message', h); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); };
  ws.addEventListener('message', h);
  ws.send(JSON.stringify({ id, method, params }));
});
const evl = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error('page threw: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
  return r.result.value;
};
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 1 } });
  fs.writeFileSync('scratchpad/' + name, Buffer.from(r.data, 'base64'));
  console.log('  →', name);
};
const wait = ms => new Promise(r => setTimeout(r, ms));

// 1920x1080 viewport
await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false, screenWidth: 1920, screenHeight: 1080 });
await evl(`(()=>{ try{localStorage.setItem('dspOnboardV1','1')}catch(e){}
  document.querySelectorAll('.overlay,#splashOv,#loadingOv,#tourOv').forEach(o=>{ try{if(o._stopLogo)o._stopLogo();}catch(e){} o.remove(); }); // fuera el splash/loop del logo y cualquier overlay
  try{ if(typeof _tourStop!=='undefined'&&_tourStop)_tourStop(); }catch(e){}
  document.body.classList.remove('preboot'); try{resize();}catch(e){} render(); return 1; })()`);
await wait(600);

// helper (in-page) to keyframe a clip + arm its automation
const AUTOSETUP = `
  function _kf(c,p,vals){ c.kf=c.kf||{}; c.kf[p]=vals.map(v=>({t:v[0],v:v[1],e:'both'})); }
  function _armAuto(){ const cs=state.clips.filter(c=>!isAudioClip(c)); cs.slice(0,3).forEach((c,i)=>{ const p=isFlat()?['scale','x','y'][i%3]:['size','az','el'][i%3]; const d=Math.max(3,c.dur); _kf(c,p,[[0,i%2?40:55],[d*0.4,70],[d*0.8,45]]); try{openAuto(c,p);}catch(e){} }); state.inlineCurves=true; try{syncAutoUI();}catch(e){} const cb=document.getElementById('curvesBtn'); if(cb)cb.classList.add('on'); renderTimeline(); render(); }
`;

console.log('Escenario 1 — Editor Domo, vista 3D, clips de referencia + automatización');
await evl(`(async()=>{ ${AUTOSETUP}
  await buildDemoProject();                 // demo domo (título + 3 formas en V1-V4)
  const b3=document.querySelector('#viewModeSeg button[data-v="3d"]'); if(b3)b3.click();  // vista 3D
  _armAuto();
  state.playhead=2; positionPlayhead&&positionPlayhead(); render(); renderTimeline();
  return 1; })()`);
await wait(900);
await shot('shot-domo-3d.png');

console.log('Escenario 2 — Diálogo de creación de sala 360');
await evl(`(()=>{ document.querySelectorAll('.overlay').forEach(o=>o.remove()); roomSetupDialog(()=>{}); return 1; })()`);
await wait(500);
await shot('shot-sala-dialogo.png');
await evl(`(()=>{ document.querySelectorAll('.overlay').forEach(o=>o.remove()); return 1; })()`);

console.log('Escenario 3 — Editor 360, vista 3D de la sala, clips + automatización');
await evl(`(async()=>{ ${AUTOSETUP}
  state.dirty=false;  // evitar el diálogo confirmDiscard (la automatización marcó dirty en el escenario 1)
  await newRoomProject({ fps:60, floor:{pxW:1920,pxH:1920}, walls:[
    {role:'Front',order:1,wcm:500,hcm:300,pxW:1920,pxH:1080},
    {role:'Right',order:2,wcm:400,hcm:300,pxW:1920,pxH:1080},
    {role:'Back', order:3,wcm:500,hcm:300,pxW:1920,pxH:1080},
    {role:'Left', order:4,wcm:400,hcm:300,pxW:1920,pxH:1080} ] });
  // clips de referencia en la tira de muros (3 formas + 1 texto, escalonadas)
  const add=(fn)=>{ try{fn();}catch(e){} };
  add(()=>createShapeClip('rect')); add(()=>createShapeClip('ellipse')); add(()=>createShapeClip('line'));
  // repartir en lanes/tiempos
  state.clips.forEach((c,i)=>{ c.lane=i%3; c.start=i*1.2; });
  const b3=document.querySelector('#viewModeSeg button[data-v="3d"]'); if(b3)b3.click();  // 3D de la sala
  _armAuto();
  state.playhead=1.5; render(); renderTimeline();
  return 1; })()`);
await wait(1100);
await shot('shot-sala-3d.png');

ws.close();
console.log('listo — 3 capturas en scratchpad/');

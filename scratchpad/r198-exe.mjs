// [R198] Humo sobre el .exe DESPLEGADO (no el dev): que arranque, que el landing pinte los visores de la sala
// y que no haya errores de consola. Lo que corre es el asar copiado, que es lo que va a abrir Beltran.
import { targets } from './cdp.mjs';
import { spawn } from 'child_process';
const wait = ms => new Promise(r => setTimeout(r, ms));
const EXE = 'C:\\Users\\beltr\\AppData\\Local\\Programs\\Immersive Studio Pro\\Immersive Studio Pro.exe';
const p = spawn(EXE, ['--remote-debugging-port=9223'], { stdio: 'ignore' });
let idx = null;
for (let i = 0; i < 300; i++) { const l = await targets(9223).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(200); }
if (!idx) { console.log('NO ARRANCA'); process.exit(1); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, pr) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: pr })); });
const errs = []; await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data); if (x.method === 'Runtime.exceptionThrown') errs.push(((x.params.exceptionDetails.exception || {}).description || '').slice(0, 200)); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: 120000 }); return r.exceptionDetails ? JSON.stringify(r.exceptionDetails).slice(0, 300) : r.result.value; };
for (let i = 0; i < 200; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(3000);
console.log('GPU / render vivo:', await evl(`(()=>({ webgl:!!(typeof gl!=='undefined'&&gl&&!gl.isContextLost()), perdido:(typeof glLost!=='undefined')?glLost:null }))()`));
console.log('landing · sala:', await evl(`(async()=>{
  if(!document.getElementById('landingOv'))showLanding();
  _lch.ptype='room'; renderLauncher(); await new Promise(r=>setTimeout(r,500)); lchPaintNow(); await new Promise(r=>setTimeout(r,300));
  const ov=document.getElementById('landingOv');
  const tinta=id=>{ const cv=ov.querySelector(id); if(!cv||!cv.width)return 'sin lienzo';
    const d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data; let n=0;
    for(let i=0;i<d.length;i+=4)if(d[i+1]>=14)n++; return n; };
  const btn=ov.querySelector('.lch-create'), P=document.getElementById('lchPanel');
  return JSON.stringify({ visor3dSala:tinta('#lchCvRoom3d'), planta:tinta('#lchCvIso'), tiraCosida:tinta('#lchCvStrip'),
    filaDePiso:!!P.querySelector('.lch-floorrow'),
    botonCrearVisible: !!btn && btn.getBoundingClientRect().bottom<=P.getBoundingClientRect().bottom,
    scrollDeLaPagina: ov.scrollHeight-ov.clientHeight }); })()`));
console.log('landing · domo 220°:', await evl(`(async()=>{
  _lch.ptype='dome'; _lch.domeCov=220; renderLauncher(); await new Promise(r=>setTimeout(r,500)); lchPaintNow(); await new Promise(r=>setTimeout(r,300));
  const cv=document.getElementById('lchCvDome3d'); if(!cv||!cv.width)return 'sin lienzo';
  const d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data; let n=0,mx=0;
  for(let i=0;i<d.length;i+=4){ if(d[i+1]>=14)n++; if(d[i+1]>mx)mx=d[i+1]; }
  return JSON.stringify({pintados:n, maxGris:mx}); })()`));
console.log('errores:', errs.length ? errs.slice(0, 6) : 'ninguno');
try { ws.close(); } catch (_) { } try { p.kill('SIGKILL'); } catch (_) { }

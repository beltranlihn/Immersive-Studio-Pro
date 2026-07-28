// [R198] ¿el arnes distingue? Se fuerza u_rimDeg=90 (el comportamiento ANTERIOR) interceptando la escritura del
// uniforme, y se vuelve a medir. Si el numero no cambia, la medida no vale y hay que buscar otra.
import { targets } from './cdp.mjs';
import { spawn } from 'child_process';
const wait = ms => new Promise(r => setTimeout(r, ms));
const ROOT = 'C:\\Users\\beltr\\Desktop\\Alma Digital Studio\\Projects\\Immersive Studio Pro';
const p = spawn(ROOT + '\\node_modules\\electron\\dist\\electron.exe', ['.', '--remote-debugging-port=9222'], { cwd: ROOT, stdio: 'ignore' });
let idx = null;
for (let i = 0; i < 250; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(200); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, pr) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: pr })); });
const errs = []; await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data); if (x.method === 'Runtime.exceptionThrown') errs.push(((x.params.exceptionDetails.exception || {}).description || '').slice(0, 200)); });
const evl = async e => { try { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: 300000 }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 300) }; return r.result.value; } catch (err) { return { CAIDA: String(err.message).slice(0, 140) }; } };
for (let i = 0; i < 150; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(2500);

const ARNES = `window.__mide=function(cov){
  let cv=document.getElementById('__probe');
  if(!cv){ cv=document.createElement('canvas'); cv.id='__probe';
    cv.style.cssText='position:fixed;left:0;top:0;width:420px;height:420px;z-index:9999;opacity:0.01;pointer-events:none;';
    document.body.appendChild(cv); }
  const c0={...state.view.cam}; state.view.cam.pitch=1.45; state.view.cam.yaw=0; state.view.cam.dist=3.4;
  const ok=lchEditorShot(cv,{w:2048,h:2048,mode:'dome',cov:cov,view:'3d'});
  state.view.cam=c0;
  if(!ok)return {ok:false};
  const W=cv.width,H=cv.height, d=cv.getContext('2d').getImageData(0,0,W,H).data;
  let sx=0,sy=0,n=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){ const g=d[(y*W+x)*4+1]; if(g>=18){ sx+=x; sy+=y; n++; } }
  if(!n)return {ok:true,vacio:true};
  const cx=sx/n, cy=sy/n; let rBorde=0, rRejilla=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){ const g=d[(y*W+x)*4+1]; if(g<18)continue;
    const r=Math.hypot(x-cx,y-cy);
    if(g>=60){ if(r>rBorde)rBorde=r; }
    if(r>rRejilla)rRejilla=r; }
  return {rBorde:+rBorde.toFixed(1), rRejilla:+rRejilla.toFixed(1), desborde:+(rRejilla-rBorde).toFixed(1)};
};
window.__fijar90=function(on){
  if(on){ if(!window.__u1)window.__u1=gl.uniform1f.bind(gl);
    gl.uniform1f=function(loc,v){ return window.__u1(loc, loc===L3.rimDeg?90:v); }; }
  else if(window.__u1){ gl.uniform1f=window.__u1; }
  return true; };1`;
console.log('arnes:', await evl(ARNES));

for (const cov of [180, 200, 210, 220]) {
  const ahora = await evl(`JSON.stringify(__mide(${cov}))`);
  await evl('__fijar90(true)');
  const antes = await evl(`JSON.stringify(__mide(${cov}))`);
  await evl('__fijar90(false)');
  console.log(`cov ${cov}°  ANTES(u_rimDeg=90 fijo): ${antes}   AHORA(=cov/2): ${ahora}`);
}
console.log('\nerrores:', errs.length ? errs.slice(0, 6) : 'ninguno');
try { ws.close(); } catch (_) { } try { p.kill('SIGKILL'); } catch (_) { }

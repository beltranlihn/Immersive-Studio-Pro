// [R198] Medida de la linea de borde SOLO sobre el WebGL (`glc`): el intento anterior leia tambien la capa de
// guias, y sus rotulos FRENTE/ATRAS/CENIT quedan siempre por fuera de todo → tapaban la medida.
// Se valida el arnes forzando u_rimDeg=90 (el comportamiento anterior) antes de dar nada por bueno.
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

const ARNES = `
window.__probeCv=window.__probeCv||document.createElement('canvas');
window.__mide=function(cov){
  const S=state,V=state.view,N=420;
  const bak={w:S.seqW,h:S.seqH,mode:S.seqMode,cov:S.seqCov,clips:S.clips,vmode:V.mode,cam:{...V.cam},
             gw:glc.width,gh:glc.height,rw:gridc.width,rh:gridc.height,cw:view.cw,ch:view.ch,vs:VSIZE,ra:_raOn};
  const cv=window.__probeCv; cv.width=N; cv.height=N;
  try{
    S.seqW=2048; S.seqH=2048; S.seqMode='dome'; S.seqCov=cov; S.clips=[]; V.mode='3d'; _raOn=false;
    V.cam={...V.cam,pitch:1.45,yaw:0,dist:3.4};
    view.cw=N; view.ch=N; VSIZE=N; glc.width=N; glc.height=N; gridc.width=N; gridc.height=N;
    render();
    cv.getContext('2d').drawImage(glc,0,0);            // SOLO el WebGL: nada de rotulos
  }finally{
    S.seqW=bak.w;S.seqH=bak.h;S.seqMode=bak.mode;S.seqCov=bak.cov;S.clips=bak.clips;V.mode=bak.vmode;V.cam=bak.cam;
    glc.width=bak.gw;glc.height=bak.gh;gridc.width=bak.rw;gridc.height=bak.rh;view.cw=bak.cw;view.ch=bak.ch;VSIZE=bak.vs;_raOn=bak.ra;
  }
  const d=cv.getContext('2d').getImageData(0,0,N,N).data;
  let sx=0,sy=0,n=0;
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){ const g=d[(y*N+x)*4+1]; if(g>=18){sx+=x;sy+=y;n++;} }
  if(!n)return {vacio:true};
  const cx=sx/n, cy=sy/n; let rBanda=0, rRejilla=0, maxG=0;
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){ const g=d[(y*N+x)*4+1]; if(g<18)continue;
    const r=Math.hypot(x-cx,y-cy); if(g>maxG)maxG=g;
    if(g>=60&&r>rBanda)rBanda=r; if(r>rRejilla)rRejilla=r; }
  return {pintados:n, maxGris:maxG, rBanda:+rBanda.toFixed(1), rRejilla:+rRejilla.toFixed(1),
          rejillaPorFueraDelBorde:+(rRejilla-rBanda).toFixed(1)};
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
  console.log(`\ncov ${cov}°`);
  console.log('   ANTES (u_rimDeg=90 fijo): ' + antes);
  console.log('   AHORA (u_rimDeg=cov/2)  : ' + ahora);
}
console.log('\nerrores:', errs.length ? errs.slice(0, 6) : 'ninguno');
try { ws.close(); } catch (_) { } try { p.kill('SIGKILL'); } catch (_) { }

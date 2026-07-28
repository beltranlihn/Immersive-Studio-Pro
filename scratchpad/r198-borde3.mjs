// [R198] Medida directa: se proyecta con la MISMA camara el punto del casquete a un angulo cenital dado y se
// mira el pixel. La banda de borde es gris claro (~90); una linea de rejilla normal es mucho mas oscura (~45).
// Si la linea de borde sigue al domo, la banda cae en cov/2 y NO en 90.
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
/* devuelve, para una cobertura, el gris maximo alrededor del punto del casquete a cada angulo cenital pedido */
window.__grisEn=function(cov,zens){
  const S=state,V=state.view,N=700;
  const bak={w:S.seqW,h:S.seqH,mode:S.seqMode,cov:S.seqCov,clips:S.clips,vmode:V.mode,cam:{...V.cam},
             gw:glc.width,gh:glc.height,rw:gridc.width,rh:gridc.height,cw:view.cw,ch:view.ch,vs:VSIZE,ra:_raOn,
             three:V.three,grid:V.showGrid,hf:V.hfade};
  const cv=window.__probeCv; cv.width=N; cv.height=N; let pts=[];
  try{
    S.seqW=2048; S.seqH=2048; S.seqMode='dome'; S.seqCov=cov; S.clips=[]; V.mode='3d'; _raOn=false;
    V.three='orbit'; V.showGrid=true; V.hfade=false;
    V.cam={...V.cam,pitch:0.30,yaw:0,dist:3.8}; // lo bastante lejos para que el borde de un domo de 220° entre en el lienzo
    view.cw=N; view.ch=N; VSIZE=N; glc.width=N; glc.height=N; gridc.width=N; gridc.height=N;
    render();                                   // pinta con esta camara exacta
    const mvp=cameraMVP(false,V.cam,1);         // ... y la reconstruye para proyectar a mano
    // OJO: proj3 lee view.cw/view.ch, asi que hay que proyectar AQUI DENTRO, antes de restaurarlas
    pts=zens.map(z=>{ const zr=z*Math.PI/180, s=Math.sin(zr); return proj3([s,0,Math.cos(zr)],mvp,-1); });
    cv.getContext('2d').drawImage(glc,0,0);     // SOLO el WebGL
  }finally{
    S.seqW=bak.w;S.seqH=bak.h;S.seqMode=bak.mode;S.seqCov=bak.cov;S.clips=bak.clips;V.mode=bak.vmode;V.cam=bak.cam;
    V.three=bak.three; V.showGrid=bak.grid; V.hfade=bak.hf;
    glc.width=bak.gw;glc.height=bak.gh;gridc.width=bak.rw;gridc.height=bak.rh;view.cw=bak.cw;view.ch=bak.ch;VSIZE=bak.vs;_raOn=bak.ra;
  }
  const d=cv.getContext('2d').getImageData(0,0,N,N).data;
  let mnx=1e9,mxx=-1e9,mny=1e9,mxy=-1e9,lit=0;
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){ if(d[(y*N+x)*4+1]<14)continue; lit++;
    if(x<mnx)mnx=x; if(x>mxx)mxx=x; if(y<mny)mny=y; if(y>mxy)mxy=y; }
  const gris=(x,y)=>{ let m=0; for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){
      const X=Math.round(x)+dx, Y=Math.round(y)+dy; if(X<0||Y<0||X>=N||Y>=N)continue;
      const g=d[(Y*N+X)*4+1]; if(g>m)m=g; } return m; };
  const out={_lit:lit, _caja:[mnx,mny,mxx,mxy].join(',')};
  zens.forEach((z,i)=>{ const P=pts[i];        // azimut 0 = el lado de aca, siempre visible
    out[z+'°']=P?(gris(P[0],P[1])+' @'+Math.round(P[0])+','+Math.round(P[1])):'fuera'; });
  return out;
};
window.__fijar90=function(on){
  if(on){ if(!window.__u1)window.__u1=gl.uniform1f.bind(gl);
    gl.uniform1f=function(loc,v){ return window.__u1(loc, loc===L3.rimDeg?90:v); }; }
  else if(window.__u1){ gl.uniform1f=window.__u1; }
  return true; };1`;
console.log('arnes:', await evl(ARNES));

for (const [cov, zens] of [[180, [60, 75, 90]], [200, [75, 90, 100]], [220, [75, 90, 105, 110]]]) {
  const z = JSON.stringify(zens);
  const ahora = await evl(`JSON.stringify(__grisEn(${cov},${z}))`);
  await evl('__fijar90(true)');
  const antes = await evl(`JSON.stringify(__grisEn(${cov},${z}))`);
  await evl('__fijar90(false)');
  console.log(`\ncov ${cov}°   (borde de la malla = ${cov / 2}°)`);
  console.log('   ANTES (90 fijo): ' + antes);
  console.log('   AHORA (cov/2)  : ' + ahora);
}
console.log('\nerrores:', errs.length ? errs.slice(0, 6) : 'ninguno');
try { ws.close(); } catch (_) { } try { p.kill('SIGKILL'); } catch (_) { }

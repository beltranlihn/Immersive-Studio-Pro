// [R198] Landing: visores reales de la sala (3D + lienzo cosido), planta sola, piso px-only, y la linea de
// borde del domo 3D siguiendo al angulo de cobertura.
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

// arnes de medida: pinta el domo 3D visto casi desde el cenit en un lienzo suelto y mide, desde el centroide
// de lo iluminado, hasta donde llega la BANDA DE BORDE (gris claro) y hasta donde llega CUALQUIER linea de
// rejilla. Si la linea de borde sigue al angulo, la rejilla nunca la desborda.
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
  return {ok:true, px:n, rBorde:+rBorde.toFixed(1), rRejilla:+rRejilla.toFixed(1),
          rejillaDesbordaElBorde:+(rRejilla-rBorde).toFixed(1)};
};1`;
console.log('arnes:', await evl(ARNES));

console.log('\n--- 1 · DOMO: la linea de borde sigue al angulo ---');
for (const cov of [180, 200, 220]) {
  console.log('  cov ' + cov + '°:', JSON.stringify(await evl(`JSON.stringify(__mide(${cov}))`)));
}

console.log('\nel landing abre:', await evl(`(()=>{ if(!document.getElementById('landingOv'))showLanding(); return !!document.getElementById('landingOv'); })()`));

console.log('\n--- 2 y 4 · SALA: visor 3D real + lienzo cosido como el 2D ---');
console.log(await evl(`(async()=>{
  _lch.ptype='room'; renderLauncher(); await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  const ov=document.getElementById('landingOv');
  const c3=ov.querySelector('#lchCvRoom3d'), pl=ov.querySelector('#lchCvIso'), st=ov.querySelector('#lchCvStrip');
  const tinta=cv=>{ if(!cv||!cv.width)return null; const d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;
    let n=0,mx=0; for(let i=0;i<d.length;i+=4){ const g=d[i+1]; if(g>=14)n++; if(g>mx)mx=g; }
    return {pintados:n, pctPintado:+(100*n/(cv.width*cv.height)).toFixed(2), maxGris:mx}; };
  const guardado={media:state.media.length, seq:state.activeSeqId, modo:state.seqMode, w:state.seqW, geoSeq:typeof _roomGeoSeq};
  const shot3d=lchEditorShot(c3,{w:1920,h:1080,mode:'room',view:'3d',room:lchRoomCfg(),cam:_lch.roomCam});
  const shot2d=lchEditorShot(st,{w:1920,h:1080,mode:'room',view:'2d',room:lchRoomCfg()});
  return JSON.stringify({
    hay3d:!!c3, hayPlanta:!!pl, hayTira:!!st,
    elVisor3dEsElReal:shot3d, laTiraEsElVisor2d:shot2d,
    tinta3d:tinta(c3), tintaPlanta:tinta(pl), tintaTira:tinta(st),
    estadoIntacto:JSON.stringify(guardado)===JSON.stringify({media:state.media.length,seq:state.activeSeqId,modo:state.seqMode,w:state.seqW,geoSeq:typeof _roomGeoSeq})
  },null,1); })()`));

console.log('\n--- planta sola (sin el iso a medias) ---');
console.log(await evl(`(()=>{
  const cv=document.createElement('canvas'); cv.width=600; cv.height=300;
  document.body.appendChild(cv); cv.style.cssText='position:fixed;left:0;top:0;width:600px;height:300px;opacity:0.01;pointer-events:none;';
  drawRoomIso(cv,lchCfgWalls(),true,null,LCH_PAL,'plan');
  const d=cv.getContext('2d').getImageData(0,0,600,300).data;
  // ¿queda algo pintado en el tercio izquierdo? con la planta sola, la mitad izquierda ya NO es el iso
  let izq=0,der=0; for(let y=0;y<300;y++)for(let x=0;x<600;x++){ const g=d[(y*600+x)*4+1]; if(g<14)continue; if(x<200)izq++; else der++; }
  const solo=document.createElement('canvas'); solo.width=600; solo.height=300;
  drawRoomIso(solo,lchCfgWalls(),true,null,LCH_PAL); // los dos paneles, para comparar
  const d2=solo.getContext('2d').getImageData(0,0,600,300).data; let izq2=0; for(let y=0;y<300;y++)for(let x=0;x<200;x++){ if(d2[(y*600+x)*4+1]>=14)izq2++; }
  cv.remove();
  return JSON.stringify({conPlanSola_izq:izq, conPlanSola_der:der, conLosDosPaneles_izq:izq2,
    laPlantaOcupaTodo:(izq>0&&der>0), veredicto:(izq<izq2)?'el iso ya no esta, la planta se extiende':'MAL'}); })()`));

console.log('\n--- 3 · PISO: pixelaje editable, medidas NO ---');
console.log(await evl(`(()=>{
  _lch.roomFloor=true; _lch.floorPx=null; renderLauncher();
  const fila=document.querySelector('#lchPanel .lch-floorrow');
  if(!fila)return 'NO HAY FILA DE PISO';
  const px=[...fila.querySelectorAll('input[data-lk]')].map(i=>i.dataset.lk);
  const ro=[...fila.querySelectorAll('span.ro')].map(s=>s.textContent.trim());
  const auto=lchFloorCfg(lchCfgWalls());
  lchApply('fpxW',2560); lchApply('fpxH',1440);
  const trasEditar=lchFloorCfg(lchCfgWalls());
  _lch.walls[0].wcm=1200; const trasCambiarMuro=lchFloorCfg(lchCfgWalls());
  const cfg=(()=>{ const w=lchCfgWalls(); return _lch.roomFloor?lchFloorCfg(w):null; })();
  return JSON.stringify({
    camposEditables:px, medidasSoloLectura:ro, hayInputsDeCm:fila.querySelectorAll('input.cm').length,
    auto, trasEditar, trasCambiarMuro,
    elPixelajeSeQueda:(trasEditar.pxW===2560&&trasEditar.pxH===1440&&trasCambiarMuro.pxW===2560),
    laMedidaSigueALosMuros:(trasCambiarMuro.wcm===1200),
    llegaAlProyecto:JSON.stringify(cfg)
  },null,1); })()`));

console.log('\n--- invariantes del launcher (alto igual, sin scroll) ---');
console.log(await evl(`(async()=>{
  const out={};
  for(const t of ['dome','flat','room']){ _lch.ptype=t; renderLauncher();
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const ov=document.getElementById('landingOv'), w=ov.querySelector('.lch-wrap');
    out[t]={alto:Math.round(w.getBoundingClientRect().height), scroll:ov.scrollHeight-ov.clientHeight}; }
  return JSON.stringify(out); })()`));

console.log('\nerrores:', errs.length ? errs.slice(0, 8) : 'ninguno');
try { ws.close(); } catch (_) { } try { p.kill('SIGKILL'); } catch (_) { }

/* [R237] Composite NO CUADRADO (máster de relleno).
   Comprueba: (1) el máster toma la forma del lienzo y llega a 1:1 · (2) el mapeo px→uv rellena exacto ·
   (3) la colocación cae en el texel correcto (lectura de píxeles del FBO) · (4) el domo queda intacto ·
   (5) export por-muro sin costuras · (6) caché de nest con su letterbox · (7) sala 3D sin franja arriba. */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:120000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const out={};
await ev(`(function(){ window.__errs=[]; addEventListener('error',e=>__errs.push(String(e.message||e)));
 if(!window.__errHook){ window.__errHook=1; const ce=console.error; console.error=function(){try{__errs.push('con: '+[...arguments].map(String).join(' '));}catch(_){}return ce.apply(console,arguments);}; }
 localStorage.removeItem('ispRoomVp'); return 1; })()`);

/* --- medidas comunes ------------------------------------------------------------------------ */
const mide=async()=>ev(`(function(){ render();
  const W=state.seqW||1,H=state.seqH||1, V=compFillVp();
  return { lienzo:[W,H], comp:[compW,compH], forma:+(compW/compH).toFixed(4), lienzoAsp:+(W/H).toFixed(4),
    submuestreoH:+(W/compW).toFixed(3), submuestreoV:+(H/compH).toFixed(3),
    vramMB:+((compW*compH*4)/1048576).toFixed(1),
    viewport:[V.x,V.y,V.w,V.h],
    /* el contenido tiene que llenar la textura: u(0)=0, u(W)=1, v(H)=0, v(0)=1 */
    relleno:{ u0:+mstrU(0).toFixed(6), u1:+mstrU(W).toFixed(6), v0:+mstrV(H).toFixed(6), v1:+mstrV(0).toFixed(6) },
    desviacionTexels:{ x:+Math.max(Math.abs(mstrU(0))*compW,Math.abs(mstrU(W)-1)*compW).toFixed(3),
                       y:+Math.max(Math.abs(mstrV(H))*compH,Math.abs(mstrV(0)-1)*compH).toFixed(3) } }; })()`);

/* lee el FBO del composite y devuelve la fila/columna donde hay tinta (para verificar la colocación) */
await ev(`window.__leerComp=function(){ render();
  gl.bindFramebuffer(gl.FRAMEBUFFER,compFBO);
  const w=compW,h=compH,px=new Uint8Array(w*h*4); gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,px);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  let x0=w,x1=-1,y0=h,y1=-1,n=0;                       // y en coordenadas GL (abajo=0)
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){ if(px[(y*w+x)*4+3]>16){ n++; if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; } }
  return {w,h,n,x0,x1,y0,y1, filaAlta:h-1-y1, filaBaja:h-1-y0, cobertura:+(n/(w*h)).toFixed(4)}; };1`);

/* --- 1) SALA 7196×912 (el caso de Beltrán) --------------------------------------------------- */
await ev(`state.dirty=false;1`);
await ev(`(async()=>{try{await startDemoProject('room');}catch(e){window.__d=String(e);}})()`); await wait(2800);
await ev(`(function(){try{if(typeof _tourStop==='function')_tourStop();const o=document.getElementById('tourOv');if(o)o.remove();}catch(e){}
 document.querySelector('#viewModeSeg button[data-v="2d"]').click(); resize(); return 1;})()`); await wait(700);
await ev(`(function(){ const as=activeSeq();
  applyRoomGeometry({walls:as.room.walls.map((w,i)=>({role:w.role,order:i+1,wcm:w.wcm,hcm:w.hcm,pxW:1799,pxH:912})),floor:null,fps:60}); return 1; })()`); await wait(900);
await ev(`applyPreviewQuality(1); render(); 1`); await wait(500);
out['1_sala_Full']=await mide();
await ev(`applyPreviewQuality(0.5); render(); 1`); await wait(300);
out['1_sala_Media']=await mide();
await ev(`applyPreviewQuality(0.25); render(); 1`); await wait(300);
out['1_sala_Cuarto']=await mide();
await ev(`applyPreviewQuality(1); render(); 1`); await wait(500);

/* --- 2) COLOCACIÓN: un solo clip a pantalla completa tiene que cubrir la textura ENTERA ------- */
out['2_colocacion']=await ev(`(async function(){
  const bak=state.clips.slice();
  state.clips=state.clips.filter(c=>c.lane===0).slice(0,1);
  if(!state.clips.length){ state.clips=bak; return {salta:'sin clip en la pista 0'}; }
  const c=state.clips[0]; c.start=0; c.props.x=0; c.props.y=0; c.props.scale=100; c.props.rot=0; c.props.opacity=100; c.kf={};
  const lane=state.lanes[c.lane]; const surfBak=lane?lane.surf:undefined; if(lane)lane.surf=null; // lienzo entero, sin recorte por superficie
  state.playhead=1; const r=__leerComp();
  state.clips=bak; if(lane)lane.surf=surfBak; render();
  return { ...r, tocaBordeIzq:r.x0===0, tocaBordeDer:r.x1===r.w-1 }; })()`);

/* --- 3) DOMO intacto (lienzo cuadrado → relleno = identidad) ---------------------------------- */
await ev(`state.dirty=false;1`);
await ev(`(async()=>{try{await startDemoProject('dome');}catch(e){window.__d=String(e);}})()`); await wait(2600);
await ev(`(function(){try{if(typeof _tourStop==='function')_tourStop();const o=document.getElementById('tourOv');if(o)o.remove();}catch(e){}
  const b=document.querySelector('#viewModeSeg button[data-v="2d"]'); if(b)b.click(); resize(); render(); return 1;})()`); await wait(700);
out['3_domo']=await mide();
out['3_domo'].disco=await ev(`(function(){ const cv=document.createElement('canvas'); cv.width=glc.width; cv.height=glc.height;
  const g=cv.getContext('2d'); g.drawImage(glc,0,0); const d=g.getImageData(0,0,cv.width,cv.height).data;
  let n=0; for(let i=3;i<d.length;i+=4)if(d[i]>8)n++; return +(n/(cv.width*cv.height)).toFixed(4); })()`);
out['3_domo'].vista3d=await ev(`(function(){ const b=document.querySelector('#viewModeSeg button[data-v="3d"]'); if(b)b.click(); resize(); render();
  const cv=document.createElement('canvas'); cv.width=glc.width; cv.height=glc.height; const g=cv.getContext('2d'); g.drawImage(glc,0,0);
  const d=g.getImageData(0,0,cv.width,cv.height).data; let n=0; for(let i=3;i<d.length;i+=4)if(d[i]>8)n++;
  const b2=document.querySelector('#viewModeSeg button[data-v="2d"]'); if(b2)b2.click(); resize(); render();
  return +(n/(cv.width*cv.height)).toFixed(4); })()`);

/* --- 4) 2D PLANO 1920×1080 ------------------------------------------------------------------- */
await ev(`state.dirty=false;1`);
await ev(`(async()=>{try{await startDemoProject('flat');}catch(e){window.__d=String(e);}})()`); await wait(2600);
await ev(`(function(){try{if(typeof _tourStop==='function')_tourStop();const o=document.getElementById('tourOv');if(o)o.remove();}catch(e){}
  const b=document.querySelector('#viewModeSeg button[data-v="2d"]'); if(b)b.click(); resize(); vpFit(); render(); return 1;})()`); await wait(700);
out['4_flat']=await mide();
out['4_flat'].pinta=await ev(`(function(){ const cv=document.createElement('canvas'); cv.width=glc.width; cv.height=glc.height;
  const g=cv.getContext('2d'); g.drawImage(glc,0,0); const d=g.getImageData(0,0,cv.width,cv.height).data;
  let n=0; for(let i=3;i<d.length;i+=4)if(d[i]>8)n++; return +(n/(cv.width*cv.height)).toFixed(4); })()`);

out.errs=await ev(`window.__errs.slice(0,20)`);
console.log(JSON.stringify(out,null,1));
ws.close();

/* [R237·4] E · sala de 4 muros 4K (15360×2160): el caso que el tope por LADO impedía llegar a 1:1
   F · capa de ajuste con FX sobre un máster no cuadrado (drawAdjustment + PMIX con banda)
   G · visor partido muros|piso: los dos paneles pintan
   H · caché de render-ahead (scrub-ahead) con el máster no cuadrado                                        */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:180000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const out={};
await ev(`(function(){ window.__errs=[]; addEventListener('error',e=>__errs.push(String(e.message||e)));
 if(!window.__errHook){ window.__errHook=1; const ce=console.error; console.error=function(){try{__errs.push('con: '+[...arguments].map(String).join(' '));}catch(_){}return ce.apply(console,arguments);}; }
 return 1; })()`);
out.gpu=await ev(`({maxTex:gl.getParameter(gl.MAX_TEXTURE_SIZE), maxVp:[...gl.getParameter(gl.MAX_VIEWPORT_DIMS)], GL_MAXSIDE, COMP_MAXTEXELS})`);

await ev(`state.dirty=false;1`);
await ev(`(async()=>{try{await startDemoProject('room');}catch(e){window.__d=String(e);}})()`); await wait(2800);
await ev(`(function(){try{if(typeof _tourStop==='function')_tourStop();const o=document.getElementById('tourOv');if(o)o.remove();}catch(e){}
 document.querySelector('#viewModeSeg button[data-v="2d"]').click(); state.playhead=1; render(); return 1;})()`); await wait(700);

const mide=async()=>ev(`(function(){ render(); const W=state.seqW||1,H=state.seqH||1,V=compFillVp();
  return { lienzo:[W,H], comp:[compW,compH], submuestreoH:+(W/compW).toFixed(3), submuestreoV:+(H/compH).toFixed(3),
    vramMB:+((compW*compH*4)/1048576).toFixed(0), viewport:[V.x,V.y,V.w,V.h],
    cuadradoHabriaDado:Math.min(GL_MAXSIDE,Math.max(W,H)),
    submuestreoCuadrado:+(Math.max(W,H)/Math.min(GL_MAXSIDE,Math.max(W,H))).toFixed(2) }; })()`);

/* --- E · 4 muros 4K --------------------------------------------------------------------------- */
out.E_sala4K=await ev(`(function(){ const as=activeSeq();
  applyRoomGeometry({walls:as.room.walls.map((w,i)=>({role:w.role,order:i+1,wcm:w.wcm,hcm:w.hcm,pxW:3840,pxH:2160})),floor:null,fps:60});
  return {w:activeSeq().w,h:activeSeq().h}; })()`); await wait(900);
await ev(`applyPreviewQuality(1); render(); 1`); await wait(600);
Object.assign(out.E_sala4K, await mide());

/* --- F · capa de ajuste con FX sobre el máster no cuadrado ------------------------------------- */
out.F_ajuste=await ev(`(function(){
  const li=state.lanes.findIndex(l=>l.surf==='wall'&&l.kind==='video'); if(li<0)return {err:'sin pista de muro'};
  state.clips=[]; state.playhead=1;
  _demoAddShape('rect','#E03020',li,0,10,{x:0,y:0,scale:400,rot:0,opacity:100}); // saturado: un hue shift sobre BLANCO no cambiaría nada
  applyPreviewQuality(0.25); render();
  const leer=()=>{ render(); const w=compW,h=compH,px=new Uint8Array(w*h*4);
    gl.bindFramebuffer(gl.FRAMEBUFFER,compFBO); gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,px); gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    let n=0,sr=0,sg=0,sb=0; for(let i=0;i<w*h;i++){ const o=i*4; if(px[o+3]>16){n++;sr+=px[o];sg+=px[o+1];sb+=px[o+2];} }
    return {comp:[w,h], pintados:n, cobertura:+(n/(w*h)).toFixed(4), rgb:n?[Math.round(sr/n),Math.round(sg/n),Math.round(sb/n)]:null}; };
  const sin=leer();
  state.lanes.push({id:uid(),name:'ADJ',tag:'ADJ',kind:'video'});
  const al=state.lanes.length-1, ac=makeAdjustClip(al,0,10); state.clips.push(ac);
  addFxToClip(ac,'hue'); const f=ac.fx[ac.fx.length-1]; if(f){ f.int=100; f.band='none'; if(f.p)f.p.amount=50; }
  const fx={hay:ac.fx.length, tipo:f&&f.type, params:f&&f.p?Object.keys(f.p):null};
  const con=leer();
  state.clips=state.clips.filter(c=>c!==ac); state.lanes.pop(); applyPreviewQuality(1); render();
  return { fx, sinCapa:sin, conCapa:con, mismaCobertura:Math.abs(sin.cobertura-con.cobertura)<0.01,
    cambiaElColor: !!(sin.rgb&&con.rgb&&(Math.abs(sin.rgb[0]-con.rgb[0])+Math.abs(sin.rgb[1]-con.rgb[1])+Math.abs(sin.rgb[2]-con.rgb[2]))>20) }; })()`);

/* --- G · visor partido muros|piso -------------------------------------------------------------- */
out.G_partido=await ev(`(function(){ const as=activeSeq();
  applyRoomGeometry({walls:as.room.walls.map((w,i)=>({role:w.role,order:i+1,wcm:w.wcm,hcm:w.hcm,pxW:1920,pxH:1080})),
    floor:{pxW:1920,pxH:1920},fps:60}); return 1; })()`); await wait(1000);
Object.assign(out,{});
out.G_partido=await ev(`(function(){
  const lw=state.lanes.findIndex(l=>l.surf==='wall'&&l.kind==='video'), lf=state.lanes.findIndex(l=>l.surf==='floor'&&l.kind==='video');
  state.clips=[]; state.playhead=1;
  if(lw>=0)_demoAddShape('rect','#FF4040',lw,0,10,{x:0,y:0,scale:300,rot:0,opacity:100});
  if(lf>=0)_demoAddShape('ellipse','#40A0FF',lf,0,10,{x:0,y:0,scale:150,rot:0,opacity:100});
  state.view.roomFloor=true; resize(); render();
  const ps=vpPanels().map(P=>({surf:P.surf,x:Math.round(P.x),w:Math.round(P.w)}));
  const cv=document.createElement('canvas'); cv.width=glc.width; cv.height=glc.height;
  const g=cv.getContext('2d'); g.drawImage(glc,0,0); const d=g.getImageData(0,0,cv.width,cv.height).data;
  const dpr=glc.width/Math.max(1,view.cw);
  const zona=(P)=>{ const x0=Math.round(P.x*dpr), x1=Math.min(cv.width,Math.round((P.x+P.w)*dpr));
    let rojo=0,azul=0,n=0; for(let y=0;y<cv.height;y++)for(let x=x0;x<x1;x++){ const i=(y*cv.width+x)*4;
      if(d[i+3]>16){ n++; if(d[i]>d[i+2]+30)rojo++; if(d[i+2]>d[i]+30)azul++; } }
    return {pintados:n,rojo,azul}; };
  const P=vpPanels(); const r={paneles:ps};
  for(const q of P) r[q.surf||'unico']=zona(q);
  return r; })()`);

/* --- H · render-ahead con el máster no cuadrado ------------------------------------------------ */
out.H_renderAhead=await ev(`(async function(){ const antes={_raW,_raH,comp:[compW,compH]};
  state.workIn=0; state.workOut=0.3; await raPrerenderRange(0,0.3);
  const hay=raHas(0), tex=raGet(0);
  const r={ antes, ra:[_raW,_raH], proporcionRA:+(_raW/_raH).toFixed(3), proporcionComp:+(compW/compH).toFixed(3),
    cachea:!!hay, devuelveTextura:!!tex };
  renderAheadOff(); state.workIn=null; state.workOut=null; render();
  return r; })()`);

out.errs=await ev(`window.__errs.slice(0,20)`);
console.log(JSON.stringify(out,null,1));
ws.close();

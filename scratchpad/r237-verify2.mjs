/* [R237·2] Lo que el plan pide verificar aparte del submuestreo:
   A · colocación por superficie en el máster de RELLENO (el piso no invade los muros y viceversa) + seam wrap
   B · export por-muro: sigue en CUADRADO CON LETTERBOX y sin costuras (uvlim + continuidad por píxeles)
   C · caché de nest (`_ncSquare`): la salida conserva su letterbox
   D · sala 3D: sin franja oscura en el borde alto de los muros                                            */
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
 return 1; })()`);

/* sala demo con piso, vista 2D */
await ev(`state.dirty=false;1`);
await ev(`(async()=>{try{await startDemoProject('room');}catch(e){window.__d=String(e);}})()`); await wait(2800);
await ev(`(function(){try{if(typeof _tourStop==='function')_tourStop();const o=document.getElementById('tourOv');if(o)o.remove();}catch(e){}
 document.querySelector('#viewModeSeg button[data-v="2d"]').click(); state.playhead=6; render(); return 1;})()`); await wait(800);
out.sala=await ev(`(function(){const as=activeSeq();return {w:as.w,h:as.h,stripH:as.room.stripH,piso:!!as.room.floor,
  muros:as.room.walls.map(w=>({role:w.role,x0:w.x0,x1:w.x1,pxH:w.pxH})),
  pistas:state.lanes.map((l,i)=>({i,surf:l.surf||null,kind:l.kind}))};})()`);

/* ---------- A · regiones del máster de relleno ---------------------------------------------- */
await ev(`window.__reg=function(){
  const as=activeSeq(), room=as.room; const W=as.w||1,H=as.h||1, stripH=Math.min(H,room.stripH||H);
  const fw=(room.walls||[]).find(w=>w.role==='Front')||room.walls[0]; const fx0=fw?fw.x0:0, fx1=fw?fw.x1:W;
  const q=applyPreviewQuality; applyPreviewQuality(0.25); render();  // 1799x228: barato de leer entero
  const w=compW,h=compH,buf=new Uint8Array(w*h*4);
  gl.bindFramebuffer(gl.FRAMEBUFFER,compFBO); gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,buf); gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  const tx=px=>Math.round(mstrU(px)*w), ty=py=>Math.round(mstrV(py)*h); // ty: y de GL (abajo=0)
  const lit=(x,y)=>{const i=(y*w+x)*4; return buf[i+3]>16 && (buf[i]+buf[i+1]+buf[i+2])>24;};
  const count=(a,b,c,d)=>{ const X0=Math.max(0,tx(a)),X1=Math.min(w,tx(b)),Y0=Math.max(0,ty(d)),Y1=Math.min(h,ty(c));
    let n=0,tot=0; for(let y=Y0;y<Y1;y++)for(let x=X0;x<X1;x++){tot++; if(lit(x,y))n++;} return {lit:n,tot,pct:tot?+(100*n/tot).toFixed(2):0}; };
  const r={ comp:[w,h], W,H,stripH,fx0,fx1,
    muros:count(0,W,0,stripH), piso:count(fx0,fx1,stripH,H),
    fueraPisoIzq:count(0,fx0,stripH,H), fueraPisoDer:count(fx1,W,stripH,H),
    murosSobreElPiso:count(fx0,fx1,0,stripH),
    filaAltaDelLienzo:count(0,W,0,Math.max(1,Math.round(H*0.01))),
    filaBajaDelLienzo:count(fx0,fx1,H-Math.max(1,Math.round(H*0.01)),H) };
  applyPreviewQuality(1); render(); return r; };1`);
out.A_regiones=await ev(`__reg()`);

/* seam wrap: un clip de muro empujado al borde derecho tiene que reaparecer por la izquierda */
out.A_seam=await ev(`(function(){ const c=state.clips.find(c=>(state.lanes[c.lane]||{}).surf==='wall'&&c.start<=state.playhead&&state.playhead<c.start+c.dur);
  if(!c)return {salta:'sin clip de muro activo'};
  const bak={...c.props}; const kf=c.kf; c.kf={};
  Object.assign(c.props,{x:98,y:0,scale:40,rot:0,opacity:100});
  const r=__reg(); const izq=r.muros&&0; const q=Math.round((activeSeq().w)*0.08);
  const rr=(function(){ applyPreviewQuality(0.25); render();
    const w=compW,h=compH,buf=new Uint8Array(w*h*4);
    gl.bindFramebuffer(gl.FRAMEBUFFER,compFBO); gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,buf); gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    const as=activeSeq(),W=as.w,stripH=as.room.stripH;
    const tx=px=>Math.round(mstrU(px)*w), ty=py=>Math.round(mstrV(py)*h);
    const lit=(x,y)=>{const i=(y*w+x)*4; return buf[i+3]>16&&(buf[i]+buf[i+1]+buf[i+2])>24;};
    const cnt=(a,b)=>{let n=0;const X0=Math.max(0,tx(a)),X1=Math.min(w,tx(b)),Y0=Math.max(0,ty(stripH)),Y1=Math.min(h,ty(0));
      for(let y=Y0;y<Y1;y++)for(let x=X0;x<X1;x++)if(lit(x,y))n++; return n;};
    applyPreviewQuality(1); return {bordeIzq:cnt(0,q), bordeDer:cnt(W-q,W)}; })();
  Object.assign(c.props,bak); c.kf=kf; render();
  return {...rr, envuelve: rr.bordeIzq>0 && rr.bordeDer>0}; })()`);

/* ---------- B · export por-muro ------------------------------------------------------------- */
out.B_exportLim=await ev(`(function(){ const as=activeSeq(), room=as.room, sw=as.w, sh=as.h;
  const wallsH=room.stripH, floorH=sh-wallsH; const fw=(room.walls||[]).find(w=>w.role==='Front')||room.walls[0];
  const right=(room.walls||[]).find(w=>w.role==='Right')||room.walls[1];
  const bak={df:_drawFlat,rw:_roomWrap,ca:_compAspect}; const gw=glc.width,gh=glc.height;
  const leeLim=()=>[...gl.getUniform(PB,LB.uvlim)].map(x=>+x.toFixed(6));
  const R=w=>{ renderExportFrame(state.playhead,256,1,w); return leeLim(); };
  const limMuro=R({kind:'wall',role:'Right',x0:right.x0,x1:right.x1,y0:0,y1:right.pxH,pxW:right.pxW,pxH:right.pxH,stripW:sw,stripH:sh});
  const limPiso=room.floor?R({kind:'floor',x0:fw.x0,x1:fw.x1,y0:wallsH,y1:wallsH+floorH,pxW:room.floor.pxW,pxH:room.floor.pxH,stripW:sw,stripH:sh}):null;
  _drawFlat=bak.df;_roomWrap=bak.rw;_compAspect=bak.ca; glc.width=gw;glc.height=gh; resize(); render();
  const banda=compContentLim().map(v=>+v.toFixed(6));
  return { banda, limMuro, limPiso,
    muroUsaLaBanda: Math.abs(limMuro[0]-banda[0])<1e-6 && Math.abs(limMuro[2]-banda[2])<1e-6,
    pisoAcotaSuRect: !room.floor || (limPiso[2]<banda[2]-1e-9 && limPiso[3]<banda[3]-1e-9) }; })()`);

/* continuidad en la costura: la última columna de Front y la primera de Right tienen que casar */
out.B_costura=await ev(`(function(){ const as=activeSeq(), room=as.room, sw=as.w, sh=as.h;
  const byR={}; for(const w of room.walls)byR[w.role]=w; const A=byR.Front, B=byR.Right; if(!A||!B)return {salta:'faltan muros'};
  const c=state.clips.find(c=>(state.lanes[c.lane]||{}).surf==='wall'&&c.start<=state.playhead&&state.playhead<c.start+c.dur);
  const bak=c?{...c.props}:null, kf=c?c.kf:null;
  if(c){ c.kf={}; Object.assign(c.props,{x:0,y:0,scale:220,rot:0,opacity:100,maskWalls:null}); } // cubre la costura entera
  const PW=128, PH=64; const gw=glc.width,gh=glc.height; const bakv={df:_drawFlat,rw:_roomWrap,ca:_compAspect};
  const col=(wall,which)=>{ glc.width=PW; glc.height=PH; renderExportFrame(state.playhead,PW,1,wall);
    const px=new Uint8Array(PW*PH*4); gl.readPixels(0,0,PW,PH,gl.RGBA,gl.UNSIGNED_BYTE,px);
    const x=which==='last'?PW-1:0, o=[]; for(let y=0;y<PH;y++){const i=(y*PW+x)*4; o.push([px[i],px[i+1],px[i+2]]);} return o; };
  const spec=w=>({kind:'wall',role:w.role,x0:w.x0,x1:w.x1,y0:0,y1:w.pxH,pxW:PW,pxH:PH,stripW:sw,stripH:sh});
  const a=col(spec(A),'last'), b=col(spec(B),'first');
  glc.width=gw; glc.height=gh; _drawFlat=bakv.df;_roomWrap=bakv.rw;_compAspect=bakv.ca;
  if(c){ Object.assign(c.props,bak); c.kf=kf; } resize(); render();
  let dmax=0,dsum=0; for(let i=0;i<a.length;i++){ const d=Math.max(Math.abs(a[i][0]-b[i][0]),Math.abs(a[i][1]-b[i][1]),Math.abs(a[i][2]-b[i][2])); dmax=Math.max(dmax,d); dsum+=d; }
  return { filas:a.length, difMax:dmax, difMedia:+(dsum/a.length).toFixed(2),
    muestraFront:a.slice(20,23), muestraRight:b.slice(20,23) }; })()`);

/* ---------- C · caché de nest: la salida conserva su letterbox ------------------------------ */
out.C_nestCache=await ev(`(function(){ const gw=glc.width,gh=glc.height; const bak={df:_drawFlat,rw:_roomWrap,ca:_compAspect,ns:_ncSquare};
  const R=(square,asp)=>{ _ncSquare=square; _drawFlat=true; _roomWrap=false; _compAspect=asp;
    glc.width=128; glc.height=128; renderExportFrame(state.playhead,128,1,null);
    const lim=[...gl.getUniform(PB,LB.uvlim)].map(x=>+x.toFixed(6));
    const sc=[...gl.getUniform(PB,LB.uvsc)].map(x=>+x.toFixed(6)), of=[...gl.getUniform(PB,LB.uvof)].map(x=>+x.toFixed(6));
    return {lim,sc,of}; };
  const cuadrado=R(true,16/9), normal=R(false,16/9);
  _ncSquare=bak.ns;_drawFlat=bak.df;_roomWrap=bak.rw;_compAspect=bak.ca; glc.width=gw;glc.height=gh; resize(); render();
  return { conNcSquare:cuadrado, sinNcSquare:normal,
    ncSquareUsaTexturaEntera: cuadrado.lim.join()==='0,0,1,1',
    normalAcotaALaBanda: normal.lim[1]>0.001 && normal.lim[3]<0.999 }; })()`);

/* ---------- D · sala 3D: sin franja oscura en el borde alto de los muros --------------------- */
out.D_3d=await ev(`(function(){
  const c=state.clips.find(c=>(state.lanes[c.lane]||{}).surf==='wall'&&c.start<=state.playhead&&state.playhead<c.start+c.dur);
  const bak=c?{...c.props}:null, kf=c?c.kf:null;
  if(c){ c.kf={}; Object.assign(c.props,{x:0,y:0,scale:400,rot:0,opacity:100,maskWalls:null,blur:0,feather:0,crop:0}); }
  state.view.showGrid=false; state.view.three='orbit';
  const b=document.querySelector('#viewModeSeg button[data-v="3d"]'); if(b)b.click(); resize(); render();
  const cv=document.createElement('canvas'); cv.width=glc.width; cv.height=glc.height;
  const g=cv.getContext('2d'); g.drawImage(glc,0,0); const d=g.getImageData(0,0,cv.width,cv.height).data;
  const W=cv.width,H=cv.height, lum=(x,y)=>{const i=(y*W+x)*4; return d[i+3]<16?-1:(0.2126*d[i]+0.7152*d[i+1]+0.0722*d[i+2]);};
  /* columna central: se busca el tramo CONTINUO iluminado más largo = el muro de enfrente */
  const x=Math.round(W/2); let mejor=null,ini=-1;
  for(let y=0;y<H;y++){ const L=lum(x,y); const on=L>12;
    if(on&&ini<0)ini=y; if((!on||y===H-1)&&ini>=0){ const fin=on?y:y-1; if(!mejor||fin-ini>mejor[1]-mejor[0])mejor=[ini,fin]; ini=-1; } }
  if(!mejor)return {salta:'sin muro iluminado'};
  const [y0,y1]=mejor, n=y1-y0+1;
  const top=[], mid=[];
  for(let k=1;k<=3;k++)top.push(lum(x,y0+k));
  for(let k=-2;k<=2;k++)mid.push(lum(x,Math.round((y0+y1)/2)+k));
  const med=a=>a.slice().sort((p,q)=>p-q)[Math.floor(a.length/2)];
  const tp=med(top), md=med(mid);
  const b2=document.querySelector('#viewModeSeg button[data-v="2d"]'); if(b2)b2.click();
  if(c){ Object.assign(c.props,bak); c.kf=kf; } state.view.showGrid=true; resize(); render();
  return { alturaMuroPx:n, lumBordeAlto:+tp.toFixed(1), lumCentro:+md.toFixed(1),
    ratio:+(tp/Math.max(1,md)).toFixed(3), sinFranja: tp>=md*0.9 }; })()`);

out.errs=await ev(`window.__errs.slice(0,20)`);
console.log(JSON.stringify(out,null,1));
ws.close();

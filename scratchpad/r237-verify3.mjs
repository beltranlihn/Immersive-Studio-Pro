/* [R237·3] B y D con contenido CONTROLADO: un rectángulo blanco que cubre la tira de muros entera.
   B · export por-muro: Front y Right tienen que casar en la costura (y no repetir la columna del borde)
   D · sala 3D: el borde alto del muro no puede salir más oscuro que su centro                             */
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

/* sala limpia con UN rectángulo blanco a escala 400 en una pista de muro (cubre la tira entera) */
await ev(`state.dirty=false;1`);
await ev(`(async()=>{try{await startDemoProject('room');}catch(e){window.__d=String(e);}})()`); await wait(2800);
out.prep=await ev(`(function(){try{if(typeof _tourStop==='function')_tourStop();const o=document.getElementById('tourOv');if(o)o.remove();}catch(e){}
  document.querySelector('#viewModeSeg button[data-v="2d"]').click();
  const li=state.lanes.findIndex(l=>l.surf==='wall'&&l.kind==='video'); if(li<0)return {err:'sin pista de muro'};
  state.clips=[]; state.playhead=1;
  const c=_demoAddShape('rect','#FFFFFF',li,0,10,{x:0,y:0,scale:400,rot:0,opacity:100});
  state.lanes.forEach(l=>{l.mute=false;l.solo=false;});
  render(); return {lane:li, clip:!!c, clips:state.clips.length, comp:[compW,compH]}; })()`); await wait(700);

/* --- B · export por-muro contra el export de la TIRA ENTERA ------------------------------------
   Los cuatro muros exportados por separado, puestos uno al lado del otro, tienen que reconstruir la tira
   exactamente. Es la prueba que caza cualquier fallo de costura: columna repetida, columna comida o
   desplazamiento de medio texel. Se pone el clip a escala 100 para que su BORDE cruce las costuras y haya
   transiciones duras que comparar (con un blanco uniforme no se distinguiría un fallo de un acierto). */
out.B=await ev(`(function(){ const as=activeSeq(), room=as.room, sw=as.w, sh=as.h;
  const c=state.clips[0]; const bakp={...c.props}; Object.assign(c.props,{scale:100,x:-35,y:0});
  const NW=4, PW=128, PH=64, SW=PW*NW, RES=1024;             // tira = 4 muros × 128
  /* MISMA resolución de composite (RES) en las cinco pasadas: si no, se estaría comparando el rasterizado de un
     composite de 512² contra el de uno de 128², y la diferencia sería la del muestreo, no la de las costuras. */
  const gw=glc.width,gh=glc.height, bak={df:_drawFlat,rw:_roomWrap,ca:_compAspect};
  const shot=(w,ww)=>{ glc.width=ww; glc.height=PH; renderExportFrame(state.playhead,RES,1,w);
    const px=new Uint8Array(ww*PH*4); gl.readPixels(0,0,ww,PH,gl.RGBA,gl.UNSIGNED_BYTE,px); return px; };
  const tira=shot({kind:'wall',role:null,x0:0,x1:sw,y0:0,y1:room.stripH,pxW:SW,pxH:PH,stripW:sw,stripH:sh},SW);
  const orden=['Front','Right','Back','Left']; const byR={}; for(const w of room.walls)byR[w.role]=w;
  const difs=[];
  for(let k=0;k<NW;k++){ const w=byR[orden[k]]; if(!w){difs.push({role:orden[k],salta:1});continue;}
    const m=shot({kind:'wall',role:w.role,x0:w.x0,x1:w.x1,y0:0,y1:w.pxH,pxW:PW,pxH:PH,stripW:sw,stripH:sh},PW);
    let dmax=0,dsum=0,n=0;
    for(let y=0;y<PH;y++)for(let x=0;x<PW;x++){ const i=(y*PW+x)*4, j=(y*SW+(k*PW+x))*4;
      const d=Math.max(Math.abs(m[i]-tira[j]),Math.abs(m[i+1]-tira[j+1]),Math.abs(m[i+2]-tira[j+2])); dmax=Math.max(dmax,d); dsum+=d; n++; }
    difs.push({role:orden[k], difMax:dmax, difMedia:+(dsum/n).toFixed(3)}); }
  glc.width=gw; glc.height=gh; _drawFlat=bak.df;_roomWrap=bak.rw;_compAspect=bak.ca; Object.assign(c.props,bakp); resize(); render();
  let tr=0; for(let x=1;x<SW;x++){ const a=tira[(32*SW+x-1)*4], b=tira[(32*SW+x)*4]; if(Math.abs(a-b)>40)tr++; }
  return { transicionesEnLaTira:tr, porMuro:difs, casanTodos:difs.every(d=>d.salta||d.difMax<=2) }; })()`);

/* --- D · sala 3D ------------------------------------------------------------------------------ */
out.D=await ev(`(function(){ state.view.showGrid=false; state.view.roomOutTex=false;
  state.view.three='spec'; // desde DENTRO: los muros van opacos (pass 1). En órbita se ven por fuera, al 17% de alfa
  const b=document.querySelector('#viewModeSeg button[data-v="3d"]'); if(b)b.click(); resize();
  /* la cámara se pone DESPUÉS de entrar en 3D (el conmutador reajusta su propio encuadre) y mirando hacia
     ARRIBA: así el borde alto del muro entra en cuadro con vacío por encima, que es donde R233b encontró la
     franja. Pegado al muro el tramo claro llenaba la pantalla y no probaba nada. */
  state.view.three='spec'; state.view.cam={...state.view.cam, yaw:0, pitch:0.55, back:0, fov:75}; render();
  const cv=document.createElement('canvas'); cv.width=glc.width; cv.height=glc.height;
  const g=cv.getContext('2d'); g.drawImage(glc,0,0); const d=g.getImageData(0,0,cv.width,cv.height).data;
  const W=cv.width,H=cv.height, lum=(x,y)=>{const i=(y*W+x)*4; return 0.2126*d[i]+0.7152*d[i+1]+0.0722*d[i+2];};
  let claros=0; for(let i=0;i<W*H;i++){ if(lum(i%W,(i/W)|0)>60)claros++; }
  /* tramo vertical claro más largo de TODA la imagen (no sólo de la columna central: según la cámara, el
     centro puede caer en una esquina o en el piso) */
  let mejor=null,x=0;
  for(let cx=4;cx<W-4;cx+=2){ let ini=-1;
    for(let y=0;y<H;y++){ const on=lum(cx,y)>60; if(on&&ini<0)ini=y;
      if((!on||y===H-1)&&ini>=0){ const fin=on?y:y-1; if(!mejor||fin-ini>mejor[1]-mejor[0]){mejor=[ini,fin];x=cx;} ini=-1; } } }
  const r={ pintaClara:+(claros/(W*H)).toFixed(4), lienzo:[W,H], columna:x };
  if(mejor){ const [y0,y1]=mejor; const med=a=>a.slice().sort((p,q)=>p-q)[a.length>>1];
    const top=[],mid=[],bot=[];
    for(let k=1;k<=3;k++)top.push(lum(x,y0+k));
    const c0=Math.round((y0+y1)/2); for(let k=-2;k<=2;k++)mid.push(lum(x,c0+k));
    for(let k=1;k<=3;k++)bot.push(lum(x,y1-k));
    r.tramoPx=y1-y0+1; r.lumBordeAlto=+med(top).toFixed(1); r.lumCentro=+med(mid).toFixed(1); r.lumBordeBajo=+med(bot).toFixed(1);
    r.ratioAlto=+(med(top)/Math.max(1,med(mid))).toFixed(3); r.sinFranja=med(top)>=med(mid)*0.9; }
  else r.salta='sin tramo claro';
  r.camara={three:state.view.three, pitch:+state.view.cam.pitch.toFixed(2), back:state.view.cam.back, fov:state.view.cam.fov};
  /* prueba numérica del mismo punto, independiente de dónde apunte la cámara: la UV del borde alto del muro
     (v=mstrV(0)) tiene que llegar al tope del contenido, si no uvLim la recorta y ahí sale la franja. */
  const as=activeSeq(), lim=mstrContentLim();
  r.uv={ vTopMuro:+mstrV(0,as.h).toFixed(6), vBotMuro:+mstrV(as.room.stripH,as.h).toFixed(6),
    limAlto:+lim[3].toFixed(6), limBajo:+lim[1].toFixed(6),
    bordeAltoNoRecortado: mstrV(0,as.h)<=lim[3]+1e-9 && Math.abs(mstrV(0,as.h)-1)<1e-6 };
  const b2=document.querySelector('#viewModeSeg button[data-v="2d"]'); if(b2)b2.click(); state.view.showGrid=true; resize(); render();
  return r; })()`);

out.errs=await ev(`window.__errs.slice(0,20)`);
console.log(JSON.stringify(out,null,1));
ws.close();

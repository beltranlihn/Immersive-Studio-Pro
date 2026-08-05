/* [R269] Punto 16 de la lista: marcar el In/Out en el monitor de origen reajusta los clips que YA estan en bucle.
   El ejemplo de Beltran, literal: clip de 5 s loopeado y extendido a 30 s (seis vueltas); al cambiar el tramo a
   3 s debe seguir durando 30 s y pasar a diez vueltas. */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):(r.result.exceptionDetails?rej(new Error(r.result.exceptionDetails.exception?.description||r.result.exceptionDetails.text)):res(r.result.result.value)));
  ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let fallos=0; const mal=m=>{ console.log('   *** '+m); fallos++; };
const VID='C:/Users/beltr/Desktop/Alma Digital Studio/Code/Alma Digital Portfolio/Asset/Reel Portfolio/Reel Portfolio.mp4';
await ev(`(async()=>{ await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()`);
await wait(1400);
await ev(`window.__vid=function(ruta,nombre){ return new Promise(res=>{ const url=DSP.toFileURL(ruta); const v=document.createElement("video"); v.preload="metadata"; v.src=url;
  v.addEventListener("loadedmetadata",()=>{ const m={id:uid(),name:nombre,kind:"video",el:v,originalEl:v,srcUrl:url,tex:newTex(),w:v.videoWidth,h:v.videoHeight,dur:v.duration,fps:30,color:clipColorFor("video"),proxyReady:false,proxyPct:0,path:ruta,fsize:0,folder:null,missing:false,_loading:false};
    state.media.push(m); renderMedia(); res(m.id); }); v.addEventListener("error",()=>res(null)); }); };1`);
const mid=await ev(`__vid(${JSON.stringify(VID)},"reel.mp4")`);
if(!mid){ console.log('*** no se pudo cargar el video'); process.exit(1); }

/* el montaje del ejemplo: clip loopeado cada 5 s, extendido a 30 s. Y un SEGUNDO clip del mismo medio en otra
   secuencia, para comprobar que el alcance es "todos". Y uno del mismo medio SIN bucle, que no debe tocarse. */
const antes=await ev(`(function(){ const m=mediaById(${JSON.stringify(mid)});
  state.clips=[]; const vl=state.lanes.findIndex(l=>l.kind==='video');
  const c=makeClip(m,vl,0); c.dur=30; c.inP=0; state.clips.push(c);
  state.selId=c.id; state.selIds=[c.id]; toggleLoop(c); setLoopRange(c,5); c.dur=30;
  const suelto=makeClip(m,vl,40); suelto.dur=4; state.clips.push(suelto);          // sin bucle: intocable
  /* un nido con otro clip del mismo medio, tambien en bucle */
  const n={id:uid(),name:'otra',kind:'nest',w:1024,h:1024,mode:'dome',dur:20,fps:30,color:'#888',nestLanes:[{id:uid(),name:'V1',tag:'V1',kind:'video'}],nestClips:[]};
  const c2=makeClip(m,0,0); c2.dur=20; c2.inP=0; c2.loop=true; c2.loopLen=5; n.nestClips.push(c2);
  state.media.push(n); renderTimeline();
  return { principal:{dur:c.dur,inP:c.inP,loopLen:c.loopLen,vueltas:+(c.dur/c.loopLen).toFixed(2)},
           enNido:{dur:c2.dur,inP:c2.inP,loopLen:c2.loopLen}, suelto:{dur:suelto.dur,loop:!!suelto.loop,inP:suelto.inP} }; })()`);
console.log('ANTES  · principal: '+JSON.stringify(antes.principal));
console.log('         en un nido: '+JSON.stringify(antes.enNido)+'   suelto (sin bucle): '+JSON.stringify(antes.suelto));

/* y ahora se marca 1..4 en el monitor de origen (tramo de 3 s) y se confirma, que es lo que hace el usuario */
const desp=await ev(`(function(){ const m=mediaById(${JSON.stringify(mid)});
  openSourceMonitor(m); _srcMon.in=1; _srcMon.out=4; smCommitMarks();
  const c=state.clips[0], suelto=state.clips[1];
  const n=state.media.find(x=>x.kind==='nest'&&x.name==='otra'); const c2=n.nestClips[0];
  try{ closeSourceMonitor(); }catch(e){}
  return { principal:{dur:c.dur,inP:c.inP,loopLen:c.loopLen,vueltas:+(c.dur/c.loopLen).toFixed(2)},
           enNido:{dur:c2.dur,inP:c2.inP,loopLen:c2.loopLen},
           suelto:{dur:suelto.dur,loop:!!suelto.loop,inP:suelto.inP},
           medio:{srcIn:m.srcIn,srcOut:m.srcOut} }; })()`);
console.log('\nDESPUES · principal: '+JSON.stringify(desp.principal));
console.log('          en un nido: '+JSON.stringify(desp.enNido)+'   suelto: '+JSON.stringify(desp.suelto));
console.log('          marcas del medio: '+JSON.stringify(desp.medio));

if(desp.principal.dur!==30) mal('la duracion en la linea de tiempo ha cambiado ('+desp.principal.dur+' s): se pierde el montaje');
if(Math.abs(desp.principal.loopLen-3)>1e-3) mal('el tramo del bucle no se ha ajustado a 3 s');
if(Math.abs(desp.principal.inP-1)>1e-3) mal('el punto de entrada no se ha movido al In marcado');
if(Math.abs(desp.principal.vueltas-10)>0.01) mal('deberian quedar 10 vueltas, hay '+desp.principal.vueltas);
if(Math.abs(desp.enNido.loopLen-3)>1e-3||Math.abs(desp.enNido.inP-1)>1e-3) mal('el clip en bucle de OTRA secuencia no se ha ajustado');
if(desp.enNido.dur!==20) mal('la duracion del clip del nido ha cambiado');
if(desp.suelto.loop||desp.suelto.inP!==0||desp.suelto.dur!==4) mal('se ha tocado un clip que NO estaba en bucle');
console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'el tramo se aplica y el montaje se conserva'));
ws.close();

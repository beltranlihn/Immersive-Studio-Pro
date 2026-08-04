/* [AUDIT 2026-08] Estado heredado entre proyectos (zona 4.3 del encargo): el "cuarto caso".
   H1: el pan/zoom GLOBAL del visor (y la cámara 3D) se hereda al crear/abrir proyecto (newProject/loadProject
       no lo resetean; newRoomProject sí — inconsistencia).
   H2: un .isp legacy (sin openSeqs/sequences) hereda seqMode/seqCov del proyecto ANTERIOR vía ensureSequences.
   H3: tl.bpm/sig/tcMode con archivo legacy sin bloque tl → heredados (solo pxPerSec se arregló en R240b). */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:60000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const out={};
await ev(`(function(){ window.__errs=[]; addEventListener('error',e=>__errs.push(String(e.message||e))); return 1; })()`);

/* H1 — pan/zoom global entre proyectos nuevos */
await ev(`state.dirty=false;1`);
await ev(`(async()=>{try{await startDemoProject('dome');}catch(e){window.__d=String(e);}})()`); await wait(2500);
await ev(`(function(){try{if(typeof _tourStop==='function')_tourStop();const o=document.getElementById('tourOv');if(o)o.remove();}catch(e){}return 1;})()`);
out.h1=await ev(`(async function(){
  state.view.zoom=5.5; state.view.pan=[0.7,-0.4]; state.view.cam.yaw=2.2; state.view.cam.dist=9; render();
  state.dirty=false;
  const okNew=await newProject('dome',4096,4096,60,180,true);
  const trasNew={ zoom:state.view.zoom, pan:state.view.pan.slice(), camYaw:state.view.cam.yaw, camDist:state.view.cam.dist };
  return { okNew, trasNew, heredaZoom:state.view.zoom===5.5, heredaCam:state.view.cam.yaw===2.2 }; })()`);

/* H1b — y al ABRIR un proyecto (loadProject con un v4 serializado sano) */
out.h1b=await ev(`(async function(){
  state.view.zoom=4.4; state.view.pan=[0.5,0.5]; state.dirty=false;
  const obj=JSON.parse(JSON.stringify(serProject()));
  loadProject(obj);
  return { zoomTrasLoad:state.view.zoom, panTrasLoad:state.view.pan.slice(), hereda:state.view.zoom===4.4 }; })()`);
await wait(1200);

/* H2/H3 — legacy sin sequences: primero dejar la app en modo SALA con cov/bpm distintivos */
await ev(`state.dirty=false;1`);
await ev(`(async()=>{try{await startDemoProject('room');}catch(e){window.__d=String(e);}})()`); await wait(2800);
await ev(`(function(){try{if(typeof _tourStop==='function')_tourStop();const o=document.getElementById('tourOv');if(o)o.remove();}catch(e){}return 1;})()`);
out.h2=await ev(`(function(){
  state.tl.bpm=174; state.tl.sig=7; state.tl.tcMode='frames'; state.dirty=false;
  const antes={ modo:state.seqMode, cov:state.seqCov };
  /* .isp v2 sintético: sin openSeqs, sin sequences, sin bloque tl — un domo clásico */
  const legacy={ app:'DomeStudioPro', v:2, fps:30, playhead:0,
    lanes:[{id:1,name:'Video 1',tag:'V1',kind:'video'}],
    clips:[], media:[], markers:[], groups:[], seqW:2048, seqH:2048 };
  loadProject(legacy);
  const as=activeSeq();
  return { antes,
    seqCreada:{ modo:as?as.mode:null, cov:as?as.cov:null, w:as?as.w:null, h:as?as.h:null },
    stateTras:{ seqMode:state.seqMode, seqCov:state.seqCov },
    tlTras:{ bpm:state.tl.bpm, sig:state.tl.sig, tcMode:state.tl.tcMode, pxPerSec:state.tl.pxPerSec } }; })()`);
await wait(800);
/* limpiar: volver a un proyecto normal */
await ev(`state.dirty=false;1`);
await ev(`(async()=>{try{await newProject('dome',4096,4096,60,180,true);}catch(e){}})()`); await wait(600);
out.errs=await ev(`window.__errs.slice(0,10)`);
console.log(JSON.stringify(out,null,1));
ws.close();

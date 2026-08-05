/* [R256] Por que se rinde el decodificador con un clip en bucle. Instrumentacion via window.__D. */
import http from 'http'; import fs from 'fs'; import path from 'path';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:900000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const VID='C:/Users/beltr/Desktop/Alma Digital Studio/Code/Alma Digital Portfolio/Asset/Reel Portfolio/Reel Portfolio.mp4';
const N=+(process.argv[2]||45), FPS=30, SEGS=N/FPS, LOOP=0.4;
await cmd('Page.reload',{ignoreCache:true}); await wait(3800);
await ev(`(async()=>{ await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()`); await wait(1200);
await ev(`window.__vid=function(ruta,nombre){ return new Promise(res=>{ const url=DSP.toFileURL(ruta); const v=document.createElement("video"); v.preload="metadata"; v.src=url;
  v.addEventListener("loadedmetadata",()=>{ const m={id:uid(),name:nombre,kind:"video",el:v,originalEl:v,srcUrl:url,tex:newTex(),w:v.videoWidth,h:v.videoHeight,dur:v.duration,fps:30,color:clipColorFor("video"),proxyReady:false,proxyPct:0,path:ruta,fsize:0,folder:null,missing:false,_loading:false};
    state.media.push(m); renderMedia(); res(1); }); v.addEventListener("error",()=>res(0)); }); };1`);
await ev(`__vid(${JSON.stringify(VID)},"reel.mp4")`);
const DIR=path.join(process.cwd(),'scratchpad','r256-diag'); fs.rmSync(DIR,{recursive:true,force:true}); fs.mkdirSync(DIR,{recursive:true});
const r=await ev(`(async()=>{ window.__D={steps:0,sinAlimentar:0,sinFotograma:0,atascos:0,ring:[],rendicion:null};
  state.clips=[]; const V=state.media.find(m=>m.kind==='video'); const vl=state.lanes.findIndex(l=>l.kind==='video');
  const c=makeClip(V,vl,0); c.dur=${SEGS}; c.inP=4; c.props.el=90; c.props.size=90; state.clips.push(c);
  state.selId=c.id; state.selIds=[c.id]; toggleLoop(c); setLoopRange(c,${LOOP}); c.dur=${SEGS};
  renderTimeline(); render();
  const ui=ripProgress('R256','diag',1);
  try{ await runExport({codec:'png',res:512,fps:${FPS},range:'clips',rangeT:[0,${SEGS}],outW:512,outH:512,outDir:${JSON.stringify(DIR)},silent:true,noAudio:true,job:ui.job}); }finally{ ui.close(); }
  const D=window.__D; return { cdFail:!!V._cdFail, steps:D.steps, sinAlimentar:D.sinAlimentar, sinFotograma:D.sinFotograma,
    atascos:D.atascos, rendicion:D.rendicion, ej:D.ring }; })()`);
console.log('cdFail: '+r.cdFail+'   pasos de step(): '+r.steps+'   sin alimentar: '+r.sinAlimentar+'   sin el fotograma: '+r.sinFotograma+'   reinicios por atasco: '+r.atascos);
console.log('\nrendicion: '+JSON.stringify(r.rendicion));
console.log('\nprimeras situaciones sin el fotograma pedido:');
for(const e of r.ej)   console.log('   tgt='+(e.tgt/1e6).toFixed(3)+' lastFed='+(e.lastFed/1e6).toFixed(3)+' cache['+(e.lo/1e6).toFixed(3)+'..'+(e.hi/1e6).toFixed(3)+'] n='+e.n+' cola='+e.cola+' nc='+e.nc+' feed='+e.feed+' atasco='+e.atasco+(e.fin?' FIN':'')+(e.err?' err='+e.err:''));
ws.close();

/* [AUDIT 2026-08] Migraciones legacy v2/v3 sin BOM, por el camino real openProjectPath. */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:60000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const SP='C:\\\\Users\\\\beltr\\\\Desktop\\\\Alma Digital Studio\\\\Projects\\\\Immersive Studio Pro\\\\scratchpad';
const out={};
await ev(`(function(){ window.__errs=[]; addEventListener('error',e=>__errs.push(String(e.message||e)));
  window.__alerts=[]; if(!window.__alertHook){ window.__alertHook=1; const aa=window.appAlert; window.appAlert=function(msg,cb){ __alerts.push(String(msg)); if(cb)cb(); }; }
  return 1; })()`);

/* estado de partida SANO: proyecto domo nuevo (para que la herencia no contamine y medir el caso limpio) */
await ev(`(async()=>{ state.dirty=false; await newProject('dome',4096,4096,60,180,true); })()`); await wait(500);

out.v2_desdeDomo=await ev(`(async function(){ state.dirty=false; __alerts.length=0;
  await openProjectPath('${SP}\\\\aud2608-legacy-v2.rdome');
  const as=activeSeq();
  return { alerts:__alerts.slice(), path:pbase(String(currentPath||'')),
    seq:{ modo:as?as.mode:null, cov:as?as.cov:null, w:as?as.w:null, h:as?as.h:null, lanes:(state.lanes||[]).map(l=>l.tag) },
    fps:state.fps, playhead:state.playhead, seqMode:state.seqMode }; })()`);
await wait(600);

out.v3_ise=await ev(`(async function(){ state.dirty=false; __alerts.length=0;
  await openProjectPath('${SP}\\\\aud2608-legacy-v3.ise');
  const as=activeSeq(); const seqs=state.media.filter(m=>m.kind==='nest');
  return { alerts:__alerts.slice(), path:pbase(String(currentPath||'')),
    nSeqs:seqs.length, nombres:seqs.map(s=>s.name), activa:as?as.name:null, activaId:state.activeSeqId,
    openSeqs:state.openSeqs.slice(), modoActiva:as?as.mode:null, playheadActiva:state.playhead,
    audioLane:(state.lanes||[]).some(l=>l.kind==='audio') }; })()`);
await wait(600);

/* guardar el v3 recién abierto como v4 y reabrirlo: ida y vuelta de migración */
out.v3_roundtrip=await ev(`(async function(){
  const json=JSON.stringify(serProject()); state.dirty=false;
  loadProject(JSON.parse(json));
  const as=activeSeq(); const seqs=state.media.filter(m=>m.kind==='nest');
  return { nSeqs:seqs.length, activa:as?as.name:null, v:'v4-roundtrip-ok', errs:window.__errs.length }; })()`);
await wait(400);
await ev(`(async()=>{ state.dirty=false; await newProject('dome',4096,4096,60,180,true); })()`);
out.errs=await ev(`window.__errs.slice(0,10)`);
console.log(JSON.stringify(out,null,1));
ws.close();
